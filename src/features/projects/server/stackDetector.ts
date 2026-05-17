import type { ProjectStackHint } from "../types";

const ROOT_CONFIG_MATCHERS: Array<{ file: string; label: string }> = [
  { file: "package.json", label: "Node package manifest" },
  { file: "vite.config.ts", label: "Vite config" },
  { file: "vite.config.js", label: "Vite config" },
  { file: "vite.config.mjs", label: "Vite config" },
  { file: "next.config.js", label: "Next.js config" },
  { file: "next.config.ts", label: "Next.js config" },
  { file: "next.config.mjs", label: "Next.js config" },
  { file: "tsconfig.json", label: "TypeScript config" },
  { file: "pubspec.yaml", label: "Flutter manifest" },
  { file: "cargo.toml", label: "Rust manifest" },
  { file: "requirements.txt", label: "Python requirements" },
  { file: "pyproject.toml", label: "Python project manifest" },
  { file: "pom.xml", label: "Maven project manifest" },
];

function addHint(
  hints: ProjectStackHint[],
  kind: ProjectStackHint["kind"],
  name: string,
  evidence: string,
) {
  if (hints.some((hint) => hint.kind === kind && hint.name === name)) return;
  hints.push({ kind, name, evidence });
}

export function detectStackFromPaths(paths: string[]): {
  languages: string[];
  frameworks: string[];
  packageManagers: string[];
  rootConfigFiles: string[];
  likelyEntryPoints: string[];
  stackHints: ProjectStackHint[];
} {
  const lowerPaths = new Set(paths.map((path) => path.toLowerCase()));
  const rootFiles = new Set(
    paths.filter((path) => !path.includes("/")).map((path) => path.toLowerCase()),
  );
  const hints: ProjectStackHint[] = [];

  if (rootFiles.has("package.json"))
    addHint(hints, "language", "JavaScript/TypeScript", "package.json");
  if (rootFiles.has("tsconfig.json")) addHint(hints, "language", "TypeScript", "tsconfig.json");
  if (rootFiles.has("pubspec.yaml")) {
    addHint(hints, "language", "Dart", "pubspec.yaml");
    addHint(hints, "framework", "Flutter", "pubspec.yaml");
  }
  if (rootFiles.has("cargo.toml")) addHint(hints, "language", "Rust", "Cargo.toml");
  if (rootFiles.has("requirements.txt") || rootFiles.has("pyproject.toml")) {
    addHint(
      hints,
      "language",
      "Python",
      rootFiles.has("pyproject.toml") ? "pyproject.toml" : "requirements.txt",
    );
  }
  if (rootFiles.has("pom.xml")) {
    addHint(hints, "language", "Java", "pom.xml");
    addHint(hints, "package_manager", "Maven", "pom.xml");
  }

  for (const config of ROOT_CONFIG_MATCHERS) {
    if (rootFiles.has(config.file)) addHint(hints, "config", config.label, config.file);
  }

  if (["vite.config.ts", "vite.config.js", "vite.config.mjs"].some((file) => rootFiles.has(file))) {
    addHint(hints, "framework", "Vite", "vite.config.*");
  }
  if (["next.config.js", "next.config.ts", "next.config.mjs"].some((file) => rootFiles.has(file))) {
    addHint(hints, "framework", "Next.js", "next.config.*");
  }

  if (rootFiles.has("bun.lock")) addHint(hints, "package_manager", "Bun", "bun.lock");
  if (rootFiles.has("package-lock.json"))
    addHint(hints, "package_manager", "npm", "package-lock.json");
  if (rootFiles.has("pnpm-lock.yaml")) addHint(hints, "package_manager", "pnpm", "pnpm-lock.yaml");
  if (rootFiles.has("yarn.lock")) addHint(hints, "package_manager", "Yarn", "yarn.lock");

  for (const entryPoint of [
    "src/main.tsx",
    "src/main.ts",
    "src/app.tsx",
    "src/app.ts",
    "src/index.tsx",
    "src/index.ts",
    "app/page.tsx",
    "pages/index.tsx",
    "main.py",
    "src/main.rs",
    "lib/main.dart",
  ]) {
    if (lowerPaths.has(entryPoint)) addHint(hints, "entry_point", entryPoint, entryPoint);
  }

  return {
    languages: hints
      .filter((hint) => hint.kind === "language")
      .map((hint) => hint.name)
      .sort(),
    frameworks: hints
      .filter((hint) => hint.kind === "framework")
      .map((hint) => hint.name)
      .sort(),
    packageManagers: hints
      .filter((hint) => hint.kind === "package_manager")
      .map((hint) => hint.name)
      .sort(),
    rootConfigFiles: hints
      .filter((hint) => hint.kind === "config")
      .map((hint) => hint.evidence)
      .sort(),
    likelyEntryPoints: hints
      .filter((hint) => hint.kind === "entry_point")
      .map((hint) => hint.name)
      .sort(),
    stackHints: hints,
  };
}
