import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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
  runnerOverride?: string,
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

  if (opts.pm === "bun") {
    flags.push("--use-bun");
  } else if (opts.pm === "pnpm") {
    flags.push("--use-pnpm");
  } else if (opts.pm === "yarn") {
    flags.push("--use-yarn");
  } else if (opts.pm === "npm") {
    flags.push("--use-npm");
  }

  const runner = runnerOverride ?? CNA_RUNNERS[opts.pm];
  return `${runner} "${name}" ${flags.join(" ")}`;
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
 * Runs create-next-app. If the package-manager-specific runner fails (for
 * example, Bun's known IPv6 ConnectionRefused bug on Windows when downloading
 * tarballs), it transparently falls back to npx so the project is still
 * properly scaffolded with all chosen options.
 * Returns the (possibly sanitized) project directory name.
 */
export function scaffoldNextApp(name: string, opts: ScaffoldOptions): string {
  const sanitized = sanitizeProjectName(name);
  if (sanitized) {
    console.log(`⚠ Project name sanitized: "${name}" → "${sanitized}"`);
  }
  const projectName = sanitized ?? name;

  const command = buildCreateNextAppCommand(projectName, opts);
  try {
    execSync(command, { cwd: opts.cwd, stdio: "inherit" });
  } catch (primaryErr) {
    if (opts.pm !== "npm") {
      console.warn(
        `\n⚠️  ${opts.pm} failed to run create-next-app (e.g. network/IPv6 timeout). Falling back to npx...`,
      );
      // Clean up partially created directory if exists and empty
      const targetPath = path.join(opts.cwd, projectName);
      if (fs.existsSync(targetPath)) {
        try {
          const files = fs.readdirSync(targetPath);
          if (files.length === 0) {
            fs.rmSync(targetPath, { recursive: true, force: true });
          }
        } catch {}
      }

      const fallbackCommand = buildCreateNextAppCommand(
        projectName,
        opts,
        CNA_RUNNERS.npm,
      );
      execSync(fallbackCommand, { cwd: opts.cwd, stdio: "inherit" });
    } else {
      throw primaryErr;
    }
  }

  return projectName;
}
