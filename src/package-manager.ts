import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";

export const PACKAGE_MANAGERS: PackageManager[] = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
];

/** Versions pinned into the generated project's `packageManager` field. */
const PINNED_VERSIONS: Partial<Record<PackageManager, string>> = {
  pnpm: "11.9.0",
  yarn: "4.9.2",
};

interface Lockfile {
  file: string;
  pm: PackageManager;
}

const LOCKFILES: Lockfile[] = [
  { file: "pnpm-lock.yaml", pm: "pnpm" },
  { file: "bun.lock", pm: "bun" },
  { file: "bun.lockb", pm: "bun" },
  { file: "yarn.lock", pm: "yarn" },
  { file: "package-lock.json", pm: "npm" },
];

export interface PackageManagerDetection {
  pm: PackageManager;
  /** Where the default came from: package.json field, a lockfile, or the framework default. */
  source: "field" | "lockfile" | "default";
  /** Human-readable detail, e.g. "pnpm@11.9.0" or "pnpm-lock.yaml". */
  detail?: string;
}

const isPackageManager = (value: string): value is PackageManager =>
  (PACKAGE_MANAGERS as string[]).includes(value);

/**
 * Detects the package manager currently executing the process.
 *
 * Inspects:
 * 1. `npm_config_user_agent` (set when invoked via npx, bunx, pnpm dlx, yarn create)
 * 2. `process.versions.bun` (running directly inside Bun runtime)
 * 3. `npm_execpath` (path containing the binary name)
 */
export function detectRunningPackageManager(
  env: NodeJS.ProcessEnv = process.env,
  versions: NodeJS.ProcessVersions = process.versions,
): PackageManager | null {
  const userAgent = env.npm_config_user_agent;
  if (userAgent) {
    if (userAgent.startsWith("pnpm")) return "pnpm";
    if (userAgent.startsWith("bun")) return "bun";
    if (userAgent.startsWith("yarn")) return "yarn";
    if (userAgent.startsWith("npm")) return "npm";
  }

  // Running directly under Bun runtime (e.g. `bun create veap` or `bunx create-veap`)
  if (typeof (versions as any)?.bun === "string") {
    return "bun";
  }

  const execPath = env.npm_execpath;
  if (execPath) {
    if (execPath.includes("pnpm")) return "pnpm";
    if (execPath.includes("bun")) return "bun";
    if (execPath.includes("yarn")) return "yarn";
    if (execPath.includes("npm")) return "npm";
  }

  return null;
}

/**
 * Detects the package manager to default to by inspecting `dir` (usually the
 * directory the scaffolding command was launched from).
 *
 * Priority: `packageManager` field in package.json > lockfiles > default (pnpm).
 */
export function detectPackageManager(dir: string): PackageManagerDetection {
  // 1. Explicit intent: packageManager field (corepack convention)
  const pkgPath = path.join(dir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      if (typeof pkg.packageManager === "string") {
        // Handles both "pnpm@11.9.0" and "pnpm@https://..." forms
        const name = pkg.packageManager.slice(
          0,
          pkg.packageManager.indexOf("@"),
        );
        if (isPackageManager(name)) {
          return { pm: name, source: "field", detail: pkg.packageManager };
        }
      }
    } catch {
      // malformed package.json - fall through to lockfiles
    }
  }

  // 2. Lockfiles
  const found = LOCKFILES.filter((l) => fs.existsSync(path.join(dir, l.file)));
  if (found.length > 1) {
    // Ambiguous project (e.g. repo migrated between managers) - prefer pnpm,
    // the framework default, and surface the conflict in the detail.
    return {
      pm: "pnpm",
      source: "lockfile",
      detail: `multiple lockfiles found: ${found.map((l) => l.file).join(", ")}`,
    };
  }
  const first = found[0];
  if (found.length === 1 && first) {
    return { pm: first.pm, source: "lockfile", detail: first.file };
  }

  // 3. Framework default
  return { pm: "pnpm", source: "default" };
}

function formatDetection(d: PackageManagerDetection): string {
  const origin =
    d.source === "field"
      ? `packageManager field (${d.detail})`
      : d.source === "lockfile"
        ? d.detail
        : "no lockfile found";
  return `📦 Package manager detected: ${d.pm} (${origin})`;
}

/**
 * Interactive numbered-choice prompt rendered on readline (no external
 * prompt library, matching the rest of this CLI).
 *
 * Kept as a fallback helper.
 */
