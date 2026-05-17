import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import "@/lib/console-noise-filter";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] text-accent uppercase tracking-widest">Error 404</div>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Route not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          The page you're looking for does not exist in this Nexus Core instance.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-zinc-200"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="max-w-md text-center">
        <div className="font-mono text-[11px] text-destructive uppercase tracking-widest">
          Runtime exception
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">
          Something failed verification
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Retry
          </button>
          <Link
            to="/"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-white/5"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Nexus Core - Verified execution for AI operations" },
      {
        name: "description",
        content:
          "Nexus Core is an AI operating system for developers and businesses. Analyze, plan, execute, and verify work from one intelligent workspace.",
      },
      { property: "og:title", content: "Nexus Core - Verified execution for AI operations" },
      {
        property: "og:description",
        content: "Turn instructions into verified execution. The first OS for the agentic era.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Nexus Core - Verified execution for AI operations" },
      { name: "description", content: "Nexus Core is an AI operating system for businesses and developers that turns instructions into verified execution." },
      { property: "og:description", content: "Nexus Core is an AI operating system for businesses and developers that turns instructions into verified execution." },
      { name: "twitter:description", content: "Nexus Core is an AI operating system for businesses and developers that turns instructions into verified execution." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8afffc5d-d66e-4982-9796-29d3b684989b/id-preview-62f22a1b--666c51fe-b963-4e9e-92ff-f3d21ff1f775.lovable.app-1779035239050.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8afffc5d-d66e-4982-9796-29d3b684989b/id-preview-62f22a1b--666c51fe-b963-4e9e-92ff-f3d21ff1f775.lovable.app-1779035239050.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Outlet />
        <Toaster theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
