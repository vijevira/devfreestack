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

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char] ?? char));
}

const CATEGORY_LABELS: Record<string, string> = {
  dns: "DNS & Domain", comms: "Communication & Email", ai: "AI & Coding",
  edge: "Frontend & Edge", paas: "Backend & PaaS", db: "Databases & Caching",
};

function toolPath(tool: { id: number }): string {
  return `/tools/${tool.id}`;
}

function renderSeoDirectory(tools: Awaited<ReturnType<typeof listTools>>): string {
  const links = tools.map((tool) => `
    <li>
      <a href="${toolPath(tool)}">${esc(tool.name)}</a>
      <span> — ${esc(tool.desc)}</span>
    </li>`).join("");
  return `
  <section class="mx-auto max-w-7xl px-4 pb-10 sm:px-6" aria-labelledby="directory-heading">
    <h2 id="directory-heading" class="text-xl font-bold text-white">Free Developer Tools Directory</h2>
    <p class="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
      Browse free hosting, databases, DNS, communication, AI, frontend, and backend tools.
      Open any tool for its free-tier details and official website.
    </p>
    <ul class="mt-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
      ${links}
    </ul>
  </section>`;
}

function renderToolPage(tool: Awaited<ReturnType<typeof getTool>> extends infer T ? Exclude<T, null> : never): string {
  const title = `${tool.name} — Free Developer Tool | DevFreeStack`;
  const description = `${tool.desc} Free tier: ${tool.tier}. Discover ${tool.name} on DevFreeStack.`;
  const categories = tool.cats.map((cat) => CATEGORY_LABELS[cat] ?? cat).join(", ");
  const canonical = `https://devfreestack.val.run${toolPath(tool)}`;
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    url: canonical,
    description: tool.desc,
    applicationCategory: "DeveloperApplication",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: tool.tier },
  }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description.slice(0, 160))}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DevFreeStack">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description.slice(0, 160))}">
<meta property="og:url" content="${canonical}">
<script type="application/ld+json">${jsonLd}</script>
<style>
body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:48px 20px;background:#070b0f;color:#cbd5e1;line-height:1.6}
a{color:#38bdf8} h1{color:#fff;line-height:1.15} .badge{display:inline-block;border:1px solid #334155;border-radius:8px;padding:3px 8px;font-size:12px}
</style>
</head>
<body>
<p><a href="/">← DevFreeStack</a></p>
<main>
<h1>${esc(tool.name)}</h1>
<p>${esc(tool.desc)}</p>
<p><span class="badge">${esc(tool.tier)}</span> <span class="badge">${esc(categories)}</span></p>
<p><a href="${esc(tool.url)}" rel="noopener noreferrer">Visit ${esc(tool.name)} →</a></p>
<h2>About ${esc(tool.name)}</h2>
<p>${esc(tool.name)} is listed in the DevFreeStack directory as a free developer resource. Its listed categories are ${esc(categories)} and its current directory tier is <strong>${esc(tool.tier)}</strong>.</p>
<p><a href="/">Browse all free developer tools →</a></p>
</main>
</body>
</html>`;
}

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

  if (pathname === "/robots.txt" && req.method === "GET") {
    return new Response(
      [
        "User-agent: *",
        "Allow: /",
        "Disallow: /admin.html",
        "Disallow: /api/",
        "Sitemap: https://devfreestack.val.run/sitemap.xml",
      ].join("\n") + "\n",
      { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } },
    );
  }

  if (pathname === "/sitemap.xml" && req.method === "GET") {
    const tools = await listTools();
    const urls = [
      "https://devfreestack.val.run/",
      ...tools.map((tool) => `https://devfreestack.val.run${toolPath(tool)}`),
    ];
    return new Response(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((url) => `  <url><loc>${esc(url)}</loc></url>`),
        "</urlset>",
      ].join("\n") + "\n",
      { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "no-store" } },
    );
  }

  if (pathname === "/admin.html") {
    const session = await getAdminSession(req);
    if (!session) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/auth/login?returnTo=/admin.html" },
      });
    }
  }

  // Public, crawlable tool pages give search engines stable URLs for each directory entry.
  const publicToolMatch = pathname.match(/^\/tools\/(\d+)$/);
  if (publicToolMatch && req.method === "GET") {
    const tool = await getTool(Number(publicToolMatch[1]));
    if (!tool) return new Response("Not found", { status: 404 });
    return secureResponse(new Response(renderToolPage(tool), {
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
    }));
  }

  if (pathname === "/" && req.method === "GET") {
    const response = await serveStatic(req);
    if (!response.ok) return secureResponse(response);
    const html = await response.text();
    const tools = await listTools();
    const seoSection = renderSeoDirectory(tools);
    return secureResponse(new Response(
      html.replace('<main id="tools"', seoSection + '\n  <main id="tools"'),
      { status: response.status, headers: response.headers },
    ));
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