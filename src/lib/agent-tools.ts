import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  AgentFileInfo,
  AgentFilePreview,
  AgentContextBundle,
  AgentToolResult,
} from "./agent-types";

export type { AgentContextBundle } from "./agent-types";

const MAX_PREVIEW_BYTES = 50000;
const MAX_FILE_COUNT = 50;

export async function listProjectFiles(
  supabase: SupabaseClient<Database>,
  projectId: string,
): Promise<AgentToolResult> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path,name,extension,size_bytes,mime_type")
    .eq("project_id", projectId)
    .limit(MAX_FILE_COUNT);

  if (error) {
    return { success: false, error: error.message };
  }

  const files: AgentFileInfo[] = (data || []).map((row) => ({
    path: row.path,
    name: row.name,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
  }));

  return { success: true, data: files };
}

export async function readProjectFile(
  supabase: SupabaseClient<Database>,
  projectId: string,
  filePath: string,
): Promise<AgentToolResult> {
  const { data, error } = await supabase
    .from("project_text_previews")
    .select("preview_text,summary,detected_language,truncated,token_estimate")
    .eq("project_id", projectId)
    .limit(1);

  if (error) {
    return { success: false, error: error.message };
  }

  const fileResult = data?.[0];

  if (!fileResult) {
    return { success: false, error: "File not found or not previewable" };
  }

  return {
    success: true,
    data: {
      path: filePath,
      previewText: fileResult.preview_text || "",
      summary: fileResult.summary || "",
      detectedLanguage: fileResult.detected_language,
      truncated: fileResult.truncated,
      tokenEstimate: fileResult.token_estimate,
    },
  };
}

export async function searchProjectFiles(
  supabase: SupabaseClient<Database>,
  projectId: string,
  pattern: string,
): Promise<AgentToolResult> {
  const { data, error } = await supabase
    .from("project_files")
    .select("path,name,extension,size_bytes,mime_type")
    .eq("project_id", projectId)
    .ilike("path", `%${pattern}%`)
    .limit(MAX_FILE_COUNT);

  if (error) {
    return { success: false, error: error.message };
  }

  const files: AgentFileInfo[] = (data || []).map((row) => ({
    path: row.path,
    name: row.name,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
  }));

  return { success: true, data: files };
}

export async function buildContextBundle(
  supabase: SupabaseClient<Database>,
  projectId: string,
  maxBytes: number = MAX_PREVIEW_BYTES,
): Promise<AgentContextBundle> {
  const projectResult = await supabase.from("projects").select("name").eq("id", projectId).single();
  const projectName = projectResult.data?.name || undefined;

  const { data: files } = await supabase
    .from("project_files")
    .select("id,path,name,extension,size_bytes,mime_type")
    .eq("project_id", projectId)
    .eq("is_text", true)
    .eq("skipped", false)
    .order("size_bytes", { ascending: false })
    .limit(MAX_FILE_COUNT);

  const { data: previews } = await supabase
    .from("project_text_previews")
    .select("file_id,preview_text,summary,detected_language,truncated,token_estimate")
    .eq("project_id", projectId);

  const fileInfos: AgentFileInfo[] = (files || []).map((row) => ({
    path: row.path,
    name: row.name,
    extension: row.extension,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
  }));

  const filePreviews: AgentFilePreview[] = [];
  let totalBytes = 0;
  let trimmed = false;

  for (const preview of previews || []) {
    const file = files?.find((f) => f.id === preview.file_id);
    if (!file) continue;

    const previewBytes = Buffer.byteLength(preview.preview_text || "");
    if (totalBytes + previewBytes > maxBytes && filePreviews.length > 0) {
      trimmed = true;
      break;
    }
    totalBytes += previewBytes;
    filePreviews.push({
      path: file.path,
      previewText: preview.preview_text || "",
      summary: preview.summary || "",
      detectedLanguage: preview.detected_language,
      truncated: preview.truncated,
      tokenEstimate: preview.token_estimate,
    });
  }

  return {
    projectId,
    projectName,
    files: fileInfos,
    previews: filePreviews,
    totalBytes,
    trimmed,
  };
}

export function selectRelevantFiles(
  bundle: AgentContextBundle,
  instruction: string,
  maxFiles: number = 20,
): AgentFilePreview[] {
  const instructionLower = instruction.toLowerCase();
  const keywords = instructionLower
    .split(/\s+/)
    .filter((k) => k.length > 2)
    .filter(
      (k) => !["and", "the", "for", "with", "this", "that", "are", "was", "were"].includes(k),
    );

  const scored = bundle.previews.map((preview) => {
    let score = 0;
    const pathLower = preview.path.toLowerCase();
    const textLower = preview.previewText.toLowerCase();
    const summaryLower = preview.summary.toLowerCase();

    for (const keyword of keywords) {
      if (pathLower.includes(keyword)) score += 3;
      if (textLower.includes(keyword)) score += 2;
      if (summaryLower.includes(keyword)) score += 1;
    }

    if (preview.path.endsWith(".ts") || preview.path.endsWith(".tsx")) score += 1;
    if (preview.path.endsWith(".js") || preview.path.endsWith(".jsx")) score += 1;
    if (preview.path.endsWith(".json")) score += 1;
    if (preview.path.includes("package.json")) score += 2;
    if (preview.path.includes("README")) score += 2;

    return { preview, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxFiles)
    .map((s) => s.preview);
}
