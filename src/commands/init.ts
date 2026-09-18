import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ora from "ora";
import { processStubs } from "../utils.js";
import {
  applyPackageManager,
  pmInstall,
  pmRunCommand,
  resolvePackageManager,
} from "../package-manager.js";
import { scaffoldNextApp } from "../scaffold.js";
import { promptConfirm, promptProjectName } from "../prompts.js";
import { parseProjectName, projectNameError } from "../project-name.js";
import {
  appendGitignore,
  clearAppDirectory,
  injectVeapDependencies,
  writeEnvFile,
} from "../mutate.js";

export async function initProject(
  name?: string,
  options?: {
    docker?: boolean;
    skipInstall?: boolean;
    pm?: string;
  },
) {
  // ---- Resolve the project name: from the CLI argument or the interactive
  // prompt (which resolves to a default on non-TTY, so scripts never hang).
  let nameInput = (name ?? "").trim();
  if (!nameInput) {
    nameInput = await promptProjectName("my-veap-app", process.cwd());
  } else {
    const error = projectNameError(nameInput, process.cwd());
    if (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }
  }

  // npm name rules: `@scope/name` keeps the full name in package.json while
  // the project folder receives the base name.
  const parsed = parseProjectName(nameInput);
  const projectName = parsed.folder;
  const destDir = path.resolve(process.cwd(), projectName);

  // ---- Docker is opt-in; ask when the flag was not given (TTY only).
  let withDocker = options?.docker;
  if (withDocker === undefined) {
    withDocker = await promptConfirm("Include Docker configuration?", false);
  }

  // Resolve the package manager up front so the prompt runs before any
  // scaffolding starts (cleaner UX than asking mid-scaffold).
  const pm = await resolvePackageManager({ pm: options?.pm });

  const overlayFolder = "../../stubs/overlay-full";

  console.log(
    `🚀 Initializing new Veap project (Full plugin-enabled): ${projectName} in ${destDir}...`,
  );

  try {
    // ---- 1. Scaffold the Next.js shell with the official create-next-app.
    // CNA owns the boilerplate (Next version, tsconfig, postcss, fonts,
    // README, git init); it runs with explicit flags so it never prompts.
    const spin = ora("Scaffolding Next.js app (create-next-app)...").start();
    try {
      scaffoldNextApp(projectName, { cwd: process.cwd(), pm });
      spin.succeed("Next.js app scaffolded.");
    } catch (err) {
      spin.fail("create-next-app failed.");
      throw err;
    }

    const variables = { name: projectName };

    // ---- 2. The overlay owns the whole app/ tree: a leftover CNA page would
    // collide with the optional catch-all route (same specificity).
    clearAppDirectory(destDir);

    // ---- 3. Apply the veap overlay: only the files CNA cannot know about
    // (veap layout, router catch-all, api pipeline, storage route, bootstrap,
    // veap next.config...). Overlay files overwrite CNA counterparts.
    const overlaySpin = ora("Applying Veap overlay files...").start();
    const stubsDir = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      overlayFolder,
    );
    processStubs(stubsDir, destDir, variables);
    overlaySpin.succeed("Veap overlay applied.");

    // ---- 4. Mutate the generated project: veap dependencies, starter .env
    // (with a fresh random ENCRYPTION_KEY) and .gitignore additions. Scoped
    // names are restored into package.json here (CNA derives the name from
    // the folder and drops the scope).
    const mutateSpin = ora("Configuring Veap (deps, .env)...").start();
    injectVeapDependencies(destDir, parsed.packageName);
    writeEnvFile(destDir);
    appendGitignore(destDir);
    mutateSpin.succeed("Veap configuration applied.");

    // ---- 5. Workspace and storage folders.
    for (const dir of [
      path.join(destDir, "public"),
      path.join(destDir, "storage"),
      path.join(destDir, "plugins"),
      path.join(destDir, "templates"),
    ]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // ---- 6. Package manager: packageManager field, workspaces config,
    // .yarnrc.yml for yarn berry.
    applyPackageManager(destDir, pm);

    // ---- 7. Docker configuration (optional).
    if (withDocker) {
      const { initDockerConfig } = await import("./docker.js");
      await initDockerConfig(destDir, pm);
    }

    // ---- 8. Single dependency install, after all mutations.
    if (!options?.skipInstall) {
      const spinner = ora(
        `📦 Installing dependencies (${pm} install)...`,
      ).start();
      try {
        pmInstall(pm, destDir);
        spinner.succeed("Dependencies installed.");
      } catch (_err) {
        spinner.fail(
          `Failed to install dependencies automatically. Run ${pm} install manually.`,
        );
      }
    }

    console.log(`\n✨ Veap project "${projectName}" initialized successfully!`);
    console.log(`💡 Go to project directory: cd ${projectName}`);
    console.log(`💡 Start dev server: ${pmRunCommand(pm, "dev")}`);
  } catch (err) {
    console.error("Error initializing project:", err);
    process.exit(1);
  }
}
