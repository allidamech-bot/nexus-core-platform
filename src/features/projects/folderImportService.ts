import { PROJECT_UPLOAD_MAX_BYTES } from "./constants";

export const FOLDER_IMPORT_MAX_FILES = 600;
export const FOLDER_IMPORT_MAX_BYTES = PROJECT_UPLOAD_MAX_BYTES;

const IGNORED_SEGMENTS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  "vendor",
  ".turbo",
  ".cache",
]);

const BLOCKED_EXTENSIONS = new Set([
  "exe",
  "dll",
  "dylib",
  "so",
  "bin",
  "iso",
  "dmg",
  "pkg",
  "class",
  "jar",
  "wasm",
  "zip",
  "tar",
  "gz",
  "7z",
  "rar",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "mp4",
  "mov",
  "pdf",
]);

export interface FolderImportFile {
  file: File;
  path: string;
  name: string;
  extension: string | null;
}

export interface FolderImportSummary {
  accepted: FolderImportFile[];
  ignored: Array<{ path: string; reason: string }>;
  totalBytes: number;
  rootName: string;
  error: string | null;
}

function normalizePath(file: File): string {
  const path = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function extensionFor(path: string): string | null {
  const name = path.split("/").pop() ?? path;
  const index = name.lastIndexOf(".");
  if (index <= 0) return null;
  return name.slice(index + 1).toLowerCase();
}

function ignoredReason(path: string, file: File): string | null {
  const normalized = path.toLowerCase();
  const segments = normalized.split("/");
  if (segments.some((segment) => IGNORED_SEGMENTS.has(segment))) {
    return "Ignored workspace/cache directory";
  }
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return "Unsafe path";
  }
  const extension = extensionFor(normalized);
  if (extension && BLOCKED_EXTENSIONS.has(extension)) {
    return "Blocked binary or archive type";
  }
  if (file.size <= 0) return "Empty file";
  return null;
}

export function summarizeFolderFiles(files: File[]): FolderImportSummary {
  const accepted: FolderImportFile[] = [];
  const ignored: FolderImportSummary["ignored"] = [];
  let totalBytes = 0;

  for (const file of files) {
    const path = normalizePath(file);
    const reason = ignoredReason(path, file);
    if (reason) {
      ignored.push({ path, reason });
      continue;
    }
    if (accepted.length >= FOLDER_IMPORT_MAX_FILES) {
      ignored.push({ path, reason: "File count cap reached" });
      continue;
    }
    if (totalBytes + file.size > FOLDER_IMPORT_MAX_BYTES) {
      ignored.push({ path, reason: "Folder import size cap reached" });
      continue;
    }

    totalBytes += file.size;
    accepted.push({
      file,
      path,
      name: path.split("/").pop() ?? file.name,
      extension: extensionFor(path),
    });
  }

  const firstPath = accepted[0]?.path ?? files[0]?.name ?? "Imported folder";
  const rootName = firstPath.includes("/") ? firstPath.split("/")[0] : "Imported folder";

  return {
    accepted,
    ignored,
    totalBytes,
    rootName,
    error: accepted.length === 0 ? "No safe files were available for folder import." : null,
  };
}
