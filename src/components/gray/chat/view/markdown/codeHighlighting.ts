export type CodeTokenType = "Plain" | "Keyword" | "String" | "Comment" | "Number" | "Builtin" | "Literal";

type CodeToken = {
  type: CodeTokenType;
  content: string;
};

export type CodeLine = CodeToken[];

type BlockPattern = { start: string; end: string };

type LanguageRule = {
  keywords: Set<string>;
  builtins: Set<string>;
  literals: Set<string>;
  commentSymbols: string[];
  blockComments?: BlockPattern[];
  tripleQuotes?: string[];
  stringDelimiters: string[];
  templateStrings?: boolean;
};

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  bash: "shell",
  sh: "shell",
  shell: "shell",
  json5: "json",
  yml: "yaml",
  md: "markdown",
};

const LANGUAGE_RULES: Record<string, LanguageRule> = {
  javascript: {
    keywords: new Set([
      "import",
      "from",
      "export",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "continue",
      "function",
      "class",
      "extends",
      "new",
      "try",
      "catch",
      "finally",
      "await",
      "async",
      "throw",
      "yield",
      "in",
      "of",
      "instanceof",
      "typeof",
      "void",
    ]),
    builtins: new Set([
      "console",
      "Math",
      "Date",
      "Promise",
      "Array",
      "String",
      "Number",
      "Boolean",
      "Object",
      "Set",
      "Map",
      "JSON",
    ]),
    literals: new Set(["true", "false", "null", "undefined", "NaN"]),
    commentSymbols: ["//"],
    blockComments: [{ start: "/*", end: "*/" }],
    stringDelimiters: ['"', "'", "`"],
    templateStrings: true,
  },
  typescript: {
    keywords: new Set([
      "import",
      "from",
      "export",
      "const",
      "let",
      "var",
      "return",
      "if",
      "else",
      "for",
      "while",
      "switch",
      "case",
      "break",
      "continue",
      "function",
      "class",
      "extends",
      "implements",
      "new",
      "try",
      "catch",
      "finally",
      "await",
      "async",
      "throw",
      "yield",
      "in",
      "of",
      "interface",
      "type",
      "enum",
      "namespace",
      "as",
      "keyof",
      "readonly",
      "public",
      "private",
      "protected",
      "abstract",
    ]),
    builtins: new Set([
      "string",
      "number",
      "boolean",
      "any",
      "unknown",
      "never",
      "void",
      "Record",
      "Partial",
      "Pick",
    ]),
    literals: new Set(["true", "false", "null", "undefined"]),
    commentSymbols: ["//"],
    blockComments: [{ start: "/*", end: "*/" }],
    stringDelimiters: ['"', "'", "`"],
    templateStrings: true,
  },
  python: {
    keywords: new Set([
      "def",
      "class",
      "return",
      "if",
      "elif",
      "else",
      "for",
      "while",
      "try",
      "except",
      "finally",
      "import",
      "from",
      "as",
      "pass",
      "break",
      "continue",
      "with",
      "lambda",
      "yield",
      "global",
      "nonlocal",
      "assert",
      "async",
      "await",
      "raise",
    ]),
    builtins: new Set([
      "print",
      "len",
      "range",
      "dict",
      "list",
      "set",
      "int",
      "float",
      "str",
      "bool",
      "enumerate",
      "zip",
      "sum",
      "min",
      "max",
      "self",
    ]),
    literals: new Set(["True", "False", "None"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'", '"""', "'''"],
    tripleQuotes: ['"""', "'''"],
  },
  shell: {
    keywords: new Set([
      "if",
      "then",
      "elif",
      "else",
      "fi",
      "for",
      "while",
      "in",
      "do",
      "done",
      "case",
      "esac",
      "function",
    ]),
    builtins: new Set(["echo", "cd", "export", "local", "readonly", "eval", "printf", "test"]),
    literals: new Set(["true", "false"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'", "`"],
  },
  json: {
    keywords: new Set(),
    builtins: new Set(),
    literals: new Set(["true", "false", "null"]),
    commentSymbols: [],
    stringDelimiters: ['"'],
  },
  yaml: {
    keywords: new Set(["true", "false", "null"]),
    builtins: new Set(),
    literals: new Set(["true", "false", "null"]),
    commentSymbols: ["#"],
    stringDelimiters: ['"', "'"],
  },
  markdown: {
    keywords: new Set(),
    builtins: new Set(),
    literals: new Set(),
    commentSymbols: [],
    stringDelimiters: ['"', "'"],
  },
};

const DEFAULT_LANGUAGE = "javascript";

export const getLanguageId = (value?: string | null): string => {
  if (!value) {
    return DEFAULT_LANGUAGE;
  }
  const normalized = value.toLowerCase();
  if (LANGUAGE_RULES[normalized]) {
    return normalized;
  }
  return LANGUAGE_ALIASES[normalized] ?? DEFAULT_LANGUAGE;
};

const getLanguageRule = (language: string): LanguageRule => {
  return LANGUAGE_RULES[language] ?? LANGUAGE_RULES[DEFAULT_LANGUAGE];
};

const isIdentifierStart = (char: string) => /[A-Za-z_]/.test(char);
const isIdentifierPart = (char: string) => /[A-Za-z0-9_]/.test(char);
const isDigit = (char: string) => /[0-9]/.test(char);

const pushToken = (line: CodeLine, type: CodeTokenType, content: string) => {
  if (!content) {
    return;
  }
  const last = line[line.length - 1];
  if (last && last.type === type) {
    last.content += content;
    return;
  }
  line.push({ type, content });
};

const readString = (text: string, startIndex: number, delimiter: string) => {
  const parts: string[] = [];
  let i = startIndex;
  const delimiterLength = delimiter.length;
  const advance = (step = 1) => {
    parts.push(text.slice(i, i + step));
    i += step;
  };

  advance(delimiterLength);

  while (i < text.length) {
    if (text[i] === "\\" && i + 1 < text.length) {
      advance(2);
      continue;
    }
    if (text.startsWith(delimiter, i)) {
      advance(delimiterLength);
      break;
    }
    advance(1);
  }

  return { value: parts.join(""), end: i };
};

const TAB_SIZE = 4;

const expandTabs = (line: string): string => {
  let result = "";
  let column = 0;
  for (const char of line) {
    if (char === "\t") {
      const remainder = column % TAB_SIZE;
      const spacesToAdd = remainder === 0 ? TAB_SIZE : TAB_SIZE - remainder;
      result += " ".repeat(spacesToAdd);
      column += spacesToAdd;
    } else {
      result += char;
      column += 1;
    }
  }
  return result;
};

export const stripUniformIndent = (code: string): string => {
  // Normalize newlines
  const normalized = code.replace(/\r\n/g, "\n");
  const rawLines = normalized.split("\n");

  // Expand tabs so the visual indent is stable
  const lines = rawLines.map(expandTabs);

  // If everything is blank, return empty
  if (lines.every((line) => !line.trim())) {
    return "";
  }

  // Compute minimal leading-space indent across all non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^ +/);
    const indent = match ? match[0].length : 0;
    if (indent < minIndent) {
      minIndent = indent;
      if (minIndent === 0) break;
    }
  }

  if (!Number.isFinite(minIndent) || minIndent <= 0) {
    // No uniform indent to strip; return original (with normalized newlines/tabs expanded)
    return lines.join("\n");
  }

  // Strip that uniform indent while preserving relative indentation and blank lines
  const result = lines.map((line) => {
    if (!line.trim()) {
      return "";
    }
    // Only slice if the line actually has at least minIndent leading spaces
    if (line.startsWith(" ".repeat(minIndent))) {
      return line.slice(minIndent);
    }
    return line;
  });

  return result.join("\n");
};

export const tokenizeCode = (code: string, language: string): CodeLine[] => {
  const rule = getLanguageRule(language);
  const lines = code.split(/\r?\n/).map(expandTabs);
  const tokenLines: CodeLine[] = [];
  let activeBlock: BlockPattern | null = null;
  let activeBlockType: CodeTokenType = "Comment";
  let activeMultilineString: string | null = null;

  for (const line of lines) {
    const tokens: CodeLine = [];
    let i = 0;
    while (i < line.length) {
      const rest = line.slice(i);

      if (activeMultilineString) {
        const closingIndex = rest.indexOf(activeMultilineString);
        if (closingIndex === -1) {
          pushToken(tokens, "String", rest);
          i = line.length;
          continue;
        }
        const chunk = rest.slice(0, closingIndex + activeMultilineString.length);
        pushToken(tokens, "String", chunk);
        i += closingIndex + activeMultilineString.length;
        activeMultilineString = null;
        continue;
      }

      if (activeBlock) {
        const closingIndex = rest.indexOf(activeBlock.end);
        if (closingIndex === -1) {
          pushToken(tokens, activeBlockType, rest);
          i = line.length;
          continue;
        }
        const chunk = rest.slice(0, closingIndex + activeBlock.end.length);
        pushToken(tokens, activeBlockType, chunk);
        i += closingIndex + activeBlock.end.length;
        activeBlock = null;
        continue;
      }

      if (rule.tripleQuotes) {
        const triple = rule.tripleQuotes.find((quote) => rest.startsWith(quote));
        if (triple) {
          activeMultilineString = triple;
          pushToken(tokens, "String", triple);
          i += triple.length;
          continue;
        }
      }

      if (rule.blockComments) {
        const block = rule.blockComments.find((pattern) => rest.startsWith(pattern.start));
        if (block) {
          const closingIndex = rest.indexOf(block.end);
          if (closingIndex === -1) {
            pushToken(tokens, "Comment", rest);
            i = line.length;
            activeBlock = block;
            activeBlockType = "Comment";
            continue;
          }
          const chunk = rest.slice(0, closingIndex + block.end.length);
          pushToken(tokens, "Comment", chunk);
          i += closingIndex + block.end.length;
          continue;
        }
      }

      const commentSymbol = rule.commentSymbols.find((symbol) => rest.startsWith(symbol));
      if (commentSymbol) {
        pushToken(tokens, "Comment", rest);
        break;
      }

      const stringDelimiter = rule.stringDelimiters.find((delimiter) => rest.startsWith(delimiter));
      if (stringDelimiter) {
        if (rule.tripleQuotes?.includes(stringDelimiter) && rest.length === stringDelimiter.length) {
          pushToken(tokens, "String", stringDelimiter);
          i += stringDelimiter.length;
          activeMultilineString = stringDelimiter;
          continue;
        }

        const { value, end } = readString(line, i, stringDelimiter);
        pushToken(tokens, "String", value);
        i = end;
        continue;
      }

      if (rule.templateStrings && rest.startsWith("`")) {
        const { value, end } = readString(line, i, "`");
        pushToken(tokens, "String", value);
        i = end;
        continue;
      }

      if (isDigit(rest[0])) {
        let j = 1;
        while (j < rest.length && /[0-9xXa-fA-F._]/.test(rest[j])) {
          j += 1;
        }
        pushToken(tokens, "Number", rest.slice(0, j));
        i += j;
        continue;
      }

      if (isIdentifierStart(rest[0])) {
        let j = 1;
        while (j < rest.length && isIdentifierPart(rest[j])) {
          j += 1;
        }
        const word = rest.slice(0, j);
        if (rule.keywords.has(word)) {
          pushToken(tokens, "Keyword", word);
        } else if (rule.builtins.has(word)) {
          pushToken(tokens, "Builtin", word);
        } else if (rule.literals.has(word)) {
          pushToken(tokens, "Literal", word);
        } else {
          pushToken(tokens, "Plain", word);
        }
        i += j;
        continue;
      }

      pushToken(tokens, "Plain", rest[0]);
      i += 1;
    }

    tokenLines.push(tokens.length > 0 ? tokens : [{ type: "Plain", content: "" }]);
  }

  return tokenLines;
};

export const SINGLE_TOKEN_CODE_PATTERN = /^[\w.$-]+$/;
export const CODE_LIKE_PATTERN =
  /[{}()[\];<>]|=>|:=|const\s+|let\s+|var\s+|function\s+|class\s+|return\s+|if\s+|else\s+|for\s+|while\s+|async\s+|await\s+|def\s+|import\s+|from\s+|try\s+|catch\s+|#include|<\?php/;
export const LATEX_MATH_BLOCK_PATTERN = /^\s*(\$\$[\s\S]*\$\$|\\\[[\s\S]*\\\])\s*$/;

