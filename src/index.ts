#!/usr/bin/env node
import cac from "cac";
import { initProject } from "./commands/init.js";

const cli = cac("create-veap");

cli
  .command(
    "[name]",
    "Initialize a new Veap project (asks for details when omitted)",
  )
  .option("--docker", "Initialize Docker configuration")
  .option("--no-docker", "Skip Docker configuration")
  .option("--skip-install", "Skip dependencies installation")
  .option(
    "--pm <manager>",
    "Package manager to use: pnpm, npm, yarn or bun (auto-detected when omitted)",
  )
  .option("--pnpm, --use-pnpm", "Use pnpm as package manager")
  .option("--bun, --use-bun", "Use bun as package manager")
  .option("--npm, --use-npm", "Use npm as package manager")
  .option("--yarn, --use-yarn", "Use yarn as package manager")
  .action(
    async (
      name?: string,
      options?: {
        docker?: boolean;
        skipInstall?: boolean;
        pm?: string;
        pnpm?: boolean;
        bun?: boolean;
        npm?: boolean;
        yarn?: boolean;
        usePnpm?: boolean;
        useBun?: boolean;
        useNpm?: boolean;
        useYarn?: boolean;
      },
    ) => {
      await initProject(name, options);
    },
  );

cli.help();
cli.version("0.4.0");
cli.parse();

export { initProject };
