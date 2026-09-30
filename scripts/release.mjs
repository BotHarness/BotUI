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

// The token goes into the environment of the publish processes only. It is not
// attached to the build/verify calls above: those need no credentials, and there
// is no reason for a secret to exist in a process that isn't publishing.
let publishEnv = process.env;
const token = readToken();
if (token && yes) {
  publishEnv = {
    ...process.env,
    // npm/pnpm both read npm config from the environment, so this is the seam that
    // needs no .npmrc. The key is the registry URL, verbatim — npm's config keys
    // are case-sensitive and this one is not a normal identifier.
    "npm_config_//registry.npmjs.org/:_authToken": token,
  };
}

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

const pnpm = (args, cwd, env) =>
  execFileSync("pnpm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], env });

/**
 * The publish token, if this machine has one.
 *
 * This account's 2FA is a passkey, which the CLI cannot answer — WebAuthn needs a
 * browser — so publishing has to go through a granular access token with "Bypass
 * 2FA" ticked. `scripts/npm-token.sh` collects one and writes it to
 * `npm_release.token` (gitignored, mode 600).
 *
 * It reaches npm as `npm_config_//registry.npmjs.org/:_authToken` in the child
 * process's environment, verified against the registry: the real token answers
 * `npm whoami` and a fake one gets E401. An argument would have been simpler but
 * argv is world-readable through `ps` and command lines land in CI logs. The
 * project `.npmrc` route was rejected on purpose — this repo has none on
 * purpose, and adding one would apply the token to every npm command run here,
 * `npm install` included, which is a wider blast radius than a release needs.
 *
 * Absent is not an error here: `npm publish` then reports precisely why, which
 * is a better message than this script could invent, and a dry run needs no token.
 */
function readToken() {
  const file = process.env.NPM_TOKEN_FILE ?? join(root, "npm_release.token");
  try {
    const token = readFileSync(file, "utf8").trim();
    return token || undefined;
  } catch {
    return undefined;
  }
}

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
  process.stdout.write(pnpm(args, root, publishEnv));
}

process.stdout.write(
  yes
    ? "\npublished. deploy the registry so the new version resolves:\n  pnpm --filter botui-site deploy\n"
    : "\ndry run. Re-run with --yes to publish, and --tag next for a prerelease.\n",
);
