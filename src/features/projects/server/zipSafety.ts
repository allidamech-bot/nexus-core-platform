import type { Json } from "@/integrations/supabase/types";
import {
  BLOCKED_FILENAMES,
  BLOCKED_PATH_SEGMENTS,
  DANGEROUS_EXTENSIONS,
  ZIP_MANIFEST_LIMITS,
} from "./zipManifestConstants";
import { isPreviewEligible } from "./fileClassifier";
import type { ZipInventoryFile } from "./zipCentralDirectory";

export type ProjectFileKind = "text" | "image" | "media" | "archive" | "binary" | "unknown";

export class ZipRejectedError extends Error {
  constructor(
    message: string,
    public readonly reason: string,
  ) {
    super(message);
    this.name = "ZipRejectedError";
  }
}

export interface NormalizedZipPath {
  path: string | null;
  reason?: string;
}

export interface ManifestEntry {
  path: string;
  file_name: string;
  extension: string | null;
  size_bytes: number;
  content_sha256: string | null;
  checksum: string | null;
  mime_type: string;
  is_text: boolean;
  is_previewable: boolean;
  skipped: boolean;
  skip_reason: string | null;
  indexed_at: string;
  metadata: Record<string, Json>;
}

export function extensionForPath(path: string): string | null {
  const name = path.split("/").at(-1) ?? path;
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return null;
  return name.slice(index + 1).toLowerCase();
}

export function normalizeZipPath(rawPath: string): NormalizedZipPath {
  if (!rawPath || rawPath.includes("\0")) return { path: null, reason: "invalid_path" };

  const path = rawPath
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
  const lowerPath = path.toLowerCase();

  if (!path) return { path: null, reason: "empty_path" };
  if (path.length > ZIP_MANIFEST_LIMITS.maxPathLength) {
    return { path: null, reason: "path_too_long" };
  }

  if (path.startsWith("/") || /^[a-z]:\//i.test(path) || path.startsWith("//")) {
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

export function isUnsafeZipPath(rawPath: string): boolean {
  return normalizeZipPath(rawPath).path === null;
}

export function classifyProjectFile(path: string): ProjectFileKind {
  const extension = extensionForPath(path);
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
      "scss",
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

export function isPreviewableTextFile(file: ZipInventoryFile): boolean {
  return isPreviewEligible(file).allowed;
}

export function getSkipReason(file: ZipInventoryFile): string | null {
  const eligibility = isPreviewEligible(file);
  return eligibility.allowed ? null : (eligibility.reason ?? "not_previewable");
}

export function shouldIndexProjectFile(file: ZipInventoryFile): boolean {
  return !getSkipReason(file);
}

export function createManifestEntry(file: ZipInventoryFile, indexedAt = new Date().toISOString()) {
  const skipReason = getSkipReason(file);
  const isText = file.mime_type === "text";
  const isPreviewable = skipReason === null;

  return {
    path: file.path,
    file_name: file.name,
    extension: file.extension,
    size_bytes: file.size_bytes,
    content_sha256: null,
    checksum: file.checksum,
    mime_type: file.mime_type,
    is_text: isText,
    is_previewable: isPreviewable,
    skipped: !isPreviewable,
    skip_reason: skipReason,
    indexed_at: indexedAt,
    metadata: {
      compressed_size: file.compressed_size,
      compression_method: file.compression_method,
    },
  } satisfies ManifestEntry;
}
