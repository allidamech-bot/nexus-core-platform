import type { ProjectFile } from "./types";

export type ProjectFileTreeNode = ProjectFileTreeDirectory | ProjectFileTreeFile;

export interface ProjectFileTreeDirectory {
  type: "directory";
  name: string;
  path: string;
  children: ProjectFileTreeNode[];
}

export interface ProjectFileTreeFile {
  type: "file";
  name: string;
  path: string;
  file: ProjectFile;
}

function cleanDisplayPath(path: string) {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

function sortTree(nodes: ProjectFileTreeNode[]): ProjectFileTreeNode[] {
  return nodes
    .map((node) =>
      node.type === "directory" ? { ...node, children: sortTree(node.children) } : node,
    )
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
}

export function buildProjectFileTree(files: ProjectFile[]): ProjectFileTreeNode[] {
  const root: ProjectFileTreeDirectory = { type: "directory", name: "", path: "", children: [] };
  const seenPaths = new Set<string>();

  for (const file of files) {
    const safePath = cleanDisplayPath(file.path);
    if (!safePath || seenPaths.has(safePath)) continue;
    seenPaths.add(safePath);

    const parts = safePath.split("/");
    let cursor = root;

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const currentPath = parts.slice(0, index + 1).join("/");
      const isFile = index === parts.length - 1;

      if (isFile) {
        cursor.children.push({
          type: "file",
          name: part,
          path: currentPath,
          file: { ...file, path: safePath, name: file.name || part },
        });
        continue;
      }

      let directory = cursor.children.find(
        (child): child is ProjectFileTreeDirectory =>
          child.type === "directory" && child.path === currentPath,
      );
      if (!directory) {
        directory = { type: "directory", name: part, path: currentPath, children: [] };
        cursor.children.push(directory);
      }
      cursor = directory;
    }
  }

  return sortTree(root.children);
}

export function isSensitivePreviewPath(path: string) {
  const fileName = cleanDisplayPath(path).split("/").pop()?.toLowerCase() ?? "";
  if (fileName === ".env.example") return false;
  return fileName === ".env" || fileName.startsWith(".env.");
}
