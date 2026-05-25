import type { ProjectFile } from "../types";
import { DANGEROUS_EXTENSIONS, ZIP_MANIFEST_LIMITS } from "./zipManifestConstants";
import {
  classifyProjectFile,
  createManifestEntry,
  extensionForPath,
  normalizeZipPath,
  ZipRejectedError,
} from "./zipSafety";

export interface ZipInventoryFile {
  path: string;
  name: string;
  extension: string | null;
  size_bytes: number;
  compressed_size: number;
  compression_method: number;
  local_header_offset: number;
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
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
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

export function mimeCategoryFor(extension: string | null): string {
  return classifyProjectFile(extension ? `file.${extension}` : "file");
}

function decodePath(bytes: Uint8Array, utf8: boolean): string {
  const decoder = new TextDecoder(utf8 ? "utf-8" : "utf-8", { fatal: false });
  return decoder.decode(bytes);
}

function crc32Hex(crc32: number): string {
  return crc32.toString(16).padStart(8, "0");
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
    throw new ZipRejectedError(
      "ZIP rejected because it exceeds file or size limits.",
      "archive_too_large",
    );
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
    throw new ZipRejectedError(
      "ZIP rejected because it exceeds file or size limits.",
      "file_count_limit",
    );
  }

  if (centralDirectorySize > ZIP_MANIFEST_LIMITS.maxCentralDirectoryBytes) {
    throw new ZipRejectedError(
      "ZIP rejected because it exceeds file or size limits.",
      "central_directory_too_large",
    );
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
    const compressionMethod = readUInt16(bytes, offset + 10);
    const crc32 = readUInt32(bytes, offset + 16);
    const compressedSize = readUInt32(bytes, offset + 20);
    const uncompressedSize = readUInt32(bytes, offset + 24);
    const fileNameLength = readUInt16(bytes, offset + 28);
    const extraLength = readUInt16(bytes, offset + 30);
    const commentLength = readUInt16(bytes, offset + 32);
    const localHeaderOffset = readUInt32(bytes, offset + 42);
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
      throw new ZipRejectedError(
        "ZIP rejected because it contains unsafe paths.",
        normalized.reason ?? "invalid_path",
      );
    }

    const normalizedPath = normalized.path;
    if (normalizedPath.endsWith("/")) {
      directories.add(normalizedPath.replace(/\/$/, ""));
      offset = nextOffset;
      continue;
    }

    const name = normalizedPath.split("/").at(-1) ?? normalizedPath;
    const extension = extensionForPath(name);

    if (extension && DANGEROUS_EXTENSIONS.has(extension)) {
      increment(skipped, "dangerous_extension");
      suspicious.push({ path: normalizedPath, reason: "dangerous_extension" });
      throw new ZipRejectedError(
        "ZIP rejected because it contains unsupported dangerous content.",
        "dangerous_extension",
      );
    }

    if (uncompressedSize > ZIP_MANIFEST_LIMITS.maxSingleFileBytes) {
      increment(skipped, "file_too_large");
      throw new ZipRejectedError(
        "ZIP rejected because it exceeds file or size limits.",
        "file_too_large",
      );
    }

    if (totalSizeBytes + uncompressedSize > ZIP_MANIFEST_LIMITS.maxTotalUncompressedBytes) {
      increment(skipped, "total_size_limit");
      throw new ZipRejectedError(
        "ZIP rejected because it exceeds file or size limits.",
        "total_size_limit",
      );
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
      compressed_size: compressedSize,
      compression_method: compressionMethod,
      local_header_offset: localHeaderOffset,
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
  ingestionJobId?: string,
): Pick<
  ProjectFile,
  | "project_id"
  | "user_id"
  | "path"
  | "name"
  | "extension"
  | "size_bytes"
  | "mime_type"
  | "checksum"
  | "content_sha256"
  | "ingestion_job_id"
  | "is_text"
  | "is_previewable"
  | "skipped"
  | "skip_reason"
  | "indexed_at"
> {
  const entry = createManifestEntry(file);
  return {
    project_id: projectId,
    user_id: userId,
    path: entry.path,
    name: entry.file_name,
    extension: entry.extension,
    size_bytes: entry.size_bytes,
    mime_type: entry.mime_type,
    checksum: entry.checksum,
    content_sha256: entry.content_sha256,
    ingestion_job_id: ingestionJobId ?? null,
    is_text: entry.is_text,
    is_previewable: entry.is_previewable,
    skipped: entry.skipped,
    skip_reason: entry.skip_reason,
    indexed_at: entry.indexed_at,
  };
}

async function decompressDeflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Deflate decompression is not available in this runtime.");
  }

  const data = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(data).set(bytes);
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function readZipEntryBytes(
  archiveBytes: Uint8Array,
  file: Pick<
    ZipInventoryFile,
    "local_header_offset" | "compressed_size" | "size_bytes" | "compression_method" | "path"
  >,
): Promise<Uint8Array> {
  const offset = file.local_header_offset;
  if (offset < 0 || offset + 30 > archiveBytes.byteLength) {
    throw new Error(`Malformed ZIP entry header for ${file.path}.`);
  }

  if (readUInt32(archiveBytes, offset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Malformed ZIP local header for ${file.path}.`);
  }

  const fileNameLength = readUInt16(archiveBytes, offset + 26);
  const extraLength = readUInt16(archiveBytes, offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const dataEnd = dataStart + file.compressed_size;

  if (dataStart < 0 || dataEnd > archiveBytes.byteLength) {
    throw new Error(`ZIP entry data points outside the archive for ${file.path}.`);
  }

  const compressed = archiveBytes.slice(dataStart, dataEnd);
  if (file.compression_method === 0) return compressed;
  if (file.compression_method === 8) return decompressDeflateRaw(compressed);

  throw new Error(
    `Unsupported ZIP compression method ${file.compression_method} for ${file.path}.`,
  );
}
