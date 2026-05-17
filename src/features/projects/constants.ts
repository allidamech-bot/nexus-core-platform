export const PROJECT_UPLOAD_BUCKET = "project-uploads";
export const PROJECT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024;
export const PROJECT_UPLOAD_MAX_MB = PROJECT_UPLOAD_MAX_BYTES / 1024 / 1024;

export const ZIP_EXTENSION = ".zip";

export const DANGEROUS_FILENAME_TOKENS = [
  ".exe",
  ".dll",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".msi",
  ".scr",
  ".jar",
];