export async function promptPackageManager(
  detection: PackageManagerDetection,
): Promise<PackageManager> {
  console.log(formatDetection(detection));
  console.log("\n? Which package manager should the project use?");
  PACKAGE_MANAGERS.forEach((pm, i) => {
    const suffix =
      pm === detection.pm && detection.source === "lockfile"
        ? "  (detected - press Enter)"
        : pm === detection.pm && detection.source === "field"
          ? "  (from packageManager - press Enter)"
          : "";
    console.log(`  ${i + 1}) ${pm}${suffix}`);
  });

  return new Promise<PackageManager>((resolve) => {
    let settled = false;
    const finish = (pm: PackageManager) => {
      if (settled) return;
      settled = true;
      resolve(pm);
      rl.close();
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("close", () => {
      // stdin exhausted (e.g. `echo "" | veap init ...`) - fall back to default
      if (!settled) {
        console.log(`\n⚠ Input closed - using ${detection.pm}`);
        finish(detection.pm);
      }
    });

    const ask = () => {
      if (settled) return;
      rl.question("Choose [1]: ", (input) => {
        const value = input.trim().toLowerCase();
        if (value === "") {
          finish(detection.pm);
          return;
        }
        const asNumber = Number.parseInt(value, 10);
        if (
          String(asNumber) === value &&
          asNumber >= 1 &&
          asNumber <= PACKAGE_MANAGERS.length
        ) {
          const chosen = PACKAGE_MANAGERS[asNumber - 1];
          if (chosen) {
            finish(chosen);
            return;
          }
        }
        if (isPackageManager(value)) {
          finish(value);
          return;
        }
        console.log(
          `⚠ Unknown option "${input.trim()}" - enter 1-${PACKAGE_MANAGERS.length} or a name (${PACKAGE_MANAGERS.join(", ")}).`,
        );
        ask();
      });
    };
    ask();
  });
}

export interface ResolvePackageManagerOptions {
  pm?: string;
  pnpm?: boolean;
  bun?: boolean;
  npm?: boolean;
  yarn?: boolean;
  usePnpm?: boolean;
  useBun?: boolean;
  useNpm?: boolean;
  useYarn?: boolean;
}

/**
 * Resolves the package manager to use for a new project.
 *
 * Priority:
 * 1. Explicit manager flag: `--pnpm`, `--bun`, `--npm`, `--yarn`
 * 2. Explicit `--pm <name>` flag
 * 3. Auto-detected from currently running environment (e.g. `bun create`, `pnpm dlx`, `npx`)
 * 4. Auto-detected from current directory (packageManager field, lockfiles, or default)
 *
 * Automatically resolves without prompting.
 */
export async function resolvePackageManager(
  options?: ResolvePackageManagerOptions,
  cwd: string = process.cwd(),
): Promise<PackageManager> {
  // 1. Explicit boolean flags: --pnpm, --bun, --npm, --yarn
  if (options?.pnpm || options?.usePnpm) {
    console.log("📦 Using package manager: pnpm (specified via --pnpm flag)");
    return "pnpm";
  }
  if (options?.bun || options?.useBun) {
    console.log("📦 Using package manager: bun (specified via --bun flag)");
    return "bun";
  }
  if (options?.npm || options?.useNpm) {
    console.log("📦 Using package manager: npm (specified via --npm flag)");
    return "npm";
  }
  if (options?.yarn || options?.useYarn) {
    console.log("📦 Using package manager: yarn (specified via --yarn flag)");
    return "yarn";
  }

  // 2. Explicit --pm <name> flag
  if (options?.pm) {
    const requested = options.pm.trim().toLowerCase();
    if (isPackageManager(requested)) {
      console.log(
        `📦 Using package manager: ${requested} (specified via --pm flag)`,
      );
      return requested;
    }
    console.error(
      `Error: Unknown package manager "${options.pm}". Allowed: ${PACKAGE_MANAGERS.join(", ")}.`,
    );
    process.exit(1);
  }

  // 3. Auto-detected from currently running execution environment
  const running = detectRunningPackageManager();
  if (running) {
    console.log(
      `📦 Package manager detected: ${running} (from running environment)`,
    );
    return running;
  }

  // 4. Auto-detected from directory context or framework default
  const detection = detectPackageManager(cwd);
  console.log(formatDetection(detection));
  return detection.pm;
}

/**
 * Applies the chosen package manager to the freshly scaffolded project:
 *
 * - pnpm: pins `packageManager` (corepack), writes `pnpm-workspace.yaml`
 *   only when missing (an existing one is the source of truth)
 * - yarn: pins `packageManager`, adds `.yarnrc.yml` with `nodeLinker:
 *   node-modules` (berry's default PnP breaks Next.js)
 * - npm/bun: removes `packageManager` (not managed by corepack), switches
 *   workspace definition to the `workspaces` field in package.json
 */
export function applyPackageManager(
  projectDir: string,
  pm: PackageManager,
): void {
  const pkgPath = path.join(projectDir, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

  if (pm === "pnpm" || pm === "yarn") {
    pkg.packageManager = `${pm}@${PINNED_VERSIONS[pm]}`;
  } else {
    delete pkg.packageManager;
  }

  const pnpmWorkspace = path.join(projectDir, "pnpm-workspace.yaml");
  if (pm === "pnpm") {
    // pnpm ignores the `workspaces` field and requires its own file (kept
    // undefined in package.json to avoid a shadowing duplicate). Written
    // only when missing - an existing one is the source of truth.
    if (!fs.existsSync(pnpmWorkspace)) {
      fs.writeFileSync(pnpmWorkspace, 'packages:\n  - "plugins/*"\n', "utf-8");
    }
  } else {
    pkg.workspaces = ["plugins/*"];
    if (fs.existsSync(pnpmWorkspace)) {
      // Switching away from pnpm: the file would shadow the workspaces field.
      fs.rmSync(pnpmWorkspace);
    }
  }

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf-8");

  if (pm === "yarn") {
    const yarnrc = [
      "# Yarn Berry configuration generated by create-veap",
      "nodeLinker: node-modules",
      "",
    ].join("\n");
    fs.writeFileSync(path.join(projectDir, ".yarnrc.yml"), yarnrc, "utf-8");
  }
}

/** Command prefix for a package-manager-agnostic npm-script invocation. */
export function pmRunCommand(pm: PackageManager, script: string): string {
  return pm === "npm" ? `npm run ${script}` : `${pm} ${script}`;
}

/**
 * Installs dependencies with the chosen package manager (all four use the
 * same `install` verb).
 */
export function pmInstall(
  pm: PackageManager,
  cwd: string,
  opts?: { stdio?: "inherit" | "ignore" | "pipe" },
): void {
  execSync(`${pm} install`, { cwd, stdio: opts?.stdio ?? "inherit" });
}
