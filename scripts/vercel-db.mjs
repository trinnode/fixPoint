// Prepare the demo ledger during the Vercel build.
//
// Runs before next build when DATABASE_URL is set: derives the direct (non
// pooling) endpoint from the pooled URL, creates the schema with prisma db
// push, and seeds the four demo invoices. Both steps are idempotent, so every
// deploy is safe. Without DATABASE_URL this exits immediately and the build
// stays clean with an empty environment.
//
// Neon pools behind a -pooler host that rejects DDL, and Supabase pools on
// port 6543, so both are unwrapped here. Retries cover Neon cold starts.

import { spawnSync } from "node:child_process";

const pooled = process.env.DATABASE_URL;

if (!pooled) {
  console.log("vercel-db: DATABASE_URL not set, skipping schema and seed");
  process.exit(0);
}

const direct = pooled.replace("-pooler.", ".").replace(":6543/", ":5432/");

let label = "database";
try {
  label = new URL(direct).host;
} catch {
  // keep the generic label, never print the URL itself
}
console.log(`vercel-db: preparing schema and seed at ${label}`);

const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(script) {
  const res = spawnSync(npm, ["run", script, "-w", "@fixpoint/nextjs"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: direct },
    shell: process.platform === "win32",
  });
  return res.status === 0;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ok = false;
for (let attempt = 1; attempt <= 3 && !ok; attempt += 1) {
  if (attempt > 1) {
    console.log(`vercel-db: attempt ${attempt} of 3`);
    await sleep(5000);
  }
  ok = run("db:push") && run("db:seed");
}

if (!ok) {
  console.error(
    "vercel-db: could not reach the database after 3 attempts, deploy stopped",
  );
  process.exit(1);
}

console.log("vercel-db: schema ready, demo ledger seeded");
