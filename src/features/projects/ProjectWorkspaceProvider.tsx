import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useProjectsQuery } from "./projectQueries";
import { getProjectManifest } from "./projectManifest";
import { ProjectWorkspaceContext } from "./projectWorkspaceContext";
import type { ProjectChatMetadata } from "./types";

export function ProjectWorkspaceProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const { data: projects = [], isLoading } = useProjectsQuery(enabled);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (projects.length === 0) {
      setSelectedProjectId(null);
      return;
    }

    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const activeProjectMetadata = useMemo<ProjectChatMetadata | null>(() => {
    if (!activeProject) return null;
    return {
      name: activeProject.name,
      source_type: activeProject.source_type,
      status: activeProject.status,
      ingestion_status: activeProject.latest_job?.status ?? "none",
      manifest: getProjectManifest(activeProject),
    };
  }, [activeProject]);

  return (
    <ProjectWorkspaceContext.Provider
      value={{
        projects,
        projectsLoading: isLoading,
        selectedProjectId,
        setSelectedProjectId,
        activeProject,
        activeProjectMetadata,
      }}
    >
      {children}
    </ProjectWorkspaceContext.Provider>
  );
}
