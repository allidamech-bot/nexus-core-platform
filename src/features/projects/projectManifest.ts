import type { Json } from "@/integrations/supabase/types";
import type { ProjectManifest, ProjectWithLatestJob } from "./types";

function isManifest(value: unknown): value is ProjectManifest {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as { version?: unknown }).version === 1 &&
    typeof (value as { file_count?: unknown }).file_count === "number"
  );
}

export function getProjectManifest(project: ProjectWithLatestJob | null): ProjectManifest | null {
  const metadata = project?.latest_job?.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const manifest = metadata.manifest;
  return isManifest(manifest) ? manifest : null;
}
