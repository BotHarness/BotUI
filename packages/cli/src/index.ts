#!/usr/bin/env node
/**
 * `npx @botharness/botui add <component>` — copy a component into your project.
 *
 * Copy-and-own, not a dependency: after this runs, the code is yours to read, edit
 * and delete, with no BotUI in your package.json and nothing to keep up to date. That
 * is the deal, and it is why the install is a file write rather than an npm install.
 *
 * The registry is shadcn's format, so `npx shadcn@latest add <url>` installs the same
 * components. This CLI exists to be the shorter path: it resolves the URL for you,
 * follows registry dependencies, plans before it writes, and tells you exactly what
 * it did.
 */
import { relative, resolve } from "node:path";
import process from "node:process";
import {
  DEFAULT_REGISTRY,
  RegistryError,
  applyPlan,
  fetchRegistry,
  hash,
  planInstall,
  resolveItems,
} from "./registry.js";

const VERSION = "0.1.0";

const HELP = `botui ${VERSION} — open-source UI components for agent products

  npx @botharness/botui add <component>   copy a component into ./components
  npx @botharness/botui add all          copy every component
  npx @botharness/botui list             show what the registry offers
  npx @botharness/botui info <component> show one component in detail

Options
  --registry <url>   the registry to install from (default ${DEFAULT_REGISTRY})
  --cwd <dir>        where to write (default: the current directory)
  --dry-run          print the plan and change nothing
  --force            overwrite files that already differ
  --yes              do not ask before overwriting
  -h, --help         this text

The components are MIT licensed and you own the copy. See https://github.com/BotHarness/BotUI
`;

interface Flags {
  registry: string;
  cwd: string;
  dryRun: boolean;
  force: boolean;
  yes: boolean;
  help: boolean;
  rest: string[];
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {
    registry: process.env.BOTUI_REGISTRY ?? DEFAULT_REGISTRY,
    cwd: process.cwd(),
    dryRun: false,
    force: false,
    yes: false,
    help: false,
    rest: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--registry") flags.registry = argv[++i] ?? flags.registry;
    else if (arg === "--cwd") flags.cwd = resolve(argv[++i] ?? ".");
    else if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--force") flags.force = true;
    else if (arg === "--yes" || arg === "-y") flags.yes = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg.startsWith("--")) throw new RegistryError(`unknown option ${arg}`);
    else flags.rest.push(arg);
  }
  return flags;
}

async function main(): Promise<number> {
  let flags: Flags;
  try {
    flags = parseArgs(process.argv.slice(2));
  } catch (error) {
    return fail(error);
  }
  if (flags.help) {
    process.stdout.write(HELP);
    return 0;
  }
  const [command = "help", ...args] = flags.rest;

  switch (command) {
    case "help":
      process.stdout.write(HELP);
      return 0;
    case "add":
      return add(flags, args);
    case "list":
      return list(flags);
    case "info":
      return info(flags, args[0]);
    default:
      process.stderr.write(`botui: unknown command "${command}"\n\n${HELP}`);
      return 1;
  }
}

