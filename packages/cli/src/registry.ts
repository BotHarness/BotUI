/**
 * The registry client: fetch, validate, plan, write.
 *
 * Kept apart from the command layer so the whole install path is testable without a
 * terminal, and so the rules that decide what lands on disk live in one file.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

export interface RegistryFile {
  path: string;
  content: string;
  type?: string;
  target?: string;
}

export interface RegistryItem {
  $schema?: string;
  name: string;
  type: string;
  title?: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  devDependencies?: string[];
  registryDependencies?: string[];
  files: RegistryFile[];
  categories?: string[];
  docs?: string;
  meta?: Record<string, unknown>;
}

export interface Registry {
  $schema?: string;
  name: string;
  homepage: string;
  items: RegistryItem[];
}

export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryError";
  }
}

/** where the published registry lives */
export const DEFAULT_REGISTRY = "https://ui.botharness.ai";

export function itemUrl(registry: string, name: string): string {
  return `${registry.replace(/\/$/, "")}/r/${name}.json`;
}

export async function fetchJson<T>(url: string, fetchImpl: typeof fetch = fetch): Promise<T> {
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { accept: "application/json" } });
  } catch (cause) {
    throw new RegistryError(`could not reach ${url}: ${(cause as Error).message}`);
  }
  if (!response.ok) {
    throw new RegistryError(`${url} returned ${response.status} ${response.statusText}`);
  }
  try {
    return (await response.json()) as T;
  } catch {
    throw new RegistryError(`${url} did not return JSON — is that a BotUI registry URL?`);
  }
}

export async function fetchItem(
  name: string,
  registry = DEFAULT_REGISTRY,
  fetchImpl: typeof fetch = fetch,
): Promise<RegistryItem> {
  const url = itemUrl(registry, name);
  const item = await fetchJson<RegistryItem>(url, fetchImpl);
  validateItem(item, name);
  return item;
}

export async function fetchRegistry(
  registry = DEFAULT_REGISTRY,
  fetchImpl: typeof fetch = fetch,
): Promise<Registry> {
  const url = `${registry.replace(/\/$/, "")}/registry.json`;
  const doc = await fetchJson<Registry>(url, fetchImpl);
  if (!Array.isArray(doc.items)) throw new RegistryError(`${url} has no items array`);
  return doc;
}

/**
 * Refuse an item we could not install correctly.
 *
 * Every check here corresponds to a way the install can go wrong on the USER's disk
 * rather than in our build: a file that escapes the project, a duplicate target that
 * silently overwrites, an item with nothing in it.
 */
export function validateItem(item: RegistryItem, expectedName?: string): void {
  const where =
    expectedName && expectedName !== item.name
      ? `${expectedName} (item says "${item.name}")`
      : item.name;
  if (!item || typeof item !== "object") throw new RegistryError(`${where}: not a registry item`);
  if (!item.name) throw new RegistryError(`${where}: an item needs a name`);
  if (!item.type) throw new RegistryError(`${where}: an item needs a type`);
  if (!Array.isArray(item.files) || item.files.length === 0) {
    throw new RegistryError(`${where}: the item ships no files`);
  }
  const targets = new Set<string>();
  for (const file of item.files) {
    if (!file.path) throw new RegistryError(`${where}: a file has no path`);
    if (typeof file.content !== "string")
      throw new RegistryError(`${where}: ${file.path} has no content`);
    const target = file.target ?? file.path;
    if (target.startsWith("/") || target.includes("..")) {
      throw new RegistryError(`${where}: refusing to write outside the project — ${target}`);
    }
    if (targets.has(target)) throw new RegistryError(`${where}: two files both target ${target}`);
    targets.add(target);
  }
}

export interface InstallPlan {
  /** absolute path → the bytes to put there */
  writes: Map<string, { item: string; target: string; content: string; hash: string }>;
  /** targets that already exist with different content */
  conflicts: string[];
  /** targets that already exist with identical content */
  unchanged: string[];
  /** npm dependencies the item declares */
  dependencies: string[];
  /** items pulled in through registryDependencies */
  pulled: string[];
}

export function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 12);
}

/**
 * Work out what an install would do, without doing it.
 *
 * Planning separately from writing is what makes `--dry-run` trustworthy and lets the
 * caller see a conflict before anything is touched. A file whose content already
 * matches is reported as unchanged rather than rewritten, so re-running an install
 * does not churn mtimes and invalidate anyone's build cache.
 */
export async function planInstall(
  items: RegistryItem[],
  cwd: string,
  read: (p: string) => Promise<string | null> = defaultRead,
): Promise<InstallPlan> {
  const writes = new Map<string, InstallPlan["writes"] extends Map<string, infer V> ? V : never>();
  const conflicts: string[] = [];
  const unchanged: string[] = [];
  const dependencies = new Set<string>();
  const pulled: string[] = [];

  for (const item of items) {
    validateItem(item);
    for (const dep of item.dependencies ?? []) dependencies.add(dep);
    for (const file of item.files) {
      const target = file.target ?? file.path;
      const abs = resolve(cwd, target);
      const existing = await read(abs);
      const entry = { item: item.name, target, content: file.content, hash: hash(file.content) };
      if (existing === null) writes.set(abs, entry);
      else if (hash(existing) === entry.hash) unchanged.push(target);
      else {
        conflicts.push(target);
        writes.set(abs, entry);
      }
    }
  }

  return { writes, conflicts, unchanged, dependencies: [...dependencies].sort(), pulled };
}

async function defaultRead(p: string): Promise<string | null> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

export async function applyPlan(plan: InstallPlan, cwd: string): Promise<string[]> {
  const written: string[] = [];
  for (const [abs, entry] of plan.writes) {
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, entry.content, "utf8");
    written.push(relative(cwd, abs));
  }
  return written;
}

/** every item an install needs, following registryDependencies breadth-first */
export async function resolveItems(
  name: string,
  registry = DEFAULT_REGISTRY,
  fetchImpl: typeof fetch = fetch,
): Promise<{ items: RegistryItem[]; pulled: string[] }> {
  const byName = new Map<string, RegistryItem>();
  const order: RegistryItem[] = [];
  const pulled: string[] = [];
  const queue = [name];
  while (queue.length) {
    const next = queue.shift()!;
    if (byName.has(next)) continue;
    const item = await fetchItem(next, registry, fetchImpl);
    byName.set(item.name, item);
    order.push(item);
    if (next !== name) pulled.push(item.name);
    for (const dep of item.registryDependencies ?? []) queue.push(dep);
  }
  // dependencies first, so a file that imports a sibling is written after it
  return { items: order.reverse(), pulled };
}
