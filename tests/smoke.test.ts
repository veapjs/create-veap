import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Full-pipeline smoke test: runs the real `create-veap` bin, which in
 * turn runs the real `create-next-app` (network access required, ~1–2 min)
 * and asserts the complete scaffold → overlay → mutate flow end to end.
 *
 * Gated behind RUN_SMOKE=1 so ordinary test runs stay fast and offline:
 *
 *   RUN_SMOKE=1 bun run test tests/smoke.test.ts
 */

const RUN = process.env.RUN_SMOKE === "1";
const d = RUN ? describe : describe.skip;

const tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-smoke-"));
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const PROJECT = "smoke-veap-app";

d("create-veap smoke (full pipeline)", () => {
  let projectDir: string;

  it("scaffolds a complete project through the real CLI", () => {
    const cwd = makeTempDir();
    const bin = path.resolve(__dirname, "../dist/index.js");

    // Real bin, real CNA, no install (fast, still exercises every file step).
    // --no-docker keeps the run fully non-interactive (skips the Docker prompt).
    execSync(`node "${bin}" ${PROJECT} --skip-install --pm bun --no-docker`, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    projectDir = path.join(cwd, PROJECT);
    expect(fs.existsSync(projectDir)).toBe(true);
  }, 300_000);

  it("kept the CNA boilerplate", () => {
    expect(fs.existsSync(path.join(projectDir, "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "postcss.config.mjs"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(projectDir, ".git"))).toBe(true);

    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    );
    expect(pkg.name).toBe(PROJECT);
    expect(pkg.dependencies.next).toBeDefined();
    expect(pkg.dependencies.react).toBeDefined();
  });

  it("applied the veap overlay", () => {
    // The CNA app/ tree must be fully replaced: a leftover page.tsx would
    // collide with the optional catch-all route.
    expect(fs.existsSync(path.join(projectDir, "app", "page.tsx"))).toBe(false);

    const layout = fs.readFileSync(
      path.join(projectDir, "app", "layout.tsx"),
      "utf-8",
    );
    expect(layout).toContain("force-dynamic");
    expect(layout).toContain("@veap/core");
    // Session helpers come from the core auth entry, not from lib/veap.
    expect(layout).toContain("@veap/core/auth/server");

    expect(
      fs.existsSync(
        path.join(projectDir, "app", "[[...catchAll]]", "page.tsx"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(projectDir, "app", "api", "[...catchAll]", "route.ts"),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "lib", "veap.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "proxy.ts"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "plugins"))).toBe(true);
    expect(fs.existsSync(path.join(projectDir, "templates"))).toBe(true);

    // Agent knowledge ships with the project.
    const agents = fs.readFileSync(path.join(projectDir, "AGENTS.md"), "utf-8");
    expect(agents).toContain("force-dynamic");
    expect(agents).toContain("ENCRYPTION_KEY");
    expect(agents).toContain("plugins.gen.ts");

    const nextConfig = fs.readFileSync(
      path.join(projectDir, "next.config.ts"),
      "utf-8",
    );
    expect(nextConfig).toContain("transpilePackages");
  });

  it("mutated package.json, .env and .gitignore", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(projectDir, "package.json"), "utf-8"),
    );
    expect(pkg.dependencies["@veap/core"]).toBe("^0.1.0");
    // Linting comes from CNA's own ESLint setup, not from a veap pin.
    expect(pkg.devDependencies.eslint).toBeDefined();
    expect(pkg.devDependencies["eslint-config-next"]).toBeDefined();
    expect(pkg.engines.node).toBe(">=22");

    const env = fs.readFileSync(path.join(projectDir, ".env"), "utf-8");
    const key = env.match(/ENCRYPTION_KEY="([^"]+)"/)?.[1];
    expect(key).toBeDefined();
    // The @veap/core fail-fast contract: exactly 16 bytes decoded.
    expect(Buffer.from(key!, "base64")).toHaveLength(16);
    expect(env).toContain("DATABASE_URL=");

    const gitignore = fs.readFileSync(
      path.join(projectDir, ".gitignore"),
      "utf-8",
    );
    expect(gitignore).toContain("storage/");

    // The veap overlay must not ship a linter config over the CNA one.
    expect(fs.existsSync(path.join(projectDir, "biome.json"))).toBe(false);
    expect(fs.existsSync(path.join(projectDir, "eslint.config.mjs"))).toBe(
      true,
    );
  });
});
