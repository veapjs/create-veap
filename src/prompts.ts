import readline from "node:readline";
import { projectNameError } from "./project-name.js";

/**
 * Interactive prompts for the scaffolder, following the same conventions as
 * `promptPackageManager`: plain readline (no prompt library) and safe
 * non-TTY behaviour - every prompt resolves to its default on EOF / closed
 * stdin / non-interactive terminals, so CI never hangs.
 *
 * Validation (npm package-name rules, scoped names, reserved prefixes,
 * folder collisions) lives in `project-name.ts`.
 */

/**
 * Asks for a project name until a valid one is entered. Accepts scoped
 * npm names (`@scope/name` - the folder becomes the base name). On EOF /
 * non-TTY resolves to the default immediately.
 */
export function promptProjectName(
  defaultName: string,
  cwd: string,
): Promise<string> {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultName);
  }

  return new Promise<string>((resolve) => {
    let settled = false;
    const finish = (name: string) => {
      if (settled) return;
      settled = true;
      resolve(name);
      rl.close();
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("close", () => {
      if (!settled) {
        console.log(`\n⚠ Input closed - using "${defaultName}"`);
        finish(defaultName);
      }
    });

    const ask = () => {
      if (settled) return;
      rl.question(
        `? Project name (npm name, e.g. \`@my-scope/my-app\`) [${defaultName}]: `,
        (input) => {
          const value = input.trim() || defaultName;
          const error = projectNameError(value, cwd);
          if (error) {
            console.log(`⚠ ${error}`);
            ask();
            return;
          }
          finish(value);
        },
      );
    };
    ask();
  });
}

/**
 * Yes/no confirmation. Accepts y/yes/true (case-insensitive); empty input
 * takes the default. On EOF / non-TTY resolves to the default.
 */
export function promptConfirm(
  question: string,
  defaultValue: boolean,
): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      resolve(value);
      rl.close();
    };

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.on("close", () => {
      if (!settled) {
        finish(defaultValue);
      }
    });

    const hint = defaultValue ? "[Y/n]" : "[y/N]";
    rl.question(`? ${question} ${hint}: `, (input) => {
      const value = input.trim().toLowerCase();
      if (value === "") {
        finish(defaultValue);
        return;
      }
      finish(value === "y" || value === "yes" || value === "true");
    });
  });
}
