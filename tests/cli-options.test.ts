import cac from "cac";
import { describe, expect, it } from "vitest";

function buildCli() {
  const cli = cac("create-veap");
  let parsedName: string | undefined;
  let parsedOptions: Record<string, unknown> = {};

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
    .option("--pnpm, --use-pnpm", "Use pnpm as package manager")
    .option("--bun, --use-bun", "Use bun as package manager")
    .option("--npm, --use-npm", "Use npm as package manager")
    .option("--yarn, --use-yarn", "Use yarn as package manager")
    .action((name, options) => {
      parsedName = name;
      parsedOptions = options;
    });

  return {
    parse(args: string[]) {
      cli.parse(["node", "bin/veap.js", ...args]);
      return { name: parsedName, options: parsedOptions };
    },
  };
}

describe("CLI Docker flag options", () => {
  it("keeps options.docker undefined when no flags are given so it prompts the user", () => {
    const cli = buildCli();
    const result = cli.parse(["my-test-app"]);
    expect(result.name).toBe("my-test-app");
    expect(result.options.docker).toBeUndefined();
  });

  it("sets options.docker to true when --docker is explicitly passed", () => {
    const cli = buildCli();
    const result = cli.parse(["my-test-app", "--docker"]);
    expect(result.options.docker).toBe(true);
  });

  it("sets options.docker to false when --no-docker is explicitly passed", () => {
    const cli = buildCli();
    const result = cli.parse(["my-test-app", "--no-docker"]);
    expect(result.options.docker).toBe(false);
  });
});
