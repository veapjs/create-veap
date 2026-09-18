import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  appendGitignore,
  buildEnvFile,
  clearAppDirectory,
  getManifest,
  injectVeapDependencies,
  writeEnvFile,
} from "../src/mutate.js";
import {
  buildCreateNextAppCommand,
  sanitizeProjectName,
} from "../src/scaffold.js";

/** Decodes base64 the same way @veap/core validates ENCRYPTION_KEY. */
function decodedKeyLength(base64: string): number {
  return Buffer.from(base64, "base64").length;
}

const tmpDirs: string[] = [];

function makeDir(files?: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-mutate-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files ?? {})) {
    const file = path.join(dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf-8");
  }
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const STUBS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../stubs",
);

const readPkg = (dir: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));

/** A representative create-next-app package.json (CNA 16.3.5 with --eslint). */
const CNA_PACKAGE_JSON = JSON.stringify({
  name: "cna-test",
  version: "0.1.0",
  private: true,
  scripts: {
    dev: "next dev",
    build: "next build",
    start: "next start",
    lint: "eslint",
  },
  dependencies: {
    next: "16.3.5",
    react: "19.2.8",
    "react-dom": "19.2.8",
  },
  devDependencies: {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    eslint: "^9",
    "eslint-config-next": "16.3.5",
    tailwindcss: "^4",
    typescript: "^5",
  },
});

describe("injectVeapDependencies", () => {
  it("keeps CNA-provided deps and adds veap deps on top", () => {
    const dir = makeDir({ "package.json": CNA_PACKAGE_JSON });
    injectVeapDependencies(dir);
    const pkg = readPkg(dir);

    expect(pkg.dependencies.next).toBe("16.3.5");
    expect(pkg.dependencies.react).toBe("19.2.8");
    expect(pkg.dependencies["@veap/core"]).toBe("^0.1.0");
    expect(pkg.dependencies["@veap/minimal-template"]).toBe("^0.1.0");
    expect(pkg.devDependencies["@types/node"]).toBe("^22.20.2");
    // CNA's eslint setup is kept untouched.
    expect(pkg.devDependencies.eslint).toBe("^9");
    expect(pkg.scripts.lint).toBe("eslint");
    expect(pkg.engines.node).toBe(">=22");
  });

  it("overrides the package name (scoped names lost by CNA)", () => {
    const dir = makeDir({ "package.json": CNA_PACKAGE_JSON });
    injectVeapDependencies(dir, "@acme/my-app");
    expect(readPkg(dir).name).toBe("@acme/my-app");
  });

  it("keeps the folder-derived name when no override is given", () => {
    const dir = makeDir({ "package.json": CNA_PACKAGE_JSON });
    injectVeapDependencies(dir);
    expect(readPkg(dir).name).toBe("cna-test");
  });

  it("throws when package.json is missing", () => {
    const dir = makeDir();
    expect(() => injectVeapDependencies(dir)).toThrow(/package.json not found/);
  });
});

describe("clearAppDirectory", () => {
  it("removes the CNA app/ directory", () => {
    const dir = makeDir({
      "app/page.tsx": "export default function Page() {}",
      "app/layout.tsx": "export default function Layout() {}",
    });
    clearAppDirectory(dir);
    expect(fs.existsSync(path.join(dir, "app"))).toBe(false);
  });

  it("is a no-op when app/ does not exist", () => {
    const dir = makeDir();
    expect(() => clearAppDirectory(dir)).not.toThrow();
  });
});

