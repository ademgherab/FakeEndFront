import type { JsonValue } from "@/lib/api/generated/schema";

export const MAX_PATH_LENGTH = 200;

export interface ParseProblem {
  message: string;
  line: number | null;
  column: number | null;
  position: number | null;
}

export type SampleParseResult =
  | { ok: true; value: JsonValue }
  | { ok: false; error: ParseProblem };

export type SampleRootKind = "object" | "array" | "scalar" | "null";

export interface SampleAnalysis {
  bytes: number;
  withinLimit: boolean;
  parsed: SampleParseResult | null;
  rootKind: SampleRootKind | null;
  jsonError: ParseProblem | null;
  rootError: string | null;
  sizeError: string | null;
  valid: boolean;
}

const encoder = new TextEncoder();

export function countBytes(text: string): number {
  return encoder.encode(text).length;
}

export function classifyRoot(value: unknown): SampleRootKind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  return "scalar";
}

function offsetToLineColumn(text: string, position: number): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(position, text.length));
  const before = text.slice(0, clamped);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

/**
 * JSON.parse errors differ between engines. Prefer the reported line/column,
 * then the byte offset, then a small scanner that locates the first structural
 * mistake (Node's newer messages omit the offset).
 */
export function describeJsonError(text: string, error: unknown): ParseProblem {
  const raw = error instanceof Error ? error.message : "The JSON is not valid.";
  const lineColumn = /line\s+(\d+)\s+column\s+(\d+)/i.exec(raw);
  if (lineColumn) {
    return {
      message: raw,
      line: Number(lineColumn[1]),
      column: Number(lineColumn[2]),
      position: null,
    };
  }

  const positionMatch = /position\s+(\d+)/i.exec(raw);
  const scanned = positionMatch ? null : findJsonSyntaxPosition(text);
  const position = positionMatch ? Number(positionMatch[1]) : scanned?.position ?? null;

  if (position !== null) {
    const { line, column } = offsetToLineColumn(text, position);
    return {
      message: scanned?.message ? `${scanned.message} (${raw})` : raw,
      line,
      column,
      position,
    };
  }

  return { message: raw, line: null, column: null, position: null };
}

interface SyntaxProblem {
  position: number;
  message: string;
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"]);
const NUMBER_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/;

/**
 * A tiny structural scanner used only to find the first error position.
 * JSON.parse remains the authority on validity.
 */
export function findJsonSyntaxPosition(text: string): SyntaxProblem | null {
  let index = 0;

  const skipWhitespace = () => {
    while (index < text.length && WHITESPACE.has(text[index] ?? "")) index += 1;
  };

  const fail = (position: number, message: string): never => {
    throw { position, message } satisfies SyntaxProblem;
  };

  const parseString = () => {
    index += 1; // opening quote
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") {
        const escape = text[index + 1];
        if (escape === "u") {
          const hex = text.slice(index + 2, index + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            fail(index, "Invalid unicode escape in string");
          }
          index += 6;
        } else if (
          escape === '"' ||
          escape === "\\" ||
          escape === "/" ||
          escape === "b" ||
          escape === "f" ||
          escape === "n" ||
          escape === "r" ||
          escape === "t"
        ) {
          index += 2;
        } else {
          fail(index, "Invalid escape sequence in string");
        }
        continue;
      }
      if (char === '"') {
        index += 1;
        return;
      }
      if (char === undefined || char.charCodeAt(0) < 0x20) {
        fail(index, "Control character in string");
      }
      index += 1;
    }
    fail(text.length, "Unterminated string");
  };

  const parseNumber = () => {
    const match = NUMBER_PATTERN.exec(text.slice(index));
    if (match) {
      index += match[0].length;
      return;
    }
    fail(index, "Invalid number");
  };

  const parseLiteral = (literal: string) => {
    if (text.slice(index, index + literal.length) !== literal) {
      fail(index, "Invalid literal");
    }
    index += literal.length;
  };

  const parseValue = () => {
    skipWhitespace();
    const char = text[index];
    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"') return parseString();
    if (char === "t") return parseLiteral("true");
    if (char === "f") return parseLiteral("false");
    if (char === "n") return parseLiteral("null");
    if (char === "-" || (char !== undefined && /\d/.test(char))) return parseNumber();
    fail(index, char === undefined ? "Expected a value" : `Unexpected token "${char}"`);
  };

  const parseArray = () => {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return;
    }
    while (index < text.length) {
      parseValue();
      skipWhitespace();
      const char = text[index];
      if (char === ",") {
        index += 1;
        skipWhitespace();
        if (text[index] === "]") fail(index, "Trailing comma in array");
        continue;
      }
      if (char === "]") {
        index += 1;
        return;
      }
      fail(index, char === undefined ? "Unterminated array" : "Expected , or ]");
    }
    fail(text.length, "Unterminated array");
  };

  const parseObject = () => {
    index += 1;
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return;
    }
    while (index < text.length) {
      skipWhitespace();
      if (text[index] !== '"') fail(index, "Expected a property name");
      parseString();
      skipWhitespace();
      if (text[index] !== ":") fail(index, "Expected : after property name");
      index += 1;
      parseValue();
      skipWhitespace();
      const char = text[index];
      if (char === ",") {
        index += 1;
        skipWhitespace();
        if (text[index] === "}") fail(index, "Trailing comma in object");
        continue;
      }
      if (char === "}") {
        index += 1;
        return;
      }
      fail(index, char === undefined ? "Unterminated object" : "Expected , or }");
    }
    fail(text.length, "Unterminated object");
  };

  try {
    parseValue();
    skipWhitespace();
    if (index < text.length) {
      fail(index, "Unexpected content after the JSON value");
    }
    return null;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "position" in error &&
      "message" in error
    ) {
      return error as SyntaxProblem;
    }
    return null;
  }
}

