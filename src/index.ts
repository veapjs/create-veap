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
  .option("--skip-install", "Skip dependencies installation")
  .option(
    "--pm <manager>",
    "Package manager to use: pnpm, npm, yarn or bun (auto-detected when omitted)",
  )
  .action(
    async (
      name?: string,
      options?: {
        docker?: boolean;
        skipInstall?: boolean;
        pm?: string;
      },
    ) => {
      await initProject(name, options);
    },
  );

cli.help();
cli.version("0.4.0");
cli.parse();

export { initProject };
