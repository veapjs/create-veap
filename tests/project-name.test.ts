import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { parseProjectName, projectNameError } from "../src/project-name.js";

const tmpDirs: string[] = [];

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "veap-name-test-"));
  tmpDirs.push(dir);
  return dir;
}

describe("parseProjectName", () => {
  it("accepts simple lowercase names", () => {
    expect(parseProjectName("my-veap-app")).toEqual({
      scope: null,
      name: "my-veap-app",
      folder: "my-veap-app",
      packageName: "my-veap-app",
    });
  });

  it("parses scoped names into folder + full package name", () => {
    expect(parseProjectName("@acme/my-app")).toEqual({
      scope: "acme",
      name: "my-app",
      folder: "my-app",
      packageName: "@acme/my-app",
    });
  });

  it("rejects empty names", () => {
    expect(() => parseProjectName("")).toThrow(/empty/i);
    expect(() => parseProjectName("   ")).toThrow(/empty/i);
  });

  it("rejects malformed scoped names", () => {
    expect(() => parseProjectName("@acme")).toThrow(/@scope\/name/i);
    expect(() => parseProjectName("@/name")).toThrow(/@scope\/name/i);
    expect(() => parseProjectName("acme/name")).toThrow(/lowercase letters/i);
    expect(() => parseProjectName("@acme/name/extra")).toThrow(/@scope\/name/i);
  });

  it("enforces lowercase for scoped parts", () => {
    expect(() => parseProjectName("@Acme/my-app")).toThrow(/lowercase/i);
    expect(() => parseProjectName("@acme/MyApp")).toThrow(/lowercase/i);
  });

  it("rejects parts starting with . or _", () => {
    // Unscoped: the charset rule (must start with a letter/digit) fires first.
    expect(() => parseProjectName(".hidden")).toThrow(
      /must start with a letter or digit/i,
    );
    // Scoped: the name part passes the charset regex, so the npm rule fires.
    expect(() => parseProjectName("@acme/_internal")).toThrow(
      /"\."\s*or\s*"_"/i,
    );
  });

  it("rejects unscoped names that are not filesystem-safe", () => {
    expect(() => parseProjectName("my app")).toThrow(/lowercase letters/i);
    expect(() => parseProjectName("a/b")).toThrow(/lowercase letters/i);
  });

  it("rejects reserved scopes (framework namespace and platform tooling)", () => {
    expect(() => parseProjectName("@veap/my-app")).toThrow(
      /"@veap" is reserved/,
    );
    expect(() => parseProjectName("@next/my-app")).toThrow(/reserved/);
    expect(() => parseProjectName("@react/my-app")).toThrow(/reserved/);
    expect(() => parseProjectName("@vercel/my-app")).toThrow(/reserved/);
  });

  it("rejects reserved unscoped names", () => {
    for (const reserved of [
      "veap",
      "create-veap",
      "create-next-app",
      "next",
      "react",
      "react-dom",
    ]) {
      expect(() => parseProjectName(reserved)).toThrow(
        new RegExp(`"${reserved}" is reserved`),
      );
    }
  });

  it("allows reserved words as the name part of a scoped package", () => {
    // `@acme/next` is a legitimate npm name - only the scope is checked
    // against the reserved list.
    const parsed = parseProjectName("@acme/next");
    expect(parsed.packageName).toBe("@acme/next");
    expect(parsed.folder).toBe("next");
  });

  it("rejects parts over the npm 214-char limit", () => {
    const long = "a".repeat(215);
    expect(() => parseProjectName(long)).toThrow(/too long/);
  });
});

describe("projectNameError", () => {
  it("returns null for valid names", () => {
    const cwd = makeDir();
    expect(projectNameError("my-veap-app", cwd)).toBeNull();
    expect(projectNameError("@acme/my-app", cwd)).toBeNull();
  });

  it("surfaces npm rule violations as messages", () => {
    expect(projectNameError("My App", makeDir())).toMatch(/lowercase/i);
    expect(projectNameError("@veap/app", makeDir())).toMatch(/reserved/i);
  });

  it("checks the folder collision for the base name", () => {
    const cwd = makeDir();
    fs.mkdirSync(path.join(cwd, "taken"));
    expect(projectNameError("taken", cwd)).toMatch(/already exists/i);
    expect(projectNameError("@acme/taken", cwd)).toMatch(/already exists/i);
  });
});
