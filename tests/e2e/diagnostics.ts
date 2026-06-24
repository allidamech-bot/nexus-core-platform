import { createClient } from "@supabase/supabase-js";

type AuthResult = {
  success: boolean;
  errorName?: string;
  errorMessage?: string;
  errorCode?: string;
};

function redactMessage(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[JWT_REDACTED]")
    .replace(/access_token[=:]\s*"[^"]*"/gi, 'access_token="[REDACTED]"')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[EMAIL_REDACTED]")
    .replace(/key=[A-Za-z0-9_-]+/gi, "key=[REDACTED]")
    .replace(/(password|passwd|pwd|secret)[=:]\s*[^\s&]+/gi, "$1=[REDACTED]")
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, "Bearer [REDACTED]");
}

function truncate(str: string, max = 100): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}...[truncated]`;
}

export async function preflightAuthDiagnostics(): Promise<void> {
  if (process.env.PERSISTED_GOVERNED_E2E !== "1") {
    console.log(
      "[diagnostics] Skipping preflight auth diagnostics (PERSISTED_GOVERNED_E2E not set)",
    );
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    console.log("[diagnostics] Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY");
    return;
  }

  const supabase = createClient(url, key);

  console.log("[diagnostics] Preflight Supabase auth check...");

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const nonAdminEmail = process.env.E2E_NON_ADMIN_EMAIL;
  const nonAdminPassword = process.env.E2E_NON_ADMIN_PASSWORD;

  let adminAuth: AuthResult = { success: false };
  let nonAdminAuth: AuthResult = { success: false };

  if (adminEmail && adminPassword) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });

      if (error) {
        adminAuth = {
          success: false,
          errorName: error.name,
          errorMessage: truncate(redactMessage(error.message)),
          errorCode: error.code,
        };
      } else {
        adminAuth = { success: true };
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      adminAuth = {
        success: false,
        errorName: err.name,
        errorMessage: truncate(redactMessage(err.message)),
      };
    }
  } else {
    adminAuth = { success: false, errorName: "MissingCredentials" };
  }

  if (nonAdminEmail && nonAdminPassword) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: nonAdminEmail,
        password: nonAdminPassword,
      });

      if (error) {
        nonAdminAuth = {
          success: false,
          errorName: error.name,
          errorMessage: truncate(redactMessage(error.message)),
          errorCode: error.code,
        };
      } else {
        nonAdminAuth = { success: true };
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      nonAdminAuth = {
        success: false,
        errorName: err.name,
        errorMessage: truncate(redactMessage(err.message)),
      };
    }
  } else {
    nonAdminAuth = { success: false, errorName: "MissingCredentials" };
  }

  console.log(`[diagnostics] adminAuth: ${adminAuth.success ? "success" : "fail"}`);
  if (!adminAuth.success && adminAuth.errorName) {
    console.log(
      `[diagnostics] adminAuth error: ${adminAuth.errorName}${adminAuth.errorCode ? ` (code: ${adminAuth.errorCode})` : ""}`,
    );
    if (adminAuth.errorMessage) {
      console.log(`[diagnostics] adminAuth message: ${adminAuth.errorMessage}`);
    }
  }

  console.log(`[diagnostics] nonAdminAuth: ${nonAdminAuth.success ? "success" : "fail"}`);
  if (!nonAdminAuth.success && nonAdminAuth.errorName) {
    console.log(
      `[diagnostics] nonAdminAuth error: ${nonAdminAuth.errorName}${nonAdminAuth.errorCode ? ` (code: ${nonAdminAuth.errorCode})` : ""}`,
    );
    if (nonAdminAuth.errorMessage) {
      console.log(`[diagnostics] nonAdminAuth message: ${nonAdminAuth.errorMessage}`);
    }
  }
}
