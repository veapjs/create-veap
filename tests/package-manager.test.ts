import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  applyPackageManager,
  detectPackageManager,
  pmRunCommand,
  type PackageManager,
} from "../src/package-manager.js";

const tmpDirs: string[] = [];

function makeDir(files?: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-pm-test-"));
  tmpDirs.push(dir);
  for (const [name, content] of Object.entries(files ?? {})) {
    fs.writeFileSync(path.join(dir, name), content, "utf-8");
  }
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("detectPackageManager", () => {
  it("returns the framework default (pnpm) in an empty directory", () => {
    const detection = detectPackageManager(makeDir());
    expect(detection).toEqual({ pm: "pnpm", source: "default" });
  });

  it("honors the packageManager field first", () => {
    for (const field of [
      "pnpm@11.9.0",
      "yarn@4.9.2",
      "npm@10.9.0",
      "bun@1.2.0",
    ]) {
      const pm = field.split("@")[0] as PackageManager;
      const detection = detectPackageManager(
        makeDir({ "package.json": JSON.stringify({ packageManager: field }) }),
      );
      expect(detection.pm).toBe(pm);
      expect(detection.source).toBe("field");
      expect(detection.detail).toBe(field);
    }
  });

  it("parses packageManager fields with a URL instead of a version", () => {
    const detection = detectPackageManager(
      makeDir({
        "package.json": JSON.stringify({
          packageManager: "pnpm@https://example.com/pnpm.tgz",
        }),
      }),
    );
    expect(detection.pm).toBe("pnpm");
    expect(detection.source).toBe("field");
  });

  it("detects each lockfile", () => {
    const cases: [string, PackageManager][] = [
      ["pnpm-lock.yaml", "pnpm"],
      ["bun.lock", "bun"],
      ["bun.lockb", "bun"],
      ["yarn.lock", "yarn"],
      ["package-lock.json", "npm"],
    ];
    for (const [file, pm] of cases) {
      const detection = detectPackageManager(makeDir({ [file]: "" }));
      expect(detection).toEqual({ pm, source: "lockfile", detail: file });
    }
  });

  it("prefers pnpm when lockfiles conflict", () => {
    const detection = detectPackageManager(
      makeDir({ "package-lock.json": "", "yarn.lock": "" }),
    );
    expect(detection.pm).toBe("pnpm");
    expect(detection.detail).toContain("multiple lockfiles found");
  });

  it("falls back to lockfiles when package.json is malformed", () => {
    const detection = detectPackageManager(
      makeDir({ "package.json": "{ not json", "yarn.lock": "" }),
    );
    expect(detection).toEqual({
      pm: "yarn",
      source: "lockfile",
      detail: "yarn.lock",
    });
  });

  it("falls back to the default when package.json is malformed and has no lockfiles", () => {
    const detection = detectPackageManager(
      makeDir({ "package.json": "{ not json" }),
    );
    expect(detection).toEqual({ pm: "pnpm", source: "default" });
  });
});

describe("applyPackageManager", () => {
  function scaffold(files?: Record<string, string>): string {
    return makeDir({
      "package.json": JSON.stringify({ name: "test-app", scripts: {} }),
      ...(files ?? {}),
    });
  }

  it("keeps pnpm-workspace.yaml and pins packageManager for pnpm", () => {
    const dir = scaffold({
      "pnpm-workspace.yaml": "packages:\n  - plugins/*\n",
    });
    applyPackageManager(dir, "pnpm");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf-8"),
    );
    expect(pkg.packageManager).toBe("pnpm@11.9.0");
    expect(pkg.workspaces).toBeUndefined();
    expect(fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(dir, ".yarnrc.yml"))).toBe(false);
  });

  it("writes pnpm-workspace.yaml when missing (fresh CNA scaffolds)", () => {
    const dir = scaffold();
    applyPackageManager(dir, "pnpm");
    const content = fs.readFileSync(
      path.join(dir, "pnpm-workspace.yaml"),
      "utf-8",
    );
    expect(content).toContain('"plugins/*"');
    expect(content).toContain('"templates/*"');
  });

  it("switches npm projects to the workspaces field and drops packageManager", () => {
    const dir = scaffold({ "pnpm-workspace.yaml": "packages:\n" });
    applyPackageManager(dir, "npm");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf-8"),
    );
    expect(pkg.packageManager).toBeUndefined();
    expect(pkg.workspaces).toEqual(["plugins/*", "templates/*"]);
    expect(fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(false);
    expect(fs.existsSync(path.join(dir, ".yarnrc.yml"))).toBe(false);
  });

  it("configures yarn berry with node-modules linker", () => {
    const dir = scaffold({ "pnpm-workspace.yaml": "packages:\n" });
    applyPackageManager(dir, "yarn");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf-8"),
    );
    expect(pkg.packageManager).toBe("yarn@4.9.2");
    expect(pkg.workspaces).toEqual(["plugins/*", "templates/*"]);
    expect(fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(false);
    const yarnrc = fs.readFileSync(path.join(dir, ".yarnrc.yml"), "utf-8");
    expect(yarnrc).toContain("nodeLinker: node-modules");
  });

  it("uses the workspaces field for bun without a packageManager pin", () => {
    const dir = scaffold({ "pnpm-workspace.yaml": "packages:\n" });
    applyPackageManager(dir, "bun");
    const pkg = JSON.parse(
      fs.readFileSync(path.join(dir, "package.json"), "utf-8"),
    );
    expect(pkg.packageManager).toBeUndefined();
    expect(pkg.workspaces).toEqual(["plugins/*", "templates/*"]);
    expect(fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))).toBe(false);
  });

  it("does nothing when package.json is missing", () => {
    const dir = makeDir();
    expect(() => applyPackageManager(dir, "npm")).not.toThrow();
  });
});

describe("pmRunCommand", () => {
  it("maps npm scripts to `npm run`", () => {
    expect(pmRunCommand("npm", "dev")).toBe("npm run dev");
  });

  it("uses the bare script form for pnpm, yarn and bun", () => {
    expect(pmRunCommand("pnpm", "dev")).toBe("pnpm dev");
    expect(pmRunCommand("yarn", "dev")).toBe("yarn dev");
    expect(pmRunCommand("bun", "dev")).toBe("bun dev");
  });
});
