import type { ZipInventoryFile } from "./zipCentralDirectory";
import {
  ALLOWLISTED_TEXT_EXTENSIONS,
  ALLOWLISTED_TEXT_FILENAMES,
  BLOCKED_PREVIEW_SEGMENTS,
  TEXT_PREVIEW_LIMITS,
} from "./textPreviewConstants";

export interface PreviewEligibility {
  allowed: boolean;
  reason?: string;
}

function baseName(path: string): string {
  return path.split("/").at(-1)?.toLowerCase() ?? path.toLowerCase();
}

export function isPreviewEligible(file: ZipInventoryFile): PreviewEligibility {
  const name = baseName(file.path);
  const segments = file.path.toLowerCase().split("/");

  if (segments.some((segment) => BLOCKED_PREVIEW_SEGMENTS.has(segment))) {
    return { allowed: false, reason: "blocked_directory" };
  }

  if (name.startsWith(".") && !ALLOWLISTED_TEXT_FILENAMES.has(name)) {
    return { allowed: false, reason: "hidden_file" };
  }

  if (name === ".env") return { allowed: false, reason: "secret_file" };
  if (name.endsWith(".pem") || name.endsWith(".key") || name.endsWith(".p12")) {
    return { allowed: false, reason: "credential_file" };
  }

  if (file.size_bytes > TEXT_PREVIEW_LIMITS.maxFileBytes) {
    return { allowed: false, reason: "preview_file_too_large" };
  }

  if (file.mime_type !== "text" && !ALLOWLISTED_TEXT_FILENAMES.has(name)) {
    return { allowed: false, reason: "non_text_mime_category" };
  }

  if (ALLOWLISTED_TEXT_FILENAMES.has(name)) return { allowed: true };
  if (file.extension && ALLOWLISTED_TEXT_EXTENSIONS.has(file.extension)) return { allowed: true };

  return { allowed: false, reason: "unsupported_extension" };
}

export function detectLanguageForPath(path: string): string | null {
  const name = baseName(path);
  const extension = name.includes(".") ? name.split(".").at(-1) : null;

  if (name === ".env.example") return "Environment example";
  if (name === ".gitignore") return "Git ignore rules";

  switch (extension) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
      return "JavaScript";
    case "py":
      return "Python";
    case "dart":
      return "Dart";
    case "java":
      return "Java";
    case "rs":
      return "Rust";
    case "go":
      return "Go";
    case "sql":
      return "SQL";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "toml":
      return "TOML";
    case "md":
      return "Markdown";
    case "html":
      return "HTML";
    case "css":
    case "scss":
      return "Stylesheet";
    default:
      return extension ? extension.toUpperCase() : null;
  }
}

export function summarizeFile(path: string): string {
  const lower = path.toLowerCase();
  const language = detectLanguageForPath(path);

  if (lower.endsWith("vite.config.ts") || lower.endsWith("vite.config.js"))
    return "Vite configuration";
  if (lower.endsWith("next.config.ts") || lower.endsWith("next.config.js"))
    return "Next.js configuration";
  if (lower.endsWith("package.json")) return "Node package manifest";
  if (lower.endsWith("pubspec.yaml")) return "Flutter dependency manifest";
  if (lower.endsWith("cargo.toml")) return "Rust package manifest";
  if (lower.endsWith("requirements.txt")) return "Python dependency manifest";
  if (lower.endsWith("pyproject.toml")) return "Python project manifest";
  if (lower.endsWith("pom.xml")) return "Java Maven project manifest";
  if (lower.includes("migration") && lower.endsWith(".sql")) return "SQL migration file";
  if (lower.endsWith(".env.example")) return "Environment example file";
  if (lower.endsWith(".gitignore")) return "Git ignore rules";
  if (lower.endsWith(".tsx") || lower.endsWith(".jsx"))
    return `${language ?? "React"} React component`;
  if (lower.endsWith(".md")) return "Project documentation";

  return language ? `${language} source or configuration file` : "Text project file";
}
