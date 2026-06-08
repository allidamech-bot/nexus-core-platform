import { Project, ScriptTarget, SyntaxKind } from "ts-morph";

export interface AstExtractionResult {
  exports: string[];
  imports: string[];
  interfaces: string[];
  functions: string[];
}

export function extractAstMetadata(filePath: string, sourceText: string): AstExtractionResult {
  if (
    !filePath.endsWith(".ts") &&
    !filePath.endsWith(".tsx") &&
    !filePath.endsWith(".js") &&
    !filePath.endsWith(".jsx")
  ) {
    return { exports: [], imports: [], interfaces: [], functions: [] };
  }

  // Guard against massive files that will OOM ts-morph
  const MAX_AST_SOURCE_LENGTH = 150_000;
  if (sourceText.length > MAX_AST_SOURCE_LENGTH) {
    console.warn(
      `[AST Extractor] Skipping full parsing for ${filePath} (exceeds ${MAX_AST_SOURCE_LENGTH} chars)`,
    );
    // Fallback to simple regex parsing if possible, or just truncate it.
    // Given the risk of invalid AST, we will return empty rather than crash.
    return { exports: [], imports: [], interfaces: [], functions: [] };
  }

  const project = new Project({
    compilerOptions: {
      target: ScriptTarget.Latest,
      allowJs: true,
    },
    useInMemoryFileSystem: true,
  });

  try {
    const sourceFile = project.createSourceFile(filePath, sourceText);

    const exports = sourceFile.getExportedDeclarations();
    const exportNames = Array.from(exports.keys());

    const imports = sourceFile.getImportDeclarations().map((imp) => imp.getModuleSpecifierValue());

    const interfaces = sourceFile.getInterfaces().map((intf) => intf.getName());

    const functions = sourceFile
      .getFunctions()
      .map((f) => f.getName())
      .filter((name): name is string => !!name);

    return {
      exports: exportNames,
      imports,
      interfaces,
      functions,
    };
  } catch (error) {
    console.error(`AST parsing failed for ${filePath}:`, error);
    return { exports: [], imports: [], interfaces: [], functions: [] };
  }
}
