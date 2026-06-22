import { createClient } from "@supabase/supabase-js";

const toEnv = {
  supabaseUrl: "SECRET_SUPABASE_URL",
  supabasePublishableKey: "SECRET_SUPABASE_PUBLISHABLE_KEY",
  adminEmail: "SECRET_E2E_ADMIN_EMAIL",
  adminPassword: "SECRET_E2E_ADMIN_PASSWORD",
  nonAdminEmail: "SECRET_E2E_NON_ADMIN_EMAIL",
  nonAdminPassword: "SECRET_E2E_NON_ADMIN_PASSWORD",
};

const values = {};
const missing = [];
for (const [key, name] of Object.entries(toEnv)) {
  const value = process.env[name];
  if (!value) missing.push(name.replace(/^SECRET_/, ""));
  values[key] = value;
}

if (missing.length > 0) {
  console.log(`Auth preflight skipped: missing env vars: ${missing.join(", ")}`);
  process.exit(0);
}

function safe(error) {
  if (!error) return "unknown error";
  const name = error.name || "Error";
  let message = typeof error.message === "string" ? error.message : String(error);
  message = message
    .replace(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted email]")
    .replace(/\b[\w-]{20,}\b/g, "[redacted token]");
  return `${name}: ${message}`;
}

let failed = false;

async function attempt(label, email, password) {
  const client = createClient(values.supabaseUrl, values.supabasePublishableKey);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    console.log(`${label} auth preflight failed: ${safe(error)}`);
    failed = true;
  } else {
    console.log(`${label} auth preflight: ok`);
  }
}

await attempt("admin", values.adminEmail, values.adminPassword);
await attempt("non-admin", values.nonAdminEmail, values.nonAdminPassword);

if (failed) process.exit(1);