describe("buildEnvFile", () => {
  it("generates a 16-byte base64 ENCRYPTION_KEY (fail-fast contract)", () => {
    const env = buildEnvFile();
    const match = env.match(/ENCRYPTION_KEY="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(decodedKeyLength(match![1])).toBe(16);
  });

  it("generates a different key on every call", () => {
    expect(buildEnvFile()).not.toBe(buildEnvFile());
  });

  it("defaults DATABASE_URL to a local sqlite file", () => {
    expect(buildEnvFile()).toContain(
      'DATABASE_URL="sqlite:./storage/veap.sqlite"',
    );
  });
});

describe("writeEnvFile", () => {
  it("writes .env into the project", () => {
    const dir = makeDir();
    writeEnvFile(dir);
    expect(fs.existsSync(path.join(dir, ".env"))).toBe(true);
  });

  it("never clobbers an existing .env", () => {
    const dir = makeDir({ ".env": "KEEP_ME=1" });
    writeEnvFile(dir);
    expect(fs.readFileSync(path.join(dir, ".env"), "utf-8")).toBe("KEEP_ME=1");
  });
});

describe("appendGitignore", () => {
  it("appends veap entries to the CNA .gitignore", () => {
    const dir = makeDir({
      ".gitignore": "/node_modules\n/.next/\n",
    });
    appendGitignore(dir);
    const content = fs.readFileSync(path.join(dir, ".gitignore"), "utf-8");
    expect(content).toContain("public/storage/");
    expect(content).toContain("storage/");
    expect(content).toContain("**/*/dist");
    expect(content).toContain("/node_modules");
  });

  it("is idempotent (no duplicate entries on re-run)", () => {
    const dir = makeDir({
      ".gitignore": "/node_modules\nstorage/\n",
    });
    appendGitignore(dir);
    appendGitignore(dir);
    const lines = fs
      .readFileSync(path.join(dir, ".gitignore"), "utf-8")
      .split("\n")
      .map((l) => l.trim());
    expect(lines.filter((l) => l === "storage/")).toHaveLength(1);
    expect(lines.filter((l) => l === "public/storage/")).toHaveLength(1);
  });
});

describe("buildCreateNextAppCommand", () => {
  it("uses the bun runner for bun", () => {
    const cmd = buildCreateNextAppCommand("my-app", {
      cwd: "/tmp",
      pm: "bun",
    });
    expect(cmd).toContain("bun create next-app@latest");
    expect(cmd).toContain('"my-app"');
  });

  it("uses the canonical dlx runner for pnpm/yarn and npx for npm", () => {
    for (const [pm, expected] of [
      ["pnpm", "pnpm dlx create-next-app@latest"],
      ["yarn", "yarn dlx create-next-app@latest"],
      ["npm", "npx --yes create-next-app@latest"],
    ] as const) {
      const cmd = buildCreateNextAppCommand("my-app", { cwd: "/tmp", pm });
      expect(cmd).toContain(expected);
    }
  });

  it("passes explicit non-interactive flags and skips install", () => {
    const cmd = buildCreateNextAppCommand("my-app", {
      cwd: "/tmp",
      pm: "bun",
    });
    for (const flag of [
      "--ts",
      "--tailwind",
      "--app",
      "--eslint",
      "--react-compiler",
      '--import-alias "@/*"',
      "--skip-install",
    ]) {
      expect(cmd).toContain(flag);
    }
    expect(cmd).not.toContain("--src-dir");
    expect(cmd).not.toContain("--biome");
  });

  it("never passes --empty or --biome", () => {
    const cmd = buildCreateNextAppCommand("my-app", {
      cwd: "/tmp",
      pm: "bun",
    });
    expect(cmd).not.toContain("--empty");
    expect(cmd).not.toContain("--biome");
  });
});

describe("sanitizeProjectName", () => {
  it("returns null for already-safe names", () => {
    expect(sanitizeProjectName("my-veap-app")).toBeNull();
    expect(sanitizeProjectName("app.v2")).toBeNull();
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeProjectName("my app!")).toBe("my-app-");
  });
});

describe("overlay stubs completeness", () => {
  const FULL_OVERLAY = [
    "AGENTS.md.stub",
    "app/[[...catchAll]]/page.tsx.stub",
    "app/api/[...catchAll]/route.ts.stub",
    "app/error.tsx.stub",
    "app/globals.css.stub",
    "app/layout.tsx.stub",
    "app/not-found.tsx.stub",
    "app/storage/[...path]/route.ts.stub",
    "lib/plugins.gen.ts.stub",
    "lib/veap.ts.stub",
    "migrations/index.ts.stub",
    "next.config.ts.stub",
    "proxy.ts.stub",
  ];

  it("full overlay contains every veap-specific file", () => {
    for (const rel of FULL_OVERLAY) {
      expect(
        fs.existsSync(path.join(STUBS_DIR, "overlay-full", rel)),
        `missing overlay-full/${rel}`,
      ).toBe(true);
    }
  });

  it("no stub re-duplicates CNA boilerplate (tsconfig/postcss/package.json)", () => {
    for (const removed of [
      "tsconfig.json.stub",
      "postcss.config.mjs.stub",
      "package.json.stub",
    ]) {
      expect(
        fs.existsSync(path.join(STUBS_DIR, "overlay-full", removed)),
        `overlay-full/${removed} should not exist (owned by create-next-app)`,
      ).toBe(false);
    }
  });
});
