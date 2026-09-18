import fs from "node:fs";
import path from "node:path";

/**
 * Project-name validation following npm package-name rules (the folder name
 * becomes the package name via create-next-app):
 *
 * - lowercase only, max 214 characters
 * - scoped names (`@scope/name`) are supported: the project folder receives
 *   the base name, `package.json` the full scoped name
 * - reserved scopes and names (the framework's own `@veap` namespace,
 *   `next`, `react`, ...) are rejected
 * - unscoped names must stay filesystem-safe (they become the folder)
 */

/** Scopes that may never be used for generated projects. */
const RESERVED_SCOPES = [
  "veap",
  "next",
  "react",
  "vercel",
  "npm",
  "node",
  "typescript",
  "types",
];

/** Unscoped package names that may never be used for generated projects. */
const RESERVED_NAMES = [
  "veap",
  "create-veap",
  "create-next-app",
  "next",
  "react",
  "react-dom",
  "vercel",
];

const MAX_LENGTH = 214;

export interface ParsedProjectName {
  /** npm scope without the leading `@`, or null for unscoped names. */
  scope: string | null;
  /** Package name inside the scope (equals the unscoped name otherwise). */
  name: string;
  /** Folder to create (base name for scoped packages). */
  folder: string;
  /** Full npm package name written into package.json. */
  packageName: string;
}

function partError(part: string, label: string): string | null {
  if (part !== part.toLowerCase()) {
    return `${label} must be lowercase (npm package name rules).`;
  }
  if (part.startsWith(".") || part.startsWith("_")) {
    return `${label} cannot start with "." or "_".`;
  }
  if (part.length > MAX_LENGTH) {
    return `${label} is too long (npm limit is ${MAX_LENGTH} characters).`;
  }
  return null;
}

/**
 * Parses and validates a project name. Throws an `Error` with a readable
 * message when the name violates npm package-name rules or hits a
 * reserved scope/name.
 */
export function parseProjectName(input: string): ParsedProjectName {
  const value = input.trim();
  if (!value) {
    throw new Error("Project name cannot be empty.");
  }

  if (value.startsWith("@")) {
    const match = /^@([\w.-]+)\/([\w.-]+)$/.exec(value);
    if (!match) {
      throw new Error(
        'Scoped names must look like "@scope/name" (lowercase letters, digits, ".", "_", "-").',
      );
    }
    const scope = match[1];
    const name = match[2];

    const error =
      partError(scope, `Scope "${scope}"`) ?? partError(name, `Name "${name}"`);
    if (error) throw new Error(error);

    if (RESERVED_SCOPES.includes(scope)) {
      throw new Error(
        `The scope "@${scope}" is reserved and cannot be used for generated projects.`,
      );
    }

    return {
      scope,
      name,
      folder: name,
      packageName: `@${scope}/${name}`,
    };
  }

  // Unscoped: also becomes the folder, so keep it filesystem-safe.
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(
      'Use lowercase letters, digits, ".", "_" or "-" (must start with a letter or digit).',
    );
  }

  const error = partError(value, "Project name");
  if (error) throw new Error(error);

  if (RESERVED_NAMES.includes(value)) {
    throw new Error(
      `The name "${value}" is reserved and cannot be used for generated projects.`,
    );
  }

  return { scope: null, name: value, folder: value, packageName: value };
}

/**
 * Full validation for user input: npm name rules (via `parseProjectName`)
 * plus a filesystem collision check on the folder that would be created.
 * Returns an error message, or null when the name is acceptable.
 */
export function projectNameError(input: string, cwd: string): string | null {
  let parsed: ParsedProjectName;
  try {
    parsed = parseProjectName(input);
  } catch (err) {
    return (err as Error).message;
  }
  if (fs.existsSync(path.resolve(cwd, parsed.folder))) {
    return `Folder "${parsed.folder}" already exists in ${cwd}.`;
  }
  return null;
}
