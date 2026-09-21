/**
 * Initial directory contents.
 *
 * Used only to populate an empty `tools` table — once seeded, edits happen
 * through the admin UI at /admin.html. Changing this file will NOT overwrite
 * an already-seeded database; use the admin UI or `resetSeed()` in db.ts.
 *
 * `cats` accepts one or more of: dns, comms, ai, edge, paas, db, storage
 */
export type SeedTool = {
  name: string;
  cats: string[];
  tier: string;
  icon: string;
  url: string;
  desc: string;
  code?: { label: string; value: string };
};

export const SEED_TOOLS: SeedTool[] = [
  /* ---------------- DNS & Domain ---------------- */
  {
    name: "Cloudflare",
    cats: ["dns"],
    tier: "Forever Free",
    icon: "cloud",
    url: "https://www.cloudflare.com/",
    desc:
      "Free DNS, SSL, CDN and email routing for unlimited domains — the default starting point for almost every side project.",
  },
  {
    name: "DNSHE",
    cats: ["dns"],
    tier: "Forever Free",
    icon: "network",
    url: "https://dnshe.com/",
    desc:
      "Free subdomains and dynamic DNS, handy for homelabs, dev environments and hardware that needs a stable hostname. Use the invite code for one extra domain registration slot.",
    code: { label: "Invite code", value: "ESB9EDBVDE" },
  },

  /* ---------------- Communication & Email ---------------- */
  {
    name: "Infomaniak",
    cats: ["comms"],
    tier: "Free Tier",
    icon: "mail",
    url: "https://www.infomaniak.com/en/hosting/free-email-address",
    desc:
      "Free tier with one custom-domain mailbox, plus webmail and IMAP/SMTP access with solid Swiss privacy credentials.",
  },
  {
    name: "Cloudflare Email Routing",
    cats: ["comms"],
    tier: "Forever Free",
    icon: "forward",
    url: "https://developers.cloudflare.com/email-routing/",
    desc:
      "Unlimited email forwarding on your own domain — create catch-all and per-address rules, forward anywhere.",
  },
  {
    name: "Zoho Mail",
    cats: ["comms"],
    tier: "Forever Free",
    icon: "inbox",
    url: "https://www.zoho.com/mail/",
    desc:
      "Forever Free plan: custom-domain mailboxes with webmail, IMAP/POP and mobile apps. No ads, no mailbox expiry.",
  },
  {
    name: "Resend",
    cats: ["comms"],
    tier: "Free Tier",
    icon: "send",
    url: "https://resend.com/",
    desc:
      "Transactional email API built for developers — clean SDKs, React Email templates and a generous monthly free allowance.",
  },
  {
    name: "Mailgun",
    cats: ["comms"],
    tier: "Free Tier",
    icon: "send-horizontal",
    url: "https://www.mailgun.com/",
    desc:
      "Developer free tier for transactional sending with REST APIs, SMTP, webhooks and detailed delivery logs.",
  },
  {
    name: "Maileroo",
    cats: ["comms"],
    tier: "Free Tier",
    icon: "mail-check",
    url: "https://maileroo.com/?r=endra",
    desc:
      "Developer-focused free email sending tier with SMTP and REST API access, templates and analytics.",
  },

  /* ---------------- AI & Coding Assistants ---------------- */
  {
    name: "Blackbox",
    cats: ["ai"],
    tier: "Free Tier",
    icon: "terminal",
    url: "https://www.blackbox.ai/",
    desc:
      "AI coding assistant available as a browser extension and IDE plugin — autocomplete, chat and code generation.",
  },
  {
    name: "Cursor",
    cats: ["ai"],
    tier: "Free Tier",
    icon: "mouse-pointer",
    url: "https://cursor.com/",
    desc:
      "AI-first code editor forked from VS Code with tab completion, inline edits and codebase-aware chat.",
  },
  {
    name: "Codeium",
    cats: ["ai"],
    tier: "Free Tier",
    icon: "sparkles",
    url: "https://codeium.com/",
    desc:
      "Free unlimited AI code completion and in-editor chat across 70+ languages and most popular IDEs.",
  },

  /* ---------------- Frontend Hosting & Edge ---------------- */
  {
    name: "Cloudflare Workers",
    cats: ["edge"],
    tier: "Free Tier",
    icon: "cpu",
    url: "https://workers.cloudflare.com/",
    desc:
      "Serverless functions running on 300+ edge locations, with KV, R2, D1 and Durable Objects bindings included.",
  },
  {
    name: "Vercel",
    cats: ["edge"],
    tier: "Free Tier",
    icon: "triangle",
    url: "https://vercel.com/",
    desc:
      "Frontend and Jamstack hosting with Git-based deploys, instant preview URLs and a global edge CDN.",
  },
  {
    name: "Netlify",
    cats: ["edge"],
    tier: "Free Tier",
    icon: "globe",
    url: "https://www.netlify.com/",
    desc:
      "Frontend hosting, serverless functions, form handling and CI straight from your repository.",
  },
  {
    name: "Zoho Catalyst",
    cats: ["edge"],
    tier: "Free Tier",
    icon: "layers",
    url: "https://catalyst.zoho.com/",
    desc:
      "Serverless frontend and backend platform — host static apps and run functions, with auth and a data store included.",
  },
  {
    name: "Wasmer.io",
    cats: ["edge", "paas"],
    tier: "Free Tier",
    icon: "package",
    url: "https://wasmer.io/",
    desc:
      "WebAssembly hosting and edge deployment — run Wasm packages close to users, or as a backend runtime.",
  },

  /* ---------------- Backend Service & PaaS ---------------- */
  {
    name: "Render",
    cats: ["paas"],
    tier: "Free Tier",
    icon: "server",
    url: "https://render.com/",
    desc:
      "Deploy web services, static sites, cron jobs and background workers from Git with no config files required.",
  },
  {
    name: "Railway",
    cats: ["paas"],
    tier: "Free Tier",
    icon: "git-branch",
    url: "https://railway.com?referralCode=oHqhM6",
    desc:
      "PaaS that turns any repo into a running service in seconds, with a developer free tier to get you started.",
  },
  {
    name: "Fly.io",
    cats: ["paas"],
    tier: "Free Tier",
    icon: "plane",
    url: "https://fly.io/",
    desc:
      "Run full-stack apps and Docker containers in regions close to your users, with a free allowance for small VMs.",
  },
  {
    name: "Faable",
    cats: ["paas"],
    tier: "Free Tier",
    icon: "cloud-cog",
    url: "https://faable.com/",
    desc:
      "Cloud hosting free tier aimed at Node and JavaScript apps — push your code and get a URL with zero config.",
  },

  /* ---------------- Databases & Caching ---------------- */
  {
    name: "Supabase",
    cats: ["db"],
    tier: "Free Tier",
    icon: "database",
    url: "https://supabase.com/",
    desc:
      "Free PostgreSQL database with auth, row-level security, file storage, realtime subscriptions and an instant API.",
  },
  {
    name: "Neon",
    cats: ["db"],
    tier: "Free Tier",
    icon: "zap",
    url: "https://neon.tech/",
    desc:
      "Serverless Postgres with instant branching, scale-to-zero compute and a database-per-preview workflow.",
  },
  {
    name: "Aiven",
    cats: ["db"],
    tier: "Free Tier",
    icon: "hard-drive",
    url: "https://aiven.io/",
    desc:
      "Managed open-source databases with free plans — PostgreSQL, MySQL, Kafka, Redis and more on real cloud infra.",
  },
  {
    name: "Upstash",
    cats: ["db"],
    tier: "Free Tier",
    icon: "gauge",
    url: "https://upstash.com/",
    desc:
      "Serverless Redis and Kafka with per-request pricing — perfect for rate limiting, caching and queues at the edge.",
  },
  {
    name: "Redis.io",
    cats: ["db"],
    tier: "Free Tier",
    icon: "boxes",
    url: "https://redis.io/",
    desc:
      "Managed Redis Cloud free tier with persistence and monitoring — the classic cache and data-structure store.",
  },
  {
    name: "CloudAMQP",
    cats: ["db"],
    tier: "Free Tier",
    icon: "rabbit",
    url: "https://www.cloudamqp.com/",
    desc:
      "Managed RabbitMQ with a free plan — message queues, workers and pub/sub without running a broker yourself.",
  },

  /* ---------------- Storage ---------------- */
  {
    name: "Val Town",
    cats: ["paas"],
    tier: "Forever Free",
    icon: "code-2",
    url: "https://www.val.town/",
    desc:
      "Run small TypeScript and JavaScript programs as public vals, HTTP endpoints, cron jobs and more on a $0 free plan.",
  },
  {
    name: "Backblaze B2",
    cats: ["storage"],
    tier: "Free Tier",
    icon: "hard-drive",
    url: "https://www.backblaze.com/cloud-storage",
    desc:
      "S3-compatible object storage with the first 10 GB free, free uploads and free egress up to 3× your average monthly storage.",
  },
  {
    name: "Cloudinary",
    cats: ["storage"],
    tier: "Free Tier",
    icon: "image",
    url: "https://cloudinary.com/",
    desc:
      "Image and video management with upload APIs, transformations and CDN delivery on a free plan with 25 monthly credits.",
  },
  {
    name: "IDrive e2",
    cats: ["storage"],
    tier: "Free Tier",
    icon: "hard-drive-download",
    url: "https://www.idrive.com/s3-storage-e2/",
    desc:
      "S3-compatible object storage with a 10 GB free trial allowance, free API calls and egress up to 3× your active storage volume.",
  },
];