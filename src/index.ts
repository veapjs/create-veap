import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import * as p from "@clack/prompts";
import fse from "fs-extra/esm";
import pc from "picocolors";
import checkForUpdate from "update-check";
import {
  downloadAndExtract,
  parseExampleOption,
} from "./helpers/example-option.js";
import {
  getTemplateNames,
  installTemplate,
} from "./helpers/install-template.js";

const userAgent = process.env.npm_config_user_agent || "";

const packageManager = /bun/.test(userAgent)
  ? "bun"
  : /pnpm/.test(userAgent)
    ? "pnpm"
    : /yarn/.test(userAgent)
      ? "yarn"
      : "npm";

const commands = {
  pnpm: {
    install: "pnpm install",
    dev: "pnpm dev",
    create: "pnpm create veap",
  },
  yarn: {
    install: "yarn",
    dev: "yarn dev",
    create: "yarn create veap",
  },
  npm: {
    install: "npm install",
    dev: "npm run dev",
    create: "npm create veap",
  },
  bun: {
    install: "bun install",
    dev: "bun dev",
    create: "bun create veap",
  },
}[packageManager];

const templateRoot = path.join(
  fileURLToPath(import.meta.url),
  "../../templates",
);

// FIXME is there a better way with prompts?
const args = process.argv.slice(2);

// Accept a positional project name as an alias for --name so that
// `bun create veap my-app` works without the explicit flag.
let positionalName: string | undefined;
if (args[0] && !args[0].startsWith("--")) {
  positionalName = args.shift()!;
}

const { values } = parseArgs({
  args,
  options: {
    choose: {
      type: "boolean",
    },
    template: {
      type: "string",
    },
    example: {
      type: "string",
    },
    name: {
      type: "string",
    },
    "skip-install": {
      type: "boolean",
    },
    help: {
      type: "boolean",
      short: "h",
    },
  },
  strict: false,
});

const onCancel = () => {
  p.cancel(pc.red("✖") + " Operation cancelled");
  process.exit(0);
};

async function doPrompts() {
  const isValidPackageName = (projectName: string) =>
    /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(
      projectName,
    );

  const toValidPackageName = (projectName: string) =>
    projectName
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/^[._]/, "")
      .replace(/[^a-z0-9-~]+/g, "-");

  // if the dir is empty or not exist
  const canSafelyOverwrite = (dir: string) =>
    !existsSync(dir) || readdirSync(dir).length === 0;

  const templateNames = await getTemplateNames(templateRoot);
  const templateNameArg =
    typeof values.template === "string" ? values.template : undefined;

  if (
    !values.example &&
    templateNameArg &&
    !templateNames.includes(templateNameArg)
  ) {
    p.cancel(
      `${pc.red("✖")} Unknown template "${values.template}". ` +
        `Available templates: ${templateNames.join(", ")}. ` +
        `Use --example <github-url> to scaffold from an example repository.`,
    );
    process.exit(1);
  }

  const defaultProjectName = "veap-project";

  // Prefer an explicitly supplied --name, then a positional argument,
  // then fall back to the default project name.
  let targetDir = String(
    values["name"] ?? positionalName ?? defaultProjectName,
  );

  // If --name was supplied on the command line, use it as the default in the
  // interactive prompt so the user can still edit it.
  const promptDefault = String(
    values["name"] ?? positionalName ?? defaultProjectName,
  );

  try {
    const results = await p.group(
      {
        projectName: () => {
          if (values["name"] || positionalName) {
            return Promise.resolve(String(values["name"] ?? positionalName));
          }
          return p.text({
            defaultValue: promptDefault,
            message: "Project Name",
            placeholder: defaultProjectName,
          });
        },
        overwrites: ({ results }) => {
          targetDir =
            typeof results.projectName === "string"
              ? results.projectName.trim()
              : targetDir;
          if (!canSafelyOverwrite(targetDir)) {
            return p.confirm({
              message: `${results.projectName} is not empty. Remove existing files and continue?`,
            });
          }
          return Promise.resolve(true);
        },
        checkOverwrites: ({ results }) => {
          if (!results.overwrites) {
            p.cancel(pc.red("✖") + " Operation cancelled");
          }
          return Promise.resolve(true);
        },
        packageName: () => {
          if (isValidPackageName(targetDir)) {
            return Promise.resolve(undefined);
          }
          return p.text({
            message: "Package name",
            validate: (dir: string | undefined) => {
              if (!isValidPackageName(dir || "")) {
                return "Invalid package.json name";
              }
            },
          });
        },
        templateName: () => {
          if (
            !values.choose ||
            templateNameArg ||
            typeof values.example === "string"
          ) {
            return Promise.resolve(
              templateNameArg ??
                (typeof values.example === "string"
                  ? values.example
                  : templateNames[0]),
            );
          }
          return p.select({
            message: "Choose a starter template",
            options: templateNames.map((name) => ({
              label: name,
              value: name,
            })),
          });
        },
      },
      { onCancel },
    );

    return {
      ...results,
      packageName: results.packageName || toValidPackageName(targetDir),
      targetDir,
    };
  } catch (err) {
    if (err instanceof Error) {
      console.log(err.message);
    }
    process.exit(1);
  }
}

