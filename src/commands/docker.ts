import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";

export async function initDockerConfig(
  targetDir?: string,
  pm?: "pnpm" | "npm" | "yarn" | "bun",
) {
  const rootDir = targetDir || process.cwd();
  console.log(`\n🐳 Initializing Docker configuration in ${rootDir}...`);

  // Read project name for compose.yml placeholders (like @veap/cli does)
  let projectName = "veap-app";
  const pkgPath = path.join(rootDir, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      projectName =
        JSON.parse(fs.readFileSync(pkgPath, "utf-8")).name || projectName;
    } catch (_) {}
  }

  const stubsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../stubs/docker",
  );

  if (!fs.existsSync(stubsDir)) {
    console.error(`Error: Missing Docker stubs directory at ${stubsDir}`);
    return;
  }

  const files = [
    { src: "Dockerfile.stub", dest: "Dockerfile" },
    { src: ".dockerignore.stub", dest: ".dockerignore" },
    { src: "compose.yml.stub", dest: "compose.yml" },
  ];

  const spin = ora("Generating Docker files...").start();

  try {
    for (const f of files) {
      let content = fs.readFileSync(path.join(stubsDir, f.src), "utf-8");
      // Replace project name in compose.yml
      if (f.dest === "compose.yml") {
        content = content.replace(/\{\{name\}\}/g, projectName);
      }
      fs.writeFileSync(path.join(rootDir, f.dest), content, "utf-8");
    }

    // Copy the Dockerfile variant for the chosen package manager over the
    // pnpm baseline shipped in the stubs.
    if (pm && pm !== "pnpm") {
      const variantPath = path.join(stubsDir, `Dockerfile.${pm}.stub`);
      if (fs.existsSync(variantPath)) {
        fs.writeFileSync(
          path.join(rootDir, "Dockerfile"),
          fs.readFileSync(variantPath, "utf-8"),
          "utf-8",
        );
      }
    }

    spin.succeed("Docker configuration files initialized.");
    console.log("  - Dockerfile");
    console.log("  - compose.yml");
    console.log("  - .dockerignore\n");
  } catch (err) {
    spin.fail("Failed to generate Docker files.");
    console.error(err);
  }
}
