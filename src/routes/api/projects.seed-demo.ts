import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  getRequestCorrelationId,
  safeErrorLog,
  withLogContext,
  type CorrelationContext,
} from "@/lib/safeLogging";
import * as crypto from "crypto";

function jsonResponse(
  payload: Record<string, unknown>,
  status: number,
  context?: CorrelationContext,
) {
  return Response.json(context ? { ...payload, correlationId: context.correlationId } : payload, {
    status,
    headers: context ? { "x-correlation-id": context.correlationId } : undefined,
  });
}

function getSupabaseEnv() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase environment variable(s)");
  }
  return { url, key };
}

async function createAuthenticatedClient(request: Request, context: CorrelationContext) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: new Response("Unauthorized", { status: 401 }) };
  }

  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return { response: new Response("Unauthorized", { status: 401 }) };

  let env: ReturnType<typeof getSupabaseEnv>;
  try {
    env = getSupabaseEnv();
  } catch (error) {
    console.error("[seed-demo] missing env", withLogContext(context, safeErrorLog(error)));
    return { response: jsonResponse({ error: "env_missing" }, 503, context) };
  }

  const supabase = createClient<Database>(env.url, env.key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  const userId = data?.claims?.sub;
  if (error || !userId) {
    return { response: new Response("Unauthorized", { status: 401 }) };
  }

  return { supabase, userId };
}

const mockFiles = [
  {
    path: "package.json",
    content: `{
  "name": "nexus-demo-app",
  "version": "1.0.0",
  "description": "A demo React application",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  }
}`,
  },
  {
    path: "src/App.tsx",
    content: `import React from 'react';

export default function App() {
  return (
    <div className="App">
      <h1>Hello Nexus Demo</h1>
      <p>This is a seeded workspace to explore AI-driven code edits.</p>
    </div>
  );
}
`,
  },
  {
    path: "src/index.tsx",
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`,
  },
];

export const Route = createFileRoute("/api/projects/seed-demo")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const correlationId = getRequestCorrelationId(request);
        const context = { correlationId };
        const auth = await createAuthenticatedClient(request, context);
        if (auth.response) return auth.response;

        try {
          const { supabase, userId } = auth;
          const { data: project, error: projectError } = await supabase
            .from("projects")
            .insert({
              user_id: userId,
              name: "Demo Workspace",
              source_type: "demo",
              status: "indexed_manifest",
            })
            .select()
            .single();

          if (projectError) throw projectError;

          const projectId = project.id;

          const filesToInsert = mockFiles.map((f) => {
            const fileName = f.path.split("/").pop() || "unknown";
            return {
              project_id: projectId,
              user_id: userId,
              path: f.path,
              name: fileName,
              size_bytes: Buffer.from(f.content).length,
              is_text: true,
              mime_type: f.path.endsWith(".json") ? "application/json" : "text/plain",
              content_sha256: crypto.createHash("sha256").update(f.content).digest("hex"),
            };
          });

          const { data: insertedFiles, error: filesError } = await supabase
            .from("project_files")
            .insert(filesToInsert)
            .select();

          if (filesError) throw filesError;

          const previewsToInsert = insertedFiles.map((dbFile) => {
            const mock = mockFiles.find((m) => m.path === dbFile.path)!;
            return {
              project_id: projectId,
              user_id: userId,
              file_id: dbFile.id,
              preview_text: mock.content,
              summary: "Seeded file",
              truncated: false,
            };
          });

          const { error: previewsError } = await supabase
            .from("project_text_previews")
            .insert(previewsToInsert);

          if (previewsError) throw previewsError;

          return jsonResponse({ projectId }, 200, context);
        } catch (error) {
          console.error("[seed-demo] failed", withLogContext(context, safeErrorLog(error)));
          return jsonResponse({ error: "seed_failed" }, 500, context);
        }
      },
    },
  },
});
