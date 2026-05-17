import { createFileRoute } from "@tanstack/react-router";
import { Terminal, Sparkles, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  return (
    <div className="flex-1 grid place-items-center p-8">
      <div className="max-w-xl text-center">
        <div className="size-12 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center mx-auto mb-6">
          <Terminal className="size-5 text-accent" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          Ready for instructions.
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Start a new session from the sidebar. Nexus Core will plan, execute, and
          verify the work — surfacing every step in real time.
        </p>
        <div className="grid grid-cols-3 gap-3 text-left">
          {[
            { i: Sparkles, t: "Structured planning", b: "Understanding · Plan · Risks · Files" },
            { i: Terminal, t: "Live execution", b: "Streaming logs with approval gates" },
            { i: ShieldCheck, t: "Verified output", b: "Typecheck · Lint · Build · Tests" },
          ].map((c) => (
            <div key={c.t} className="p-4 rounded-lg border border-border bg-surface">
              <c.i className="size-4 text-accent mb-2" />
              <div className="text-xs font-semibold">{c.t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.b}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
