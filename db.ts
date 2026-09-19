/**
 * Data layer for DevFreeStack.
 *
 * Tools live in the val's project-scoped SQLite database. `cats` is stored as a
 * comma-separated string rather than a join table — at directory scale (tens to
 * low hundreds of rows) a join adds ceremony without buying anything, and
 * filtering happens client-side anyway.
 */
import { sqlite } from "https://esm.town/v/std/sqlite/main.ts";
import { SEED_TOOLS } from "./seed-data.ts";

export const CATEGORY_IDS = ["dns", "comms", "ai", "edge", "paas", "db", "storage"] as const;
export const TIERS = ["Forever Free", "Free Tier", "Open Source"] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type ToolInput = {
  name: string;
  cats: string[];
  tier: string;
  icon: string;
  url: string;
  desc: string;
  code?: { label: string; value: string } | null;
};

export type Tool = ToolInput & { id: number; sortOrder: number };

/** Thrown for bad input so the HTTP layer can return 400 with a useful message. */
export class ValidationError extends Error {}

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

let ready: Promise<void> | null = null;

/** Idempotent schema setup + first-run seeding. Safe to call per request. */
export function initDb(): Promise<void> {
  if (!ready) ready = migrate().catch((err) => { ready = null; throw err; });
  return ready;
}

async function migrate() {
  await sqlite.execute(`CREATE TABLE IF NOT EXISTS tools (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    cats        TEXT    NOT NULL DEFAULT '',
    tier        TEXT    NOT NULL DEFAULT 'Free Tier',
    icon        TEXT    NOT NULL DEFAULT 'wrench',
    url         TEXT    NOT NULL DEFAULT '',
    description TEXT    NOT NULL DEFAULT '',
    code_label  TEXT,
    code_value  TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`);

  // Case-insensitive uniqueness on name, so "Neon" and "neon" can't both exist.
  // Uses COLLATE NOCASE rather than an expression index on lower(name) — the
  // latter is rejected by the backing database with a 500.
  await sqlite.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS tools_name_unique ON tools (name COLLATE NOCASE)`,
  );

  const { rows } = await sqlite.execute("SELECT COUNT(*) AS n FROM tools");
  if (Number(rows[0]?.n ?? 0) === 0) await seed();
  else await ensureSeedTools();
}

async function seed() {
  await sqlite.batch(
    SEED_TOOLS.map((t, i) => ({
      sql: `INSERT INTO tools (name, cats, tier, icon, url, description, code_label, code_value, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.name,
        t.cats.join(","),
        t.tier,
        t.icon,
        t.url,
        t.desc,
        t.code?.label ?? null,
        t.code?.value ?? null,
        i,
      ],
    })),
  );
}

