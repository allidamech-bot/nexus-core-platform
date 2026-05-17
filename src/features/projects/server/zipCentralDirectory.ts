import type { ProjectFile } from "../types";
import {
  BLOCKED_FILENAMES,
  BLOCKED_PATH_SEGMENTS,
  DANGEROUS_EXTENSIONS,
  ZIP_MANIFEST_LIMITS,
} from "./zipManifestConstants";

export interface ZipInventoryFile {
  path: string;
  name: string;
  extension: string | null;
  size_bytes: number;
  mime_type: string;
  checksum: string | null;
}

export interface ZipInventoryResult {
  files: ZipInventoryFile[];
  skipped: Record<string, number>;
  suspicious: Array<{ path: string; reason: string }>;
  directoryCount: number;
  totalSizeBytes: number;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP64_SENTINEL = 0xffffffff;

function readUInt16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function extensionFor(name: string): string | null {
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return null;
  return name.slice(index + 1).toLowerCase();
}

export function mimeCategoryFor(extension: string | null): string {
  if (!extension) return "unknown";
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "json",
      "css",
      "html",
      "md",
      "txt",
      "yaml",
      "yml",
      "toml",
      "xml",
      "py",
      "rs",
      "go",
      "java",
      "kt",
      "swift",
      "dart",
      "php",
      "rb",
      "cs",
      "sql",
    ].includes(extension)
  ) {
    return "text";
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "ico"].includes(extension)) return "image";
  if (["mp4", "mov", "webm", "mp3", "wav"].includes(extension)) return "media";
  if (["zip", "gz", "tar", "rar", "7z"].includes(extension)) return "archive";
  return "binary";
}

function decodePath(bytes: Uint8Array, utf8: boolean): string {
  const decoder = new TextDecoder(utf8 ? "utf-8" : "utf-8", { fatal: false });
  return decoder.decode(bytes);
}

function crc32Hex(crc32: number): string {
  return crc32.toString(16).padStart(8, "0");
}

function normalizeZipPath(rawPath: string): { path: string | null; reason?: string } {
  if (!rawPath || rawPath.includes("\0")) return { path: null, reason: "invalid_path" };

  const path = rawPath
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
  const lowerPath = path.toLowerCase();

  if (!path || path.length > ZIP_MANIFEST_LIMITS.maxPathLength) {
    return { path: null, reason: "path_too_long" };
  }

  if (path.startsWith("/") || /^[a-z]:\//i.test(path)) {
    return { path: null, reason: "absolute_path" };
  }

  const segments = lowerPath.split("/").filter(Boolean);
  if (segments.some((segment) => BLOCKED_PATH_SEGMENTS.has(segment))) {
    return { path: null, reason: "blocked_path_segment" };
  }

  if (segments.some((segment) => segment === ".." || segment.includes(".."))) {
    return { path: null, reason: "path_traversal" };
  }

  const fileName = segments.at(-1);
  if (fileName && BLOCKED_FILENAMES.has(fileName)) {
    return { path: null, reason: "blocked_system_file" };
  }

  return { path };
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const maxCommentLength = 0xffff;
  const minEocdLength = 22;
  const start = Math.max(0, bytes.length - minEocdLength - maxCommentLength);

  for (let offset = bytes.length - minEocdLength; offset >= start; offset -= 1) {
    if (readUInt32(bytes, offset) === EOCD_SIGNATURE) return offset;
  }

  throw new Error("Malformed ZIP: central directory marker was not found.");
}

export function readZipCentralDirectory(bytes: Uint8Array): ZipInventoryResult {
  if (bytes.byteLength === 0) throw new Error("The uploaded archive is empty.");
  if (bytes.byteLength > ZIP_MANIFEST_LIMITS.maxArchiveBytes) {
    throw new Error("The uploaded archive exceeds the manifest extraction size limit.");
  }

  const eocdOffset = findEndOfCentralDirectory(bytes);
  const diskNumber = readUInt16(bytes, eocdOffset + 4);
  const centralDirectoryDisk = readUInt16(bytes, eocdOffset + 6);
  const entriesOnDisk = readUInt16(bytes, eocdOffset + 8);
  const entryCount = readUInt16(bytes, eocdOffset + 10);
  const centralDirectorySize = readUInt32(bytes, eocdOffset + 12);
  const centralDirectoryOffset = readUInt32(bytes, eocdOffset + 16);

  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error("Split ZIP archives are not supported.");
  }

  if (
    entryCount === ZIP64_SENTINEL ||
    centralDirectorySize === ZIP64_SENTINEL ||
    centralDirectoryOffset === ZIP64_SENTINEL
  ) {
    throw new Error("ZIP64 archives are not supported in this ingestion phase.");
  }

  if (entryCount > ZIP_MANIFEST_LIMITS.maxFileCount) {
    throw new Error(`Archive contains more than ${ZIP_MANIFEST_LIMITS.maxFileCount} entries.`);
  }

  if (centralDirectorySize > ZIP_MANIFEST_LIMITS.maxCentralDirectoryBytes) {
    throw new Error("Archive central directory is too large for safe manifest extraction.");
  }

  if (centralDirectoryOffset + centralDirectorySize > bytes.byteLength) {
    throw new Error("Malformed ZIP: central directory points outside the archive.");
  }

  const skipped: Record<string, number> = {};
  const suspicious: Array<{ path: string; reason: string }> = [];
  const files: ZipInventoryFile[] = [];
  const directories = new Set<string>();
  let totalSizeBytes = 0;
  let offset = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (readUInt32(bytes, offset) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("Malformed ZIP: invalid central directory entry.");
    }

    const flags = readUInt16(bytes, offset + 8);
    const crc32 = readUInt32(bytes, offset + 16);
    const uncompressedSize = readUInt32(bytes, offset + 24);
    const fileNameLength = readUInt16(bytes, offset + 28);
    const extraLength = readUInt16(bytes, offset + 30);
    const commentLength = readUInt16(bytes, offset + 32);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;
    const nextOffset = nameEnd + extraLength + commentLength;

    if (nameEnd > bytes.byteLength || nextOffset > bytes.byteLength) {
      throw new Error("Malformed ZIP: entry metadata is incomplete.");
    }

    const rawPath = decodePath(bytes.slice(nameStart, nameEnd), Boolean(flags & (1 << 11)));
    const normalized = normalizeZipPath(rawPath);
    if (!normalized.path) {
      increment(skipped, normalized.reason ?? "invalid_path");
      suspicious.push({ path: rawPath.slice(0, 256), reason: normalized.reason ?? "invalid_path" });
      offset = nextOffset;
      continue;
    }

    const normalizedPath = normalized.path;
    if (normalizedPath.endsWith("/")) {
      directories.add(normalizedPath.replace(/\/$/, ""));
      offset = nextOffset;
      continue;
    }

    const name = normalizedPath.split("/").at(-1) ?? normalizedPath;
    const extension = extensionFor(name);

    if (extension && DANGEROUS_EXTENSIONS.has(extension)) {
      increment(skipped, "dangerous_extension");
      suspicious.push({ path: normalizedPath, reason: "dangerous_extension" });
      offset = nextOffset;
      continue;
    }

    if (uncompressedSize > ZIP_MANIFEST_LIMITS.maxSingleFileBytes) {
      increment(skipped, "file_too_large");
      offset = nextOffset;
      continue;
    }

    if (totalSizeBytes + uncompressedSize > ZIP_MANIFEST_LIMITS.maxTotalUncompressedBytes) {
      increment(skipped, "total_size_limit");
      offset = nextOffset;
      continue;
    }

    const parts = normalizedPath.split("/");
    for (let partIndex = 1; partIndex < parts.length; partIndex += 1) {
      directories.add(parts.slice(0, partIndex).join("/"));
    }

    totalSizeBytes += uncompressedSize;
    files.push({
      path: normalizedPath,
      name,
      extension,
      size_bytes: uncompressedSize,
      mime_type: mimeCategoryFor(extension),
      checksum: crc32 ? `crc32:${crc32Hex(crc32)}` : null,
    });

    offset = nextOffset;
  }

  return {
    files,
    skipped,
    suspicious,
    directoryCount: directories.size,
    totalSizeBytes,
  };
}

export function toProjectFileInsert(
  file: ZipInventoryFile,
  projectId: string,
  userId: string,
): Pick<
  ProjectFile,
  "project_id" | "user_id" | "path" | "name" | "extension" | "size_bytes" | "mime_type" | "checksum"
> {
  return {
    project_id: projectId,
    user_id: userId,
    path: file.path,
    name: file.name,
    extension: file.extension,
    size_bytes: file.size_bytes,
    mime_type: file.mime_type,
    checksum: file.checksum,
  };
}
