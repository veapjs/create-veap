import fs from "node:fs";
import path from "node:path";

export function processStubs(
  srcDir: string,
  destDir: string,
  variables: Record<string, string>,
) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    let destName = entry.name;
    for (const [key, value] of Object.entries(variables)) {
      destName = destName.replace(
        new RegExp("\\{\\{" + key + "\\}\\}", "g"),
        value,
      );
    }

    if (destName.endsWith(".stub")) {
      destName = destName.slice(0, -5);
    }

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, destName);

    if (entry.isDirectory()) {
      processStubs(srcPath, destPath, variables);
    } else {
      let content = fs.readFileSync(srcPath, "utf-8");
      for (const [key, value] of Object.entries(variables)) {
        content = content.replace(
          new RegExp("\\{\\{" + key + "\\}\\}", "g"),
          value,
        );
      }
      fs.writeFileSync(destPath, content);
    }
  }
}