async function ensureSeedTools() {
  const { rows } = await sqlite.execute("SELECT COALESCE(MAX(sort_order), -1) AS max FROM tools");
  let nextOrder = Number(rows[0]?.max ?? -1) + 1;

  for (const t of SEED_TOOLS) {
    const result = await sqlite.execute({
      sql: `INSERT OR IGNORE INTO tools (name, cats, tier, icon, url, description, code_label, code_value, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.name,
        t.cats.join(","),
        t.tier,
        t.icon,
        t.url,
        t.desc,
        t.code?.label ?? null,
        t.code?.value ?? null,
        nextOrder,
      ],
    });
    if (Number(result.rowsAffected ?? 0) > 0) nextOrder += 1;
  }
}

/** Wipe and re-seed from seed-data.ts. Destructive — for development. */
export async function resetSeed(): Promise<number> {
  await initDb();
  await sqlite.execute("DELETE FROM tools");
  await sqlite.execute("DELETE FROM sqlite_sequence WHERE name = 'tools'");
  await seed();
  return SEED_TOOLS.length;
}

/* ------------------------------------------------------------------ */
/* Row mapping                                                         */
/* ------------------------------------------------------------------ */

type Row = Record<string, unknown>;

function toTool(row: Row): Tool {
  const label = row.code_label == null ? "" : String(row.code_label);
  const value = row.code_value == null ? "" : String(row.code_value);
  return {
    id: Number(row.id),
    name: String(row.name),
    cats: String(row.cats).split(",").map((c) => c.trim()).filter(Boolean),
    tier: String(row.tier),
    icon: String(row.icon),
    url: String(row.url),
    desc: String(row.description),
    code: value ? { label: label || "Code", value } : null,
    sortOrder: Number(row.sort_order),
  };
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function str(value: unknown, field: string, { max = 2000, required = true } = {}): string {
  const s = typeof value === "string" ? value.trim() : "";
  if (required && !s) throw new ValidationError(`${field} is required`);
  if (s.length > max) throw new ValidationError(`${field} must be ${max} characters or fewer`);
  return s;
}

export function validate(input: unknown, partial = false): Partial<ToolInput> {
  if (typeof input !== "object" || input === null) {
    throw new ValidationError("Expected a JSON object");
  }
  const body = input as Record<string, unknown>;
  const out: Partial<ToolInput> = {};

  if (!partial || "name" in body) out.name = str(body.name, "Name", { max: 80 });
  if (!partial || "desc" in body) out.desc = str(body.desc, "Description", { max: 400 });

  if (!partial || "url" in body) {
    const url = str(body.url, "URL", { max: 500 });
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new ValidationError("URL must be a valid absolute URL, e.g. https://example.com");
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError("URL must start with http:// or https://");
    }
    out.url = url;
  }

  if (!partial || "tier" in body) {
    const tier = str(body.tier, "Tier", { max: 40 });
    if (!(TIERS as readonly string[]).includes(tier)) {
      throw new ValidationError(`Tier must be one of: ${TIERS.join(", ")}`);
    }
    out.tier = tier;
  }

  if (!partial || "cats" in body) {
    const raw = body.cats;
    const cats = Array.isArray(raw)
      ? raw.map((c) => String(c).trim()).filter(Boolean)
      : String(raw ?? "").split(",").map((c) => c.trim()).filter(Boolean);
    if (cats.length === 0) throw new ValidationError("Pick at least one category");
    const bad = cats.filter((c) => !(CATEGORY_IDS as readonly string[]).includes(c));
    if (bad.length) throw new ValidationError(`Unknown category: ${bad.join(", ")}`);
    out.cats = [...new Set(cats)];
  }

  if (!partial || "icon" in body) {
    const icon = str(body.icon, "Icon", { required: false, max: 60 });
    out.icon = icon || "wrench";
  }

  if (!partial || "code" in body) {
    const raw = body.code;
    if (raw == null || raw === "") {
      out.code = null;
    } else if (typeof raw === "object") {
      const c = raw as Record<string, unknown>;
      const value = str(c.value, "Code value", { required: false, max: 120 });
      out.code = value ? { label: str(c.label, "Code label", { required: false, max: 40 }) || "Code", value } : null;
    } else {
      out.code = { label: "Code", value: str(raw, "Code value", { max: 120 }) };
    }
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* CRUD                                                                */
/* ------------------------------------------------------------------ */

export async function listTools(): Promise<Tool[]> {
  await initDb();
  const { rows } = await sqlite.execute(
    "SELECT * FROM tools ORDER BY sort_order ASC, lower(name) ASC",
  );
  return rows.map(toTool);
}

export async function getTool(id: number): Promise<Tool | null> {
  await initDb();
  const { rows } = await sqlite.execute({ sql: "SELECT * FROM tools WHERE id = ?", args: [id] });
  return rows.length ? toTool(rows[0]) : null;
}

export async function countTools(): Promise<number> {
  await initDb();
  const { rows } = await sqlite.execute("SELECT COUNT(*) AS n FROM tools");
  return Number(rows[0]?.n ?? 0);
}

export async function createTool(input: ToolInput): Promise<Tool> {
  await initDb();
  const { rows } = await sqlite.execute(
    "SELECT COALESCE(MAX(sort_order), -1) AS max FROM tools",
  );
  const nextOrder = Number(rows[0]?.max ?? -1) + 1;

  const result = await sqlite.execute({
    sql: `INSERT INTO tools (name, cats, tier, icon, url, description, code_label, code_value, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      input.name,
      input.cats.join(","),
      input.tier,
      input.icon,
      input.url,
      input.desc,
      input.code?.label ?? null,
      input.code?.value ?? null,
      nextOrder,
    ],
  });

  return (await getTool(Number(result.lastInsertRowid)))!;
}

export async function updateTool(
  id: number,
  input: Partial<ToolInput>,
): Promise<Tool | null> {
  await initDb();
  const existing = await getTool(id);
  if (!existing) return null;

  const fields: string[] = [];
  const args: unknown[] = [];

  if ("name" in input) {
    fields.push("name = ?");
    args.push(input.name);
  }
  if ("cats" in input) {
    fields.push("cats = ?");
    args.push(input.cats!.join(","));
  }
  if ("tier" in input) {
    fields.push("tier = ?");
    args.push(input.tier);
  }
  if ("icon" in input) {
    fields.push("icon = ?");
    args.push(input.icon);
  }
  if ("url" in input) {
    fields.push("url = ?");
    args.push(input.url);
  }
  if ("desc" in input) {
    fields.push("description = ?");
    args.push(input.desc);
  }
  if ("code" in input) {
    fields.push("code_label = ?", "code_value = ?");
    args.push(input.code?.label ?? null, input.code?.value ?? null);
  }

  if (fields.length === 0) return existing;

  fields.push("updated_at = datetime('now')");
  args.push(id);

  await sqlite.execute({
    sql: `UPDATE tools SET ${fields.join(", ")} WHERE id = ?`,
    args,
  });

  return getTool(id);
}

export async function deleteTool(id: number): Promise<boolean> {
  await initDb();
  const existing = await getTool(id);
  if (!existing) return false;
  await sqlite.execute({ sql: "DELETE FROM tools WHERE id = ?", args: [id] });
  return true;
}

/** Translate a SQLite unique-constraint failure into a friendly message. */
export function isDuplicateNameError(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}