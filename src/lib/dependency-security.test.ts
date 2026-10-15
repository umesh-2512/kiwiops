import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type PackageManifest = {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  overrides?: Record<string, string>;
};

const manifest = JSON.parse(
  readFileSync(join(process.cwd(), "package.json"), "utf8"),
) as PackageManifest;

describe("dependency security baseline", () => {
  it("keeps Next.js and its ESLint configuration on the same patched release", () => {
    expect(manifest.dependencies.next).toBe("16.4.1");
    expect(manifest.devDependencies["eslint-config-next"]).toBe("16.4.1");
  });

  it("uses the reviewed patched test runner and source-map implementation", () => {
    expect(manifest.devDependencies.vitest).toBe("4.1.11");
    expect(manifest.overrides?.["source-map-js"]).toBe("1.2.2");
  });
});
