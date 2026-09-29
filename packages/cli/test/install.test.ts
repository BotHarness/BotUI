import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  RegistryError,
  fetchItem,
  fetchRegistry,
  hash,
  itemUrl,
  planInstall,
  resolveItems,
  validateItem,
  type RegistryItem,
} from "../src/registry.js";

const run = promisify(execFile);
const repo = join(import.meta.dirname, "..", "..", "..");
const publicDir = join(repo, "apps", "site", "public");
const cli = join(repo, "packages", "cli", "dist", "index.js");

/**
 * The registry is served over HTTP for the whole suite, because "the CLI works" is a
 * claim about a URL, not about a function. A test that imports the planner directly
 * would pass even if the fetcher, the URL shape or the exit code were all wrong.
 */
let server: Server;
let origin: string;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const path = (req.url ?? "/").split("?")[0]!;
    try {
      const body = await readFile(join(publicDir, path === "/" ? "index.html" : path));
      res.writeHead(200, {
        "content-type": path.endsWith(".json") ? "application/json" : "text/html",
      });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

const scratch = () => mkdtemp(join(tmpdir(), "botui-test-"));

describe("the registry document", () => {
  it("is served and lists components", async () => {
    const registry = await fetchRegistry(origin);
    expect(registry.name).toBe("botui");
    expect(registry.items.length).toBeGreaterThan(0);
    expect(registry.items.map((i) => i.name)).toContain("dot-matrix");
  });

  it("serves each item at the URL shadcn expects", async () => {
    // the shape is the compatibility promise: /r/<name>.json, so
    // `npx shadcn@latest add <url>` works against this registry too
    expect(itemUrl(origin, "dot-matrix")).toBe(`${origin}/r/dot-matrix.json`);
    const item = await fetchItem("dot-matrix", origin);
    expect(item.type).toBe("registry:component");
    expect(item.files.length).toBeGreaterThan(5);
  });

  it("reports a 404 as a useful error, not a stack trace", async () => {
    await expect(fetchItem("no-such-component", origin)).rejects.toThrow(/404/);
  });

  it("every served item passes its own validation", async () => {
    for (const item of (await fetchRegistry(origin)).items) {
      expect(() => validateItem(item)).not.toThrow();
    }
  });
});

describe("validation", () => {
  const good: RegistryItem = {
    name: "x",
    type: "registry:component",
    files: [{ path: "a/b.ts", content: "export {}", target: "a/b.ts" }],
  };

  it("accepts a well-formed item", () => {
    expect(() => validateItem(good)).not.toThrow();
  });

  it("refuses a target that escapes the project", () => {
    // the one check that protects the user's disk from a hostile or broken registry
    expect(() =>
      validateItem({
        ...good,
        files: [{ ...good.files[0]!, target: "../../.ssh/authorized_keys" }],
      }),
    ).toThrow(/outside the project/);
  });

  it("refuses an absolute target", () => {
    expect(() =>
      validateItem({ ...good, files: [{ ...good.files[0]!, target: "/etc/passwd" }] }),
    ).toThrow(/outside the project/);
  });

  it("refuses two files claiming one target", () => {
    const files = [good.files[0]!, { ...good.files[0]!, content: "other" }];
    expect(() => validateItem({ ...good, files })).toThrow(/both target/);
  });

  it("refuses an empty item", () => {
    expect(() => validateItem({ ...good, files: [] })).toThrow(/ships no files/);
  });
});

describe("planning", () => {
  const item = (name: string, files: [string, string][]): RegistryItem => ({
    name,
    type: "registry:component",
    files: files.map(([path, content]) => ({ path, content, target: path })),
  });

  it("reports a fresh install as all creates", async () => {
    const dir = await scratch();
    const plan = await planInstall([item("a", [["x.ts", "one"]])], dir);
    expect(plan.writes.size).toBe(1);
    expect(plan.conflicts).toEqual([]);
    expect(plan.unchanged).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("reports identical content as unchanged rather than rewriting it", async () => {
    // re-running an install must not churn mtimes and invalidate a build cache
    const dir = await scratch();
    await mkdir(join(dir, "components"), { recursive: true });
    await writeFile(join(dir, "components/x.ts"), "one");
    const plan = await planInstall([item("a", [["components/x.ts", "one"]])], dir);
    expect(plan.unchanged).toEqual(["components/x.ts"]);
    expect(plan.writes.size).toBe(0);
    await rm(dir, { recursive: true, force: true });
  });

  it("reports different content as a conflict, and still plans the write", async () => {
    const dir = await scratch();
    await mkdir(join(dir, "components"), { recursive: true });
    await writeFile(join(dir, "components/x.ts"), "theirs");
    const plan = await planInstall([item("a", [["components/x.ts", "ours"]])], dir);
    expect(plan.conflicts).toEqual(["components/x.ts"]);
    expect(plan.writes.size).toBe(1);
    await rm(dir, { recursive: true, force: true });
  });

  it("collects declared dependencies", async () => {
    const dir = await scratch();
    const plan = await planInstall(
      [{ ...item("a", [["x.ts", "1"]]), dependencies: ["zod", "clsx"] }],
      dir,
    );
    expect(plan.dependencies).toEqual(["clsx", "zod"]);
    await rm(dir, { recursive: true, force: true });
  });
});

describe("dependency resolution", () => {
  it("pulls registry dependencies and writes them first", async () => {
    const { items, pulled } = await resolveItems("dot-matrix-react", origin);
    expect(pulled).toContain("dot-matrix");
    // a file that imports a sibling must be written after the sibling exists
    expect(items.findIndex((i) => i.name === "dot-matrix")).toBeLessThan(
      items.findIndex((i) => i.name === "dot-matrix-react"),
    );
  });

  it("terminates on a dependency cycle", async () => {
    const cyclic: RegistryItem = {
      name: "a",
      type: "registry:component",
      files: [],
      registryDependencies: ["b"],
    };
    const other: RegistryItem = {
      name: "b",
      type: "registry:component",
      files: [],
      registryDependencies: ["a"],
    };
    const fakeFetch = (async (url: string) => {
      const name = url.split("/").pop()!.replace(".json", "");
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => (name === "a" ? cyclic : other),
      } as Response;
    }) as unknown as typeof fetch;
    await expect(resolveItems("a", origin, fakeFetch)).rejects.toThrow(/ships no files/);
  });
});

describe("the CLI, end to end", () => {
  const cliRun = async (args: string[], cwd?: string) => {
    try {
      const { stdout, stderr } = await run(process.execPath, [cli, ...args], { cwd });
      return { code: 0, stdout, stderr };
    } catch (error) {
      const e = error as { code?: number; stdout?: string; stderr?: string };
      return { code: e.code ?? 1, stdout: e.stdout ?? "", stderr: e.stderr ?? "" };
    }
  };

  it("prints help with no arguments, and exits 0", async () => {
    const { code, stdout } = await cliRun([]);
    expect(code).toBe(0);
    expect(stdout).toContain("npx @botharness/botui add");
  });

  it("lists what the registry offers", async () => {
    const { code, stdout } = await cliRun(["list", "--registry", origin]);
    expect(code).toBe(0);
    expect(stdout).toContain("dot-matrix");
  });

  it("shows one component in detail", async () => {
    const { code, stdout } = await cliRun(["info", "dot-matrix", "--registry", origin]);
    expect(code).toBe(0);
    expect(stdout).toContain("files:");
  });

  it("refuses an unknown component with a hint, not a stack trace", async () => {
    const { code, stderr } = await cliRun(["add", "nope", "--registry", origin]);
    expect(code).toBe(1);
    expect(stderr).toContain("nope");
    expect(stderr).not.toContain("at RegistryError");
  });

  it("rejects an unknown option instead of ignoring it", async () => {
    // silently ignoring a typo'd flag is how someone ends up installing to the wrong
    // place and not finding out until later
    const { code, stderr } = await cliRun(["add", "dot-matrix", "--reigstry", origin]);
    expect(code).toBe(1);
    expect(stderr).toContain("unknown option");
  });

  it("a dry run writes nothing at all", async () => {
    const dir = await scratch();
    const { code, stdout } = await cliRun([
      "add",
      "dot-matrix",
      "--registry",
      origin,
      "--cwd",
      dir,
      "--dry-run",
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("dry run");
    expect(await readdir(dir)).toEqual([]);
    await rm(dir, { recursive: true, force: true });
  });

  it("installs a component into an empty project", async () => {
    const dir = await scratch();
    const { code, stdout } = await cliRun([
      "add",
      "dot-matrix",
      "--registry",
      origin,
      "--cwd",
      dir,
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("wrote");

    // the barrel re-exports; the implementation lives in dot-matrix/matrix.ts
    const entry = join(dir, "components/botui/index.ts");
    expect(await readFile(entry, "utf8")).toContain("createDotMatrix");
    expect(await readFile(join(dir, "components/botui/dot-matrix/matrix.ts"), "utf8")).toContain(
      "export function createDotMatrix",
    );
    // the stylesheet travels with it, sitting next to the layer that generates it
    expect(
      await readFile(join(dir, "components/botui/dot-matrix/dot-matrix.css"), "utf8"),
    ).toContain("@keyframes");
    // and nothing escaped the target directory
    expect(await readdir(dir)).toEqual(["components"]);
    await rm(dir, { recursive: true, force: true });
  });

  it("installs the React wrapper AND its engine, in that order", async () => {
    const dir = await scratch();
    const { code, stdout } = await cliRun([
      "add",
      "dot-matrix-react",
      "--registry",
      origin,
      "--cwd",
      dir,
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("pulled in: dot-matrix");
    // the wrapper must not import a package the user does not have
    const wrapper = await readFile(join(dir, "components/botui-react/index.tsx"), "utf8");
    expect(wrapper).not.toContain("@botharness/botui-core");
    expect(wrapper).toContain("../botui/index.js");
    await rm(dir, { recursive: true, force: true });
  });

  it("a second install is a no-op, not a rewrite", async () => {
    const dir = await scratch();
    await cliRun(["add", "dot-matrix", "--registry", origin, "--cwd", dir]);
    const { code, stdout } = await cliRun([
      "add",
      "dot-matrix",
      "--registry",
      origin,
      "--cwd",
      dir,
    ]);
    expect(code).toBe(0);
    expect(stdout).toContain("same ");
    expect(stdout).not.toMatch(/^\s+create /m);
    await rm(dir, { recursive: true, force: true });
  });

  it("stops at a conflict and says how to proceed", async () => {
    const dir = await scratch();
    await mkdir(join(dir, "components/botui"), { recursive: true });
    await writeFile(join(dir, "components/botui/index.ts"), "// mine, hand-edited\n");
    const { code, stderr } = await cliRun([
      "add",
      "dot-matrix",
      "--registry",
      origin,
      "--cwd",
      dir,
    ]);
    expect(code).toBe(1);
    expect(stderr).toContain("--force");
    // and it really did not touch the file
    expect(await readFile(join(dir, "components/botui/index.ts"), "utf8")).toBe(
      "// mine, hand-edited\n",
    );

    const forced = await cliRun([
      "add",
      "dot-matrix",
      "--registry",
      origin,
      "--cwd",
      dir,
      "--force",
    ]);
    expect(forced.code).toBe(0);
    expect(await readFile(join(dir, "components/botui/index.ts"), "utf8")).toContain(
      "createDotMatrix",
    );
    await rm(dir, { recursive: true, force: true });
  });

  it("the installed copy is self-contained: every relative import resolves", async () => {
    // the failure this prevents is the user's build breaking on a file we shipped
    const dir = await scratch();
    await cliRun(["add", "all", "--registry", origin, "--cwd", dir]);
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(p)));
        else out.push(p);
      }
      return out;
    };
    const files = await walk(dir);
    const paths = new Set(files);
    for (const file of files.filter((f) => /\.(ts|tsx)$/.test(f))) {
      const source = await readFile(file, "utf8");
      for (const spec of [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]!)) {
        const base = join(file, "..", spec).replace(/\.js$/, ".ts");
        const alt = join(file, "..", spec).replace(/\.js$/, ".tsx");
        expect(
          paths.has(base) || paths.has(alt),
          `${file.replace(dir, "")} imports ${spec}, which is not in the install`,
        ).toBe(true);
      }
      // nothing may import a package the item did not declare
      for (const spec of [...source.matchAll(/from\s+['"]([^.'"][^'"]*)['"]/g)].map((m) => m[1]!)) {
        expect(["react", "react-dom", "react/jsx-runtime"], `${file} imports ${spec}`).toContain(
          spec,
        );
      }
      await stat(file);
    }
    await rm(dir, { recursive: true, force: true });
  });

  it("the installed engine is byte-identical to the source it came from", async () => {
    // copy-and-own is only honest if the copy IS the original
    const dir = await scratch();
    await cliRun(["add", "dot-matrix", "--registry", origin, "--cwd", dir]);
    const pairs: [string, string][] = [
      ["packages/core/src/index.ts", "components/botui/index.ts"],
      ["packages/core/src/types.ts", "components/botui/types.ts"],
      ["packages/core/src/dot-matrix/layout.ts", "components/botui/dot-matrix/layout.ts"],
      ["packages/core/src/dot-matrix/matrix.ts", "components/botui/dot-matrix/matrix.ts"],
    ];
    for (const [from, to] of pairs) {
      const a = await readFile(join(repo, from), "utf8");
      const b = await readFile(join(dir, to), "utf8");
      expect(hash(b), `${to} differs from ${from}`).toBe(hash(a));
    }
    await rm(dir, { recursive: true, force: true });
  });
});

describe("RegistryError", () => {
  it("is a named error, so a caller can tell it from a bug", () => {
    const e = new RegistryError("nope");
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("RegistryError");
  });
});