export function parseSample(text: string): SampleParseResult {
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue };
  } catch (error) {
    return { ok: false, error: describeJsonError(text, error) };
  }
}

export function analyzeSample(text: string, maxBytes: number): SampleAnalysis {
  const bytes = countBytes(text);
  const withinLimit = bytes <= maxBytes;
  const sizeError = withinLimit
    ? null
    : `This sample is ${bytes.toLocaleString("en-US")} bytes; the limit is ${maxBytes.toLocaleString("en-US")} bytes.`;

  if (!text.trim()) {
    return {
      bytes,
      withinLimit,
      parsed: null,
      rootKind: null,
      jsonError: null,
      rootError: null,
      sizeError,
      valid: false,
    };
  }

  const parsed = parseSample(text);
  if (!parsed.ok) {
    return {
      bytes,
      withinLimit,
      parsed,
      rootKind: null,
      jsonError: parsed.error,
      rootError: null,
      sizeError,
      valid: false,
    };
  }

  const rootKind = classifyRoot(parsed.value);
  const rootError =
    rootKind === "scalar"
      ? "The sample root is a scalar. Wrap it in an object, for example { \"value\": 42 }."
      : rootKind === "null"
        ? "The sample root is null. Use an object or an array instead."
        : null;

  return {
    bytes,
    withinLimit,
    parsed,
    rootKind,
    jsonError: null,
    rootError,
    sizeError,
    valid: withinLimit && !rootError,
  };
}

export interface PathValidation {
  valid: boolean;
  errors: string[];
}

const SEGMENT_PATTERN = /^[A-Za-z0-9._~-]+$/;
const TEMPLATE_PATTERN = /^\{([A-Za-z_][A-Za-z0-9_]*)\}$/;

export function pathTemplateNames(path: string): string[] {
  const names: string[] = [];
  for (const segment of path.split("/").slice(1)) {
    const match = TEMPLATE_PATTERN.exec(segment);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}

/** Mirrors the server's path rules from the technical spec. */
export function validatePath(path: string): PathValidation {
  const errors: string[] = [];

  if (!path) {
    return { valid: false, errors: ["Path is required."] };
  }
  if (path !== path.trim()) {
    errors.push("Path must not start or end with spaces.");
  }
  if (!path.startsWith("/")) {
    errors.push("Path must start with /.");
  }
  if ([...path].length > MAX_PATH_LENGTH) {
    errors.push(`Path must be ${MAX_PATH_LENGTH} characters or fewer.`);
  }
  if (path.includes("?")) {
    errors.push("Path must not contain a query string.");
  }
  if (path.includes("#")) {
    errors.push("Path must not contain a fragment.");
  }
  if (path.includes("//")) {
    errors.push("Path must not contain empty segments (//).");
  }

  const segments = path.startsWith("/") ? path.split("/").slice(1) : [];
  const templateNames = new Set<string>();

  for (const segment of segments) {
    if (!segment) continue;
    if (segment === "." || segment === "..") {
      errors.push("Path must not contain . or .. segments.");
      continue;
    }

    const template = TEMPLATE_PATTERN.exec(segment);
    if (template?.[1]) {
      if (templateNames.has(template[1])) {
        errors.push(`Template {${template[1]}} appears more than once.`);
      }
      templateNames.add(template[1]);
      continue;
    }

    if (segment.includes("{") || segment.includes("}")) {
      errors.push(
        `Segment "${segment}" must be a complete template such as {id}, or contain only letters, digits, . _ ~ and -.`,
      );
      continue;
    }

    if (!SEGMENT_PATTERN.test(segment)) {
      errors.push(
        `Segment "${segment}" contains unsupported characters. Use letters, digits, . _ ~ or -.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateMethod(
  method: string,
  allowed: readonly string[],
): string | null {
  if (!allowed.includes(method)) {
    return `Method must be one of ${allowed.join(", ")}.`;
  }
  return null;
}

export interface ProjectNameValidation {
  valid: boolean;
  error: string | null;
}

export function validateProjectName(
  name: string,
  maxLength: number,
): ProjectNameValidation {
  if (!name) return { valid: true, error: null };
  if (name.trim().length === 0) {
    return { valid: false, error: "Project name cannot be only whitespace." };
  }
  if ([...name].length > maxLength) {
    return {
      valid: false,
      error: `Project name must be ${maxLength} characters or fewer.`,
    };
  }
  return { valid: true, error: null };
}

export function describeWrapInList(wrapInList: boolean, rootKind: SampleRootKind | null): string {
  if (wrapInList) {
    return rootKind === "array"
      ? "Wrap in list is on: the response is an array of arrays, with each inner array generated from your sample."
      : "Wrap in list is on: the response is an array of objects, one per generated item.";
  }
  return rootKind === "array"
    ? "Wrap in list is off: the response is a single array generated from your sample."
    : "Wrap in list is off: the response is a single object.";
}
