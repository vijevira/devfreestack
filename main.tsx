/**
 * DevFreeStack server.
 *
 * `/api/*` is handled here; everything else falls through to the static file
 * server (index.html, admin.html, favicon.svg).
 *
 * Reads are public. Admin writes require a signed-in Val Town account whose
 * username matches ADMIN_VAL_USERNAME. Sessions are managed by Val Town OAuth.
 */
import { staticHTTPServer } from "https://esm.town/v/std/utils/index.ts";
import {
  getOAuthUserData,
  oauthMiddleware,
} from "https://esm.town/v/std/oauth/middleware.ts";
import {
  CATEGORY_IDS,
  TIERS,
  ValidationError,
  countTools,
  createTool,
  getTool,
  deleteTool,
  isDuplicateNameError,
  listTools,
  updateTool,
  validate,
} from "./db.ts";

const serveStatic = staticHTTPServer();

const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; "),
  "referrer-policy": "strict-origin-when-cross-origin",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

function secureResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

const fail = (message: string, status: number) => json({ error: message }, status);

async function getAdminSession(req: Request) {
  const session = await getOAuthUserData(req);
  if (!session?.user) return null;

  const allowedUsername = Deno.env.get("ADMIN_VAL_USERNAME")?.trim().toLowerCase();
  if (!allowedUsername) return null;

  const username = session.user.username?.trim().toLowerCase();
  if (!username || username !== allowedUsername) return null;

  return session;
}

async function handler(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);

  if (pathname === "/admin.html") {
    const session = await getAdminSession(req);
    if (!session) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/auth/login?returnTo=/admin.html" },
      });
    }
  }

  if (!pathname.startsWith("/api/")) return secureResponse(await serveStatic(req));

  try {
    /* ---------------- Reads (public) ---------------- */

    if (pathname === "/api/status" && req.method === "GET") {
      const admin = await getAdminSession(req);
      return json({
        authenticated: !!admin,
        writable: !!admin,
        configured: !!Deno.env.get("ADMIN_VAL_USERNAME"),
        count: await countTools(),
        categories: CATEGORY_IDS,
        tiers: TIERS,
      });
    }

    if (pathname === "/api/tools" && req.method === "GET") {
      return json({ tools: await listTools() });
    }

    const toolMatch = pathname.match(/^\/api\/tools\/(\d+)$/);
    if (toolMatch && req.method === "GET") {
      const id = Number(toolMatch[1]);
      const tool = await getTool(id);
      if (!tool) return fail(`No tool with id ${id}.`, 404);
      return json({ tool });
    }

    /* ---------------- Writes (Val Town account required) ---------------- */

    const admin = await getAdminSession(req);
    if (!admin) return fail("Admin authentication required. Open /admin.html and sign in with the authorized Val Town account.", 401);

    if (pathname === "/api/tools" && req.method === "POST") {
      const body = await req.json().catch(() => null);
      if (body === null) return fail("Request body must be valid JSON.", 400);
      const tool = await createTool(validate(body) as Parameters<typeof createTool>[0]);
      return json({ tool }, 201);
    }

    const match = pathname.match(/^\/api\/tools\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);

      if (req.method === "PATCH") {
        const body = await req.json().catch(() => null);
        if (body === null) return fail("Request body must be valid JSON.", 400);

        const patch = validate(body, true);
        if (Object.keys(patch).length === 0) {
          return fail("PATCH body must contain at least one editable field.", 400);
        }

        const tool = await updateTool(id, patch);
        if (!tool) return fail(`No tool with id ${id}.`, 404);
        return json({ tool });
      }

      if (req.method === "PUT") {
        const body = await req.json().catch(() => null);
        if (body === null) return fail("Request body must be valid JSON.", 400);

        const input = validate(body);
        const tool = await updateTool(id, input);
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

export default oauthMiddleware(handler);