#!/usr/bin/env node
/**
 * Publish the packages, in dependency order.
 *
 * Order is the whole job: `@botharness/botui-react` depends on `@botharness/botui-core`
 * with `workspace:*`, which pnpm rewrites to the real version on publish. Publishing
 * the wrapper first would put a version on npm that resolves to nothing.
 *
 * Dry run unless `--yes`. A publish cannot be undone, and the registry is served
 * from this repo's build rather than from npm, so there is no urgency that would
 * justify skipping the check.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const yes = process.argv.includes("--yes");
const tag = process.argv.includes("--tag")
  ? process.argv[process.argv.indexOf("--tag") + 1]
  : undefined;

// dependency order, and the reason for it
const ORDER = [
  {
    dir: "packages/core",
    name: "@botharness/botui-core",
    why: "the engine everything else builds on",
  },
  { dir: "packages/react", name: "@botharness/botui-react", why: "depends on core" },
  { dir: "packages/cli", name: "@botharness/botui", why: "the installer; depends on nothing" },
];

const pnpm = (args, cwd) =>
  execFileSync("pnpm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });

// the registry is what a user installs, so it has to be current BEFORE anything goes
// to npm — otherwise `npx @botharness/botui` resolves a version whose registry item
// does not exist yet
process.stdout.write("building (packages → css → registry → site)…\n");
pnpm(["build"], root);
pnpm(["verify"], root);

for (const pkg of ORDER) {
  const version = JSON.parse(readFileSync(join(root, pkg.dir, "package.json"), "utf8")).version;
  process.stdout.write(`\n${pkg.name}@${version}  — ${pkg.why}\n`);
  if (!yes) {
    process.stdout.write(
      `  would run: pnpm --filter ${pkg.name} publish --access public${tag ? ` --tag ${tag}` : ""}\n`,
    );
    continue;
  }
  const args = ["--filter", pkg.name, "publish", "--access", "public", "--no-git-checks"];
  if (tag) args.push("--tag", tag);
  process.stdout.write(pnpm(args, root));
}

process.stdout.write(
  yes
    ? "\npublished. deploy the registry so the new version resolves:\n  pnpm --filter botui-site deploy\n"
    : "\ndry run. Re-run with --yes to publish, and --tag next for a prerelease.\n",
);
