/**
 * Node custom loader: retry extensionless relative specifiers with `.ts`.
 * Lets `test:unit` (`node --experimental-strip-types`) load production
 * modules that use Next/bundler-style extensionless imports.
 */
import { register } from "node:module";
import path from "node:path";

if (!globalThis.__rbTsRelativeLoader) {
  globalThis.__rbTsRelativeLoader = true;
  register(import.meta.url);
}

export async function resolve(specifier, context, nextResolve) {
  const isRelative =
    specifier.startsWith("./") || specifier.startsWith("../");
  if (isRelative && !path.extname(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
