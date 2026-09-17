/**
 * DevFreeStack server.
 *
 * `/api/*` is handled here; everything else falls through to the static file
 * server (index.html, admin.html, favicon.svg).
 *
 * Reads are public. Writes require the ADMIN_KEY environment variable, sent by
 * the admin UI as an `X-Admin-Key` header — without it anyone who found the URL
 * could edit the directory.
 */
import { staticHTTPServer } from "https://esm.town/v/std/utils/index.ts";
import {
  CATEGORY_IDS,
  TIERS,
  ValidationError,
  countTools,
  createTool,
  deleteTool,
  isDuplicateNameError,
  listTools,
  updateTool,
  validate,
} from "./db.ts";

const serveStatic = staticHTTPServer();

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

const fail = (message: string, status: number) => json({ error: message }, status);

/**
 * Write access check.
 * Returns "ok", "missing" (no key configured on the val), or "denied".
 */
function checkAdmin(req: Request): "ok" | "missing" | "denied" {
  const expected = Deno.env.get("ADMIN_KEY") ?? "";
  if (!expected) return "missing";

  const given = req.headers.get("x-admin-key") ?? "";
  if (given.length !== expected.length) return "denied";

  // Constant-time-ish compare: don't bail early on the first mismatched byte.
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0 ? "ok" : "denied";
}

export default async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (!pathname.startsWith("/api/")) return serveStatic(req);

  try {
    /* ---------------- Reads (public) ---------------- */

    if (pathname === "/api/status" && req.method === "GET") {
      return json({
        writable: checkAdmin(req) === "ok",
        configured: (Deno.env.get("ADMIN_KEY") ?? "").length > 0,
        count: await countTools(),
        categories: CATEGORY_IDS,
        tiers: TIERS,
      });
    }

    if (pathname === "/api/tools" && req.method === "GET") {
      return json({ tools: await listTools() });
    }

    /* ---------------- Writes (admin key required) ---------------- */

    const auth = checkAdmin(req);
    if (auth === "missing") {
      return fail(
        "Writes are disabled: set the ADMIN_KEY environment variable on this val to enable the admin API.",
        503,
      );
    }
    if (auth === "denied") return fail("Invalid or missing X-Admin-Key header.", 401);

    if (pathname === "/api/tools" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (body === null) return fail("Request body must be valid JSON.", 400);
      const tool = await createTool(validate(body) as Parameters<typeof createTool>[0]);
      return json({ tool }, 201);
    }

    const match = pathname.match(/^\/api\/tools\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);

      if (req.method === "PUT" || req.method === "PATCH") {
        const body = await req.json().catch(() => null);
        if (body === null) return fail("Request body must be valid JSON.", 400);
        const tool = await updateTool(id, validate(body) as Parameters<typeof updateTool>[1]);
        if (!tool) return fail(`No tool with id ${id}.`, 404);
        return json({ tool });
      }

      if (req.method === "DELETE") {
        const ok = await deleteTool(id);
        if (!ok) return fail(`No tool with id ${id}.`, 404);
        return json({ deleted: id });
      }
    }

    return fail(`No API route for ${req.method} ${pathname}.`, 404);
  } catch (err) {
    if (err instanceof ValidationError) return fail(err.message, 400);
    if (isDuplicateNameError(err)) return fail("A tool with that name already exists.", 409);

    console.error("Unhandled error:", err);
    return fail("Something went wrong on the server.", 500);
  }
}