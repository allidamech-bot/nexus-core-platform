import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  GitBranch,
  Lock,
  ShieldCheck,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import heroPreview from "@/assets/hero-preview.jpg";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
              <span className="font-mono text-[11px] font-bold">NX</span>
            </div>
            <span className="text-sm font-bold tracking-tighter uppercase">Nexus Core</span>
          </Link>
          <div className="hidden md:flex gap-6 text-[13px] text-muted-foreground font-medium">
            <a href="#platform" className="hover:text-foreground transition-colors">
              Platform
            </a>
            <a href="#workflow" className="hover:text-foreground transition-colors">
              How it works
            </a>
            <a href="#security" className="hover:text-foreground transition-colors">
              Security
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Pricing
            </a>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link
            to="/login"
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="text-[13px] font-medium bg-foreground text-background px-4 py-1.5 rounded-full hover:bg-zinc-200 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <header className="relative">
      <div className="absolute inset-0 grid-bg opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-5xl pt-28 pb-24 px-6 text-center animate-entrance">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-white/5 text-[12px] font-medium mb-8">
          <span className="size-1.5 rounded-full bg-accent animate-pulse" />
          Project-aware AI workspace - Public Preview
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance mb-8">
          Nexus Core turns project context into{" "}
          <span className="text-accent">structured plans</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
          An AI workspace for developers and businesses. Ingest project context, analyze codebase
          structure, plan work, and prepare verification-ready workflows.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="w-full sm:w-auto px-8 py-3 bg-foreground text-background font-semibold rounded-lg hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-2"
          >
            Start Building <ArrowRight className="size-4" />
          </Link>
          <a
            href="#platform"
            className="w-full sm:w-auto px-8 py-3 bg-white/5 border border-border font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            Watch Demo
          </a>
        </div>

        <div className="mt-20 p-2 rounded-2xl border border-border bg-surface/60 relative overflow-hidden glow-accent">
          <img
            src={heroPreview}
            alt="Nexus Core agent workspace preview"
            width={1600}
            height={896}
            className="w-full rounded-xl border border-white/5"
          />
        </div>
      </div>
    </header>
  );
}

