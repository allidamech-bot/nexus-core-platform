import type { Json } from "@/integrations/supabase/types";
import type { ProjectTextPreview } from "../types";
import { detectLanguageForPath, isPreviewEligible, summarizeFile } from "./fileClassifier";
import { containsLikelySecret, redactSecrets } from "./previewSanitizer";
import { TEXT_PREVIEW_LIMITS } from "./textPreviewConstants";
import { readZipEntryBytes, type ZipInventoryFile } from "./zipCentralDirectory";

export interface GeneratedTextPreview {
  path: string;
  preview_text: string;
  summary: string;
  detected_language: string | null;
  truncated: boolean;
  line_count: number;
  token_estimate: number;
  metadata: Record<string, Json>;
}

export interface TextPreviewIndexResult {
  previews: GeneratedTextPreview[];
  skipped: Record<string, number>;
  suspicious: Array<{ path: string; reason: string }>;
  totalIndexedBytes: number;
}

function increment(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function hasBinarySignature(bytes: Uint8Array): boolean {
  if (bytes.length >= 4) {
    const signature = Array.from(bytes.slice(0, 4))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
    if (
      ["89504e47", "ffd8ffe0", "ffd8ffe1", "504b0304", "7f454c46", "cafebabe"].includes(signature)
    ) {
      return true;
    }
  }

  const sample = bytes.slice(0, Math.min(bytes.length, 1024));
  return sample.includes(0);
}

function decodeUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function isMinifiedOrUnsafeLines(lines: string[]): boolean {
  if (lines.some((line) => line.length > TEXT_PREVIEW_LIMITS.maxLineLength)) return true;
  if (lines.length <= 3 && lines.join("").length > 3_000) return true;
  return false;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function buildPreviewText(text: string): {
  preview: string;
  truncated: boolean;
  lineCount: number;
} {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").slice(0, TEXT_PREVIEW_LIMITS.maxLines);
  const joined = lines.join("\n");
  const truncated =
    normalized.length > TEXT_PREVIEW_LIMITS.maxPreviewChars ||
    normalized.split("\n").length > TEXT_PREVIEW_LIMITS.maxLines;

  return {
    preview: joined.slice(0, TEXT_PREVIEW_LIMITS.maxPreviewChars),
    truncated,
    lineCount: lines.length,
  };
}

export async function generateTextPreviewsFromArchive(
  archiveBytes: Uint8Array,
  files: ZipInventoryFile[],
): Promise<TextPreviewIndexResult> {
  const previews: GeneratedTextPreview[] = [];
  const skipped: Record<string, number> = {};
  const suspicious: Array<{ path: string; reason: string }> = [];
  let totalIndexedBytes = 0;

  for (const file of files) {
    if (previews.length >= TEXT_PREVIEW_LIMITS.maxPreviewRows) {
      increment(skipped, "preview_count_limit");
      continue;
    }

    const eligibility = isPreviewEligible(file);
    if (!eligibility.allowed) {
      increment(skipped, eligibility.reason ?? "not_previewable");
      continue;
    }

    if (totalIndexedBytes + file.size_bytes > TEXT_PREVIEW_LIMITS.maxTotalBytes) {
      increment(skipped, "preview_total_size_limit");
      continue;
    }

    let entryBytes: Uint8Array;
    try {
      entryBytes = await readZipEntryBytes(archiveBytes, file);
    } catch {
      increment(skipped, "entry_read_failed");
      suspicious.push({ path: file.path, reason: "entry_read_failed" });
      continue;
    }

    if (entryBytes.byteLength > TEXT_PREVIEW_LIMITS.maxFileBytes) {
      increment(skipped, "preview_file_too_large");
      continue;
    }

    if (hasBinarySignature(entryBytes)) {
      increment(skipped, "binary_signature");
      suspicious.push({ path: file.path, reason: "binary_signature" });
      continue;
    }

    const decoded = decodeUtf8(entryBytes);
    if (decoded === null) {
      increment(skipped, "invalid_utf8");
      suspicious.push({ path: file.path, reason: "invalid_utf8" });
      continue;
    }

    if (containsLikelySecret(decoded)) {
      increment(skipped, "secret_like_content");
      suspicious.push({ path: file.path, reason: "secret_like_content" });
      continue;
    }

    const lines = decoded.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    if (isMinifiedOrUnsafeLines(lines)) {
      increment(skipped, "unsafe_line_shape");
      continue;
    }

    const built = buildPreviewText(decoded);
    const redacted = redactSecrets(built.preview);
    const tokenEstimate = estimateTokens(redacted.text);

    previews.push({
      path: file.path,
      preview_text: redacted.text,
      summary: summarizeFile(file.path),
      detected_language: detectLanguageForPath(file.path),
      truncated: built.truncated,
      line_count: built.lineCount,
      token_estimate: tokenEstimate,
      metadata: {
        source: "zip_text_preview_v1",
        size_bytes: file.size_bytes,
        checksum: file.checksum,
        redacted: redacted.redacted,
      },
    });
    totalIndexedBytes += file.size_bytes;
  }

  return { previews, skipped, suspicious, totalIndexedBytes };
}

export function toContextPreview(preview: ProjectTextPreview, path: string) {
  return {
    path,
    summary: preview.summary,
    detected_language: preview.detected_language,
    preview_text: preview.preview_text,
    truncated: preview.truncated,
    token_estimate: preview.token_estimate,
  };
}
