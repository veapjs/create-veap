import { execSync } from "node:child_process";
import type { PackageManager } from "./package-manager.js";

/**
 * Scaffolds the Next.js shell of a new project with the official
 * `create-next-app` (CNA) instead of duplicating its boilerplate in stubs.
 *
 * Veap owns only the files CNA cannot know about (overlay, see
 * `commands/init.ts`); everything else - Next version, tsconfig, postcss,
 * fonts, README, git init - comes straight from CNA and stays current.
 */

/** How each package manager fetches and runs the CNA binary. */
const CNA_RUNNERS: Record<PackageManager, string> = {
  bun: "bun create next-app@latest",
  pnpm: "pnpm dlx create-next-app@latest",
  yarn: "yarn dlx create-next-app@latest",
  npm: "npx --yes create-next-app@latest",
};

export interface ScaffoldOptions {
  /** Directory in which the project folder is created. */
  cwd: string;
  pm: PackageManager;
}

/**
 * Builds the explicit, non-interactive CNA invocation.
 *
 * Every choice is passed as a flag so CNA never prompts; `--yes` additionally
 * absorbs flags introduced by future CNA versions (they resolve to defaults
 * instead of hanging the scaffolder). `--skip-install` keeps a single
 * dependency install at the end of `initProject`, after veap mutations.
 */
export function buildCreateNextAppCommand(
  name: string,
  opts: ScaffoldOptions,
): string {
  const flags = [
    "--ts",
    "--tailwind",
    "--app",
    // ESLint is the veap linter: CNA writes eslint.config.mjs, the eslint
    // dev deps and the `lint` script (kept as-is).
    "--eslint",
    "--react-compiler",
    "--import-alias",
    '"@/*"',
    "--skip-install",
  ];

  return `${CNA_RUNNERS[opts.pm]} "${name}" ${flags.join(" ")}`;
}

/**
 * Normalizes a project name into a shell-safe, npm-friendly folder name.
 * CNA derives the package name from the folder, so the same charset applies.
 */
export function sanitizeProjectName(name: string): string | null {
  const safe = name.replace(/[^\w.-]/g, "-");
  return safe === name ? null : safe;
}

/**
 * Runs create-next-app. Throws (with the CNA output already streamed to the
 * terminal) when scaffolding fails - CNA removes its own partial output.
 * Returns the (possibly sanitized) project directory name.
 */
export function scaffoldNextApp(name: string, opts: ScaffoldOptions): string {
  const sanitized = sanitizeProjectName(name);
  if (sanitized) {
    console.log(`⚠ Project name sanitized: "${name}" → "${sanitized}"`);
  }
  const projectName = sanitized ?? name;

  const command = buildCreateNextAppCommand(projectName, opts);
  execSync(command, { cwd: opts.cwd, stdio: "inherit" });

  return projectName;
}