function Logos() {
  const items = ["Acme Labs", "Polymer", "Northwind", "Hyperion", "Veridian", "Lattice"];
  return (
    <section className="border-y border-border bg-surface/40 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground mb-6">
          Trusted by engineering teams operating at scale
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 opacity-60">
          {items.map((n) => (
            <div
              key={n}
              className="text-center text-sm font-semibold tracking-tight text-muted-foreground"
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-28">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
            The problem
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-6">
            Chatbots answer. Operators need grounded project plans.
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Most AI tools stop at generic suggestions. Your team is still left to inspect context,
            plan implementation, and decide what is safe to verify. Nexus Core starts with a
            governed project-understanding layer before execution is introduced.
          </p>
        </div>
        <div className="space-y-3">
          {[
            "Hallucinated code shipped without verification",
            "No audit trail for AI-driven changes",
            "Approval gates ignored or invisible",
            "Business workflows disconnected from project context",
          ].map((p) => (
            <div
              key={p}
              className="flex items-start gap-3 p-4 rounded-lg border border-border bg-surface"
            >
              <div className="size-5 mt-0.5 rounded-full border border-destructive/40 grid place-items-center text-destructive text-[11px] font-mono">
                !
              </div>
              <span className="text-sm text-zinc-300">{p}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: Terminal,
    title: "Engineering agent",
    body: "Analyze repositories, plan refactors, and propose patches with full file context.",
  },
  {
    icon: Workflow,
    title: "Business workflow agent",
    body: "Design and run customer onboarding, sales reporting, and ops processes.",
  },
  {
    icon: ShieldCheck,
    title: "Verification-ready workflow",
    body: "Plans are shaped around typecheck, lint, build, tests, and security review before execution exists.",
  },
  {
    icon: GitBranch,
    title: "Project intelligence",
    body: "Upload ZIPs or connect repos. Stack detection, risks, and changed-file diffs.",
  },
  {
    icon: Lock,
    title: "Approval gates",
    body: "Context selection and sensitive actions are audited. Approval workflows expand before execution ships.",
  },
  {
    icon: Zap,
    title: "Multi-model routing",
    body: "Route tasks across reasoning, fast, and image models for the best result.",
  },
];

function Features() {
  return (
    <section id="platform" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center mb-16">
        <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
          Platform
        </div>
        <h2 className="text-4xl font-bold tracking-tight mb-4">One workspace. Every operator.</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Nexus Core combines structured AI planning, project intelligence, and governance into a
          single workspace. The execution layer is intentionally reserved for a later sandbox phase.
        </p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-xl border border-border bg-surface hover:border-white/15 transition-colors"
          >
            <div className="size-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center mb-4">
              <f.icon className="size-4 text-accent" />
            </div>
            <h3 className="text-base font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const steps = [
  {
    n: "01",
    title: "Understand",
    body: "Restates intent, scopes the request, and pulls relevant project context.",
  },
  {
    n: "02",
    title: "Plan",
    body: "Produces a concrete, numbered plan with risks and files in scope.",
  },
  {
    n: "03",
    title: "Approve",
    body: "Pauses at approval gates for any destructive or irreversible action.",
  },
  {
    n: "04",
    title: "Prepare",
    body: "Creates a readiness log and verification checklist for later execution phases.",
  },
  {
    n: "05",
    title: "Verify",
    body: "Typecheck, lint, build, tests, security scan - every run, every time.",
  },
  {
    n: "06",
    title: "Report",
    body: "Delivers a final report with changed files, diffs, and recommended next steps.",
  },
];

function How() {
  return (
    <section id="workflow" className="border-y border-border bg-surface/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16">
          <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
            How it works
          </div>
          <h2 className="text-4xl font-bold tracking-tight">
            A deterministic loop from prompt to proof.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {steps.map((s) => (
            <div key={s.n} className="p-6 bg-surface">
              <div className="font-mono text-[11px] text-accent mb-3">[{s.n}]</div>
              <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="mx-auto max-w-6xl px-6 py-28">
      <div className="grid md:grid-cols-[1fr_auto] gap-12 items-end mb-12">
        <div>
          <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
            Security &amp; trust
          </div>
          <h2 className="text-4xl font-bold tracking-tight">Built for regulated environments.</h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Row-level access, audit logs, explicit context selection, and no code execution in the
          current phase. Your data never trains shared models.
        </p>
      </div>
      <div className="grid md:grid-cols-4 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {[
          { k: "SOC 2", v: "Type II ready" },
          { k: "Audit logs", v: "Every action" },
          { k: "RLS", v: "Per-user isolation" },
          { k: "Approvals", v: "Human-in-the-loop" },
        ].map((x) => (
          <div key={x.k} className="p-6 bg-surface">
            <div className="text-2xl font-bold tracking-tight">{x.v}</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {x.k}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Starter",
    price: "$49",
    per: "/mo",
    features: ["5 active sessions", "1 project", "Planning checklist", "Community support"],
  },
  {
    name: "Pro",
    price: "$299",
    per: "/mo",
    features: [
      "Unlimited sessions",
      "10 projects",
      "Verification-ready planning",
      "Approval workflows",
      "Priority support",
    ],
    featured: true,
  },
  {
    name: "Business",
    price: "$999",
    per: "/mo",
    features: ["Team workspaces", "Audit logs export", "Business agents", "SSO", "SLAs"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    per: "",
    features: [
      "Dedicated instance",
      "Private data posture",
      "Compliance review",
      "Custom integrations",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center mb-16">
        <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
          Pricing
        </div>
        <h2 className="text-4xl font-bold tracking-tight">Scale from prototype to production.</h2>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`p-6 rounded-xl border bg-surface flex flex-col ${
              p.featured ? "border-accent/40 ring-1 ring-accent/20" : "border-border"
            }`}
          >
            <div className="text-sm font-semibold mb-1">{p.name}</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-3xl font-bold tracking-tight">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.per}</span>
            </div>
            <ul className="space-y-2 text-sm text-zinc-300 flex-1">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="size-4 text-accent shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
            <Link
              to="/signup"
              className={`mt-6 text-center text-sm font-semibold rounded-md py-2 ${
                p.featured
                  ? "bg-accent text-accent-foreground"
                  : "border border-border hover:bg-white/5"
              }`}
            >
              {p.name === "Enterprise" ? "Contact sales" : "Start free"}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Does Nexus Core execute code today?",
    a: "No. This version is pre-execution: it ingests project context, builds safe manifests, indexes limited previews, and produces structured plans. Sandboxed execution comes later.",
  },
  {
    q: "What about my source code privacy?",
    a: "Your data is isolated per workspace with row-level security. Nothing is used to train shared models.",
  },
  {
    q: "Can it run business workflows, not just engineering?",
    a: "Today it can structure business workflow plans. Dedicated Business, Research, and Workflow agents are planned for later phases.",
  },
  {
    q: "Which AI models does it use?",
    a: "Nexus Core routes across multiple frontier models depending on task - reasoning, fast, and multimodal.",
  },
];

function FAQ() {
  return (
    <section className="border-t border-border bg-surface/40 py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center mb-12">
          <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
            FAQ
          </div>
          <h2 className="text-4xl font-bold tracking-tight">Common questions</h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group p-5 rounded-lg border border-border bg-surface">
              <summary className="cursor-pointer list-none flex justify-between items-center text-sm font-semibold">
                {f.q}
                <span className="text-muted-foreground group-open:rotate-45 transition-transform">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-32 text-center">
      <Boxes className="size-10 mx-auto text-accent mb-6" />
      <h2 className="text-5xl font-bold tracking-tight mb-6">
        Create your first project-aware AI workspace.
      </h2>
      <p className="text-muted-foreground max-w-xl mx-auto mb-8">
        Free during preview. No credit card. Spin up a workspace in under a minute.
      </p>
      <Link
        to="/signup"
        className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-foreground text-background font-semibold rounded-lg hover:bg-zinc-200"
      >
        Start Building <ArrowRight className="size-4" />
      </Link>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-12">
        <div className="col-span-2">
          <span className="text-sm font-bold tracking-tighter uppercase mb-4 block">
            Nexus Core
          </span>
          <p className="text-sm text-muted-foreground max-w-xs">
            The project-aware planning layer for modern AI operations.
          </p>
        </div>
        <div className="space-y-3">
          <h4 className="text-[12px] font-semibold uppercase tracking-wider">Product</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <a href="#platform" className="hover:text-foreground">
                Platform
              </a>
            </li>
            <li>
              <a href="#workflow" className="hover:text-foreground">
                How it works
              </a>
            </li>
            <li>
              <a href="#pricing" className="hover:text-foreground">
                Pricing
              </a>
            </li>
          </ul>
        </div>
        <div className="space-y-3">
          <h4 className="text-[12px] font-semibold uppercase tracking-wider">Company</h4>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>
              <a href="#security" className="hover:text-foreground">
                Security
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                Privacy
              </a>
            </li>
            <li>
              <a href="#" className="hover:text-foreground">
                Status
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          (c) 2026 Nexus Core Systems
        </div>
      </div>
    </footer>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <Logos />
      <Problem />
      <Features />
      <How />
      <Security />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
