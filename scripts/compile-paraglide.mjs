import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "src/paraglide");
const paraglideEmitModuleUrl = pathToFileURL(
  path.join(
    repoRoot,
    "node_modules/@inlang/paraglide-js/dist/compiler/emit-ts-declarations.js",
  ),
).href;
const { emitTsDeclarations } = await import(paraglideEmitModuleUrl);

function runParaglideCompile() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "pnpm",
      [
        "exec",
        "paraglide-js",
        "compile",
        "--project",
        "./project.inlang",
        "--outdir",
        "./src/paraglide",
        "--strategy",
        "globalVariable",
        "baseLocale",
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
        shell: process.platform === "win32",
      },
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`paraglide compile exited with code ${code ?? "unknown"}`));
    });
  });
}

async function collectJavaScriptFiles(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  const jsFiles = [];

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      jsFiles.push(...(await collectJavaScriptFiles(rootDir, absolutePath)));
      continue;
    }
    if (!entry.isFile() || !absolutePath.endsWith(".js")) {
      continue;
    }
    const relativePath = path
      .relative(rootDir, absolutePath)
      .split(path.sep)
      .join(path.posix.sep);
    jsFiles.push(relativePath);
  }

  return jsFiles;
}

async function removeGeneratedDeclarations(rootDir, currentDir = rootDir) {
  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await removeGeneratedDeclarations(rootDir, absolutePath);
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith(".d.ts")) {
      await rm(absolutePath, { force: true });
    }
  }
}

async function emitDeclarations() {
  const jsFiles = await collectJavaScriptFiles(outDir);
  const output = {};

  for (const relativePath of jsFiles) {
    const absolutePath = path.join(outDir, relativePath);
    output[relativePath] = await readFile(absolutePath, "utf8");
  }

  const declarations = await emitTsDeclarations(output);
  const declarationEntries = Object.entries(declarations);

  if (declarationEntries.length === 0) {
    throw new Error("Paraglide compile did not emit declaration files.");
  }

  await removeGeneratedDeclarations(outDir);

  for (const [relativePath, content] of declarationEntries) {
    const absolutePath = path.join(outDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }
}

await runParaglideCompile();
await emitDeclarations();