function displayUsage() {
  console.log(`
Usage: ${commands.create} [options]

Options:
  --choose              Choose from the template list
  --template            Specify a template
  --example             Specify an example use as a template
  --name                Specify a project name
  --skip-install        Skip installation of dependencies
  --help                Display this help message
`);
}

async function notifyUpdate() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const result = await checkForUpdate(packageJson).catch(() => {});
  if (result?.latest) {
    console.log(`A new version of 'create-veap' is available!`);
    console.log("You can update by running: ");
    console.log();
    console.log(`    npm i -g create-veap`);
  }
}

async function init() {
  if (values.help) {
    displayUsage();
    return;
  }

  const exampleOption = await parseExampleOption(
    typeof values.example === "string" ? values.example : undefined,
  );

  const { packageName, templateName, targetDir } = await doPrompts();
  const root = path.resolve(String(targetDir));

  console.log("Setting up project...");

  // doPrompts would exit if the dir exists and overwrite is false
  fse.emptyDirSync(root);
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }

  if (exampleOption) {
    // If an example repository is provided, clone it.
    await downloadAndExtract(root, exampleOption);
  } else {
    // If an example repository is not provided for cloning, proceed
    // by installing from a template.
    await installTemplate(root, packageName, templateRoot, templateName);
  }

  if (values["skip-install"]) {
    console.log(`\nDone. Now run:\n`);
    console.log(`${pc.bold(pc.green(`cd ${targetDir}`))}`);
    console.log(`${pc.bold(pc.green(commands.install))}`);
    console.log(`${pc.bold(pc.green(commands.dev))}`);

    return;
  }

  // 1. check packageManager
  // 2. and then install dependencies
  console.log();
  console.log(`Installing dependencies by running ${commands.install}...`);

  const installProcess = spawn(packageManager, ["install"], {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: String(targetDir),
  });

  installProcess.on("close", (code: number | null) => {
    // process exit code
    if (code !== 0) {
      console.log(`Could not execute ${commands.install}. Please run`);
      console.log(`${pc.bold(pc.green(`cd ${targetDir}`))}`);
      console.log(`${pc.bold(pc.green(commands.install))}`);
      console.log(`${pc.bold(pc.green(commands.dev))}`);
      console.log();
    } else {
      console.log(`\nDone. Now run:\n`);
      console.log(`${pc.bold(pc.green(`cd ${targetDir}`))}`);
      console.log(`${pc.bold(pc.green(commands.dev))}`);
      console.log();
    }
  });
}

init()
  .then(notifyUpdate)
  .catch((e) => {
    console.log(e);
  });
