/**
 * Node loader for scripts: resolve `@/` → `src/` and extensionless relative imports → `.ts`.
 */
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const srcRoot = path.join(appRoot, "src");

if (!globalThis.__rbTsAppLoader) {
  globalThis.__rbTsAppLoader = true;
  register(import.meta.url);
}

async function resolveWithExtensions(basePath, context, nextResolve) {
  for (const ext of [".ts", ".tsx", ""]) {
    const candidate = ext ? `${basePath}${ext}` : basePath;
    try {
      return await nextResolve(pathToFileURL(candidate).href, context);
    } catch {
      // try next extension
    }
  }
  return nextResolve(pathToFileURL(basePath).href, context);
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const sub = specifier.slice(2);
    const basePath = path.join(srcRoot, sub);
    return resolveWithExtensions(basePath, context, nextResolve);
  }

  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (isRelative && !path.extname(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }

  return nextResolve(specifier, context);
}
