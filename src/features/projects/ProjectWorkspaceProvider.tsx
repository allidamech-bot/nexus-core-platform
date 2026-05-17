import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useProjectsQuery, useProjectTextPreviewsQuery } from "./projectQueries";
import { shapeProjectPreviewsForContext } from "./contextShaper";
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
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<string[]>([]);
  const projectSelectionKey = useMemo(
    () => projects.map((project) => project.id).join("|"),
    [projects],
  );

  useEffect(() => {
    setSelectedProjectId((currentProjectId) => {
      if (projects.length === 0) return currentProjectId === null ? currentProjectId : null;
      if (currentProjectId && projects.some((project) => project.id === currentProjectId)) {
        return currentProjectId;
      }
      return projects[0].id;
    });
  }, [projects, projectSelectionKey]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );
  const { data: activeProjectPreviews = [], isLoading: activeProjectPreviewsLoading } =
    useProjectTextPreviewsQuery(activeProject?.id ?? null);

  useEffect(() => {
    setSelectedPreviewIds([]);
  }, [activeProject?.id]);

  const activeProjectMetadata = useMemo<ProjectChatMetadata | null>(() => {
    if (!activeProject) return null;
    const selectedPreviews =
      selectedPreviewIds.length === 0
        ? []
        : activeProjectPreviews.filter((preview) => selectedPreviewIds.includes(preview.id));
    return {
      name: activeProject.name,
      source_type: activeProject.source_type,
      status: activeProject.status,
      ingestion_status: activeProject.latest_job?.status ?? "none",
      manifest: getProjectManifest(activeProject),
      previews: shapeProjectPreviewsForContext(selectedPreviews),
    };
  }, [activeProject, activeProjectPreviews, selectedPreviewIds]);

  const contextValue = useMemo(
    () => ({
      projects,
      projectsLoading: isLoading,
      selectedProjectId,
      setSelectedProjectId,
      activeProject,
      activeProjectPreviews,
      activeProjectPreviewsLoading,
      selectedPreviewIds,
      setSelectedPreviewIds,
      activeProjectMetadata,
    }),
    [
      activeProject,
      activeProjectMetadata,
      activeProjectPreviews,
      activeProjectPreviewsLoading,
      isLoading,
      projects,
      selectedProjectId,
      selectedPreviewIds,
    ],
  );

  return (
    <ProjectWorkspaceContext.Provider value={contextValue}>
      {children}
    </ProjectWorkspaceContext.Provider>
  );
}
