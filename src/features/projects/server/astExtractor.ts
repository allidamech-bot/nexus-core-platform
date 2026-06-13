export interface AstExtractionResult {
  exports: string[];
  imports: string[];
  interfaces: string[];
  functions: string[];
}

const EMPTY_AST_RESULT: AstExtractionResult = {
  exports: [],
  imports: [],
  interfaces: [],
  functions: [],
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function stripComments(sourceText: string): string {
  return sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function collectMatches(sourceText: string, regex: RegExp, groupIndex = 1): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sourceText)) !== null) {
    const value = match[groupIndex]?.trim();
    if (value) {
      matches.push(value);
    }
  }

  return matches;
}

function extractExportNames(sourceText: string): string[] {
  const namedExports = collectMatches(sourceText, /\bexport\s*\{([^}]+)\}/g).flatMap((group) =>
    group
      .split(",")
      .map(
        (part) =>
          part
            .trim()
            .split(/\s+as\s+/i)
            .pop()
            ?.trim() ?? "",
      )
      .filter(Boolean),
  );
  const hasDefaultExport = /\bexport\s+default\b/.test(sourceText);

  return unique([
    ...(hasDefaultExport ? ["default"] : []),
    ...collectMatches(
      sourceText,
      /\bexport\s+(?:declare\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/g,
    ),
    ...collectMatches(
      sourceText,
      /\bexport\s+default\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g,
    ),
    ...namedExports,
  ]);
}

function extractImportSpecifiers(sourceText: string): string[] {
  return unique([
    ...collectMatches(sourceText, /\bimport\s+(?:type\s+)?[\s\S]*?\s+from\s+["']([^"']+)["']/g),
    ...collectMatches(sourceText, /\bimport\s+["']([^"']+)["']/g),
    ...collectMatches(sourceText, /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g),
  ]);
}

function extractFunctionNames(sourceText: string): string[] {
  return unique([
    ...collectMatches(
      sourceText,
      /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    ),
    ...collectMatches(
      sourceText,
      /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g,
    ),
  ]);
}

export function extractAstMetadata(filePath: string, sourceText: string): AstExtractionResult {
  if (
    !filePath.endsWith(".ts") &&
    !filePath.endsWith(".tsx") &&
    !filePath.endsWith(".js") &&
    !filePath.endsWith(".jsx")
  ) {
    return EMPTY_AST_RESULT;
  }

  const MAX_AST_SOURCE_LENGTH = 150_000;
  if (sourceText.length > MAX_AST_SOURCE_LENGTH) {
    console.warn(
      `[AST Extractor] Skipping metadata scan for ${filePath} (exceeds ${MAX_AST_SOURCE_LENGTH} chars)`,
    );
    return EMPTY_AST_RESULT;
  }

  try {
    const searchableSource = stripComments(sourceText);

    return {
      exports: extractExportNames(searchableSource),
      imports: extractImportSpecifiers(searchableSource),
      interfaces: unique(collectMatches(searchableSource, /\binterface\s+([A-Za-z_$][\w$]*)/g)),
      functions: extractFunctionNames(searchableSource),
    };
  } catch (error) {
    console.error(`AST metadata scan failed for ${filePath}:`, error);
    return EMPTY_AST_RESULT;
  }
}
