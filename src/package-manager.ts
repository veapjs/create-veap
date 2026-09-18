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
      detail: `multiple lockfiles found: ${found
        .map((l) => l.file)
        .join(", ")}`,
    };
  }
  if (found.length === 1) {
    return { pm: found[0].pm, source: "lockfile", detail: found[0].file };
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
 * The detected package manager is listed first as the default; pressing
 * Enter accepts it. Accepts a number (1-4) or a name (`pnpm`, `npm`,
 * `yarn`, `bun`). On EOF / closed stdin (piped input, CI) resolves to the
 * detected default instead of hanging.
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
          finish(PACKAGE_MANAGERS[asNumber - 1]);
          return;
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

/**
 * Resolves the package manager to use for a new project.
 *
 * Order: explicit `--pm <name>` flag (validated hard - scripts must not hang
 * on a prompt) → interactive prompt (TTY only) → auto-detected default
 * (non-TTY, CI).
 */
export async function resolvePackageManager(options?: {
  pm?: string;
}): Promise<PackageManager> {
  const detection = detectPackageManager(process.cwd());

  if (options?.pm) {
    const requested = options.pm.trim().toLowerCase();
    if (isPackageManager(requested)) {
      return requested;
    }
    console.error(
      `Error: Unknown package manager "${options.pm}". Allowed: ${PACKAGE_MANAGERS.join(", ")}.`,
    );
    process.exit(1);
  }

  if (!process.stdin.isTTY) {
    console.log(
      `📦 Using ${detection.pm} (auto-detected${detection.detail ? `: ${detection.detail}` : ""})`,
    );
    return detection.pm;
  }

  return promptPackageManager(detection);
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
      fs.writeFileSync(
        pnpmWorkspace,
        'packages:\n  - "plugins/*"\n  - "templates/*"\n',
        "utf-8",
      );
    }
  } else {
    pkg.workspaces = ["plugins/*", "templates/*"];
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