async function add(flags: Flags, names: string[]): Promise<number> {
  if (names.length === 0) {
    process.stderr.write("botui: add needs a component name. Try `npx @botharness/botui list`.\n");
    return 1;
  }

  const wanted =
    names[0] === "all" ? (await fetchRegistry(flags.registry)).items.map((i) => i.name) : names;
  const items: Awaited<ReturnType<typeof resolveItems>>["items"] = [];
  const pulled: string[] = [];
  for (const name of wanted) {
    try {
      const resolved = await resolveItems(name, flags.registry);
      items.push(...resolved.items);
      pulled.push(...resolved.pulled);
    } catch (error) {
      return fail(error, `could not resolve "${name}" — try \`npx @botharness/botui list\``);
    }
  }

  const plan = await planInstall(items, flags.cwd);
  const unique = [...new Set(pulled)];

  process.stdout.write(`\nbotui · ${items.length} component(s) from ${flags.registry}\n`);
  if (unique.length) process.stdout.write(`  pulled in: ${unique.join(", ")}\n`);
  process.stdout.write(`\n`);
  for (const entry of plan.writes.values()) {
    const clash = plan.conflicts.includes(entry.target);
    process.stdout.write(`  ${clash ? "update" : "create"}  ${entry.target}  ${entry.hash}\n`);
  }
  for (const target of plan.unchanged) process.stdout.write(`  same    ${target}\n`);

  if (plan.conflicts.length && !flags.force && !flags.yes) {
    process.stderr.write(
      `\n${plan.conflicts.length} file(s) already exist with different content:\n` +
        plan.conflicts.map((c) => `  ${c}`).join("\n") +
        "\n\nRe-run with --force to overwrite them, or --dry-run to look without touching anything.\n",
    );
    return 1;
  }

  if (flags.dryRun) {
    process.stdout.write(`\ndry run: nothing written. ${plan.writes.size} file(s) would change.\n`);
    return 0;
  }

  const written = await applyPlan(plan, flags.cwd);
  process.stdout.write(
    `\nwrote ${written.length} file(s) into ${relative(process.cwd(), flags.cwd) || "."}\n`,
  );

  if (plan.dependencies.length) {
    process.stdout.write(
      `\ninstall the dependencies it declares:\n  npm i ${plan.dependencies.join(" ")}\n`,
    );
  }

  const stylesheet = written.find((w) => w.endsWith(".css"));
  if (stylesheet) {
    process.stdout.write(
      `\nimport the stylesheet once, e.g.\n` +
        `  import './${stylesheet.replace(/\\/g, "/")}'\n` +
        `Only the CSS renderer needs it; the SVG renderer works without any CSS.\n`,
    );
  }
  process.stdout.write(`\nthe code is yours now — edit it, delete the BotUI name, ship it.\n`);
  return 0;
}

async function list(flags: Flags): Promise<number> {
  try {
    const registry = await fetchRegistry(flags.registry);
    process.stdout.write(
      `\n${registry.name} · ${registry.items.length} component(s) · ${registry.homepage}\n\n`,
    );
    const width = Math.max(...registry.items.map((i) => i.name.length));
    for (const item of registry.items) {
      process.stdout.write(`  ${item.name.padEnd(width)}  ${item.description ?? ""}\n`);
    }
    process.stdout.write(`\n  npx @botharness/botui add <name>\n\n`);
    return 0;
  } catch (error) {
    return fail(error);
  }
}

async function info(flags: Flags, name?: string): Promise<number> {
  if (!name) {
    process.stderr.write("botui: info needs a component name.\n");
    return 1;
  }
  try {
    const { items, pulled } = await resolveItems(name, flags.registry);
    const item = items.find((i) => i.name === name)!;
    process.stdout.write(`\n${item.title ?? item.name}  (${item.type})\n\n`);
    if (item.description) process.stdout.write(`${item.description}\n\n`);
    process.stdout.write(`  files:   ${item.files.length}\n`);
    for (const f of item.files) process.stdout.write(`    ${f.target ?? f.path}\n`);
    if (item.registryDependencies?.length) {
      process.stdout.write(`  needs:   ${item.registryDependencies.join(", ")}\n`);
    }
    if (pulled.length) process.stdout.write(`  pulled:  ${[...new Set(pulled)].join(", ")}\n`);
    if (item.docs) process.stdout.write(`  docs:    ${item.docs}\n`);
    process.stdout.write(`\n  hash: ${hash(item.files.map((f) => f.content).join(""))}\n\n`);
    return 0;
  } catch (error) {
    return fail(error);
  }
}

function fail(error: unknown, hint?: string): number {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`botui: ${message}\n`);
  if (hint) process.stderr.write(`       ${hint}\n`);
  return 1;
}

process.exitCode = await main();
