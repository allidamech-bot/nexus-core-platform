import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  GitBranch,
  Lock,
  ShieldCheck,
  Workflow,
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
              Governance
            </a>
            <a href="#pricing" className="hover:text-foreground transition-colors">
              Access
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
          Governed AI project workspace - Public Preview
        </div>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance mb-8">
          Nexus Core moves AI changes through{" "}
          <span className="text-accent">human review gates</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty">
          Ingest safe project context, shape grounded proposals, preserve no-direct-writeback
          boundaries, and export working-copy handoffs for external human review.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="w-full sm:w-auto px-8 py-3 bg-foreground text-background font-semibold rounded-lg hover:bg-zinc-200 transition-colors inline-flex items-center justify-center gap-2"
          >
            Open Preview Access <ArrowRight className="size-4" />
          </Link>
          <a
            href="#workflow"
            className="w-full sm:w-auto px-8 py-3 bg-white/5 border border-border font-semibold rounded-lg hover:bg-white/10 transition-colors"
          >
            View Governance Flow
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
            Most AI tools collapse suggestion, execution, and approval into one risky moment. Nexus
            Core keeps each step explicit: safe context first, grounded proposal second, exportable
            working copy last, with human review before anything is applied externally.
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
    icon: Workflow,
    title: "Governed pipeline",
    body: "Move from safe previews to patch previews, review requests, working-copy export, and human apply.",
  },
  {
    icon: ShieldCheck,
    title: "Safe preview context",
    body: "Use indexed manifests and limited text previews without exposing secret files or raw source broadly.",
  },
  {
    icon: Lock,
    title: "No direct source writeback",
    body: "Nexus Core prepares review artifacts and exportable working copies; source mutation stays external.",
  },
  {
    icon: GitBranch,
    title: "Grounded proposals",
    body: "Label proposed file changes as grounded, inferred, or illustrative based on available project context.",
  },
  {
    icon: Boxes,
    title: "Exportable handoff",
    body: "Bundle derived working-copy artifacts for manual review and external application by your team.",
  },
];

function Features() {
  return (
    <section id="platform" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center mb-16">
        <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
          Platform
        </div>
        <h2 className="text-4xl font-bold tracking-tight mb-4">
          One workspace. Governed change preparation.
        </h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Nexus Core combines structured AI planning, project intelligence, and artifact review in a
          single workspace. Direct source writeback remains intentionally disabled.
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
    title: "Project Context",
    body: "Attach an indexed project and select safe preview context for the AI session.",
  },
  {
    n: "02",
    title: "Safe Preview",
    body: "Use manifest and allowlisted text snippets rather than direct source access.",
  },
  {
    n: "03",
    title: "Grounded Proposal",
    body: "Create plans, risks, patch-preview guidance, and confidence labels.",
  },
  {
    n: "04",
    title: "Review Gate",
    body: "Submit review requests before creating exportable working-copy artifacts.",
  },
  {
    n: "05",
    title: "Working Copy Export",
    body: "Export the derived handoff for human review and external apply.",
  },
];

function How() {
  return (
    <section id="workflow" className="border-y border-border bg-surface/40 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16">
          <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
            Governed pipeline
          </div>
          <h2 className="text-4xl font-bold tracking-tight">
            Project Context {"->"} Safe Preview {"->"} Grounded Proposal {"->"} Review Gate {"->"}{" "}
            Working Copy Export.
          </h2>
        </div>
        <div className="grid md:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border">
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
            Proof / Governance Posture
          </div>
          <h2 className="text-4xl font-bold tracking-tight">
            Trust claims tied to current platform behavior.
          </h2>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Nexus Core is designed around explicit review artifacts and source-control boundaries,
          without claiming formal compliance certification.
        </p>
      </div>
      <div className="grid md:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
        {[
          { k: "Writeback", v: "No direct source writeback" },
          { k: "Context", v: "Safe preview context only" },
          { k: "Isolation", v: "RLS-backed workspace isolation" },
          { k: "Events", v: "Audit and usage events" },
          { k: "Review", v: "Human approval gates" },
          { k: "Handoff", v: "Working copy export" },
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
    name: "Preview Access",
    price: "Public preview",
    per: "",
    features: [
      "Governed sessions",
      "Safe project previews",
      "Patch-preview guidance",
      "Usage limits",
    ],
  },
  {
    name: "Capability Tiers",
    price: "Limits-based",
    per: "",
    features: [
      "Higher project limits",
      "Expanded preview quotas",
      "Review workflows",
      "Working-copy exports",
    ],
    featured: true,
  },
  {
    name: "Enterprise Review",
    price: "Contact review",
    per: "",
    features: [
      "Governance assessment",
      "Security posture review",
      "Custom limits discussion",
      "Operational handoff planning",
    ],
  },
];

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center mb-16">
        <div className="font-mono text-[10px] text-accent uppercase tracking-widest mb-3">
          Access
        </div>
        <h2 className="text-4xl font-bold tracking-tight">
          Preview access without unverified billing claims.
        </h2>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`p-6 rounded-xl border bg-surface flex flex-col ${
              p.featured ? "border-accent/40 ring-1 ring-accent/20" : "border-border"
            }`}
          >
            <div className="text-sm font-semibold mb-1">{p.name}</div>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-2xl font-bold tracking-tight">{p.price}</span>
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
              {p.name === "Enterprise Review" ? "Contact for review" : "Request access"}
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
    a: "No. Nexus Core ingests project context, builds safe manifests, indexes limited previews, and produces structured plans and review artifacts. Direct source mutation stays outside the platform.",
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
    a: "Nexus Core can use configured AI providers for project-aware planning. Provider availability depends on the workspace configuration.",
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
        Create your first governed AI project workspace.
      </h2>
      <p className="text-muted-foreground max-w-xl mx-auto mb-8">
        Public preview access for safe project context, grounded proposals, review gates, and
        working-copy export handoff.
      </p>
      <Link
        to="/signup"
        className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-foreground text-background font-semibold rounded-lg hover:bg-zinc-200"
      >
        Request Preview Access <ArrowRight className="size-4" />
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
            The governed planning and review handoff layer for AI-assisted software work.
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
                Access
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
              <a href="#security" className="hover:text-foreground">
                Governance posture
              </a>
            </li>
            <li>
              <a href="#workflow" className="hover:text-foreground">
                Review flow
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
