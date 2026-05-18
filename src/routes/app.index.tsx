import { createFileRoute } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";
import { Terminal, Sparkles, ShieldCheck, Boxes, CircleDashed, LockKeyhole } from "lucide-react";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { ProjectStatusBadge } from "@/features/projects/ProjectStatusBadge";
import { getProjectManifest } from "@/features/projects/projectManifest";
import { ProjectManifestCard } from "@/features/projects/ProjectManifestCard";
import { ProjectTextPreviewPanel } from "@/features/projects/ProjectTextPreviewPanel";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocale } from "@/features/i18n/localeContext";

export const Route = createFileRoute("/app/")({
  component: AppIndex,
});

function AppIndex() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { projects, activeProject, activeProjectPreviews, activeProjectPreviewsLoading } =
    useProjectWorkspace();
  const manifest = getProjectManifest(activeProject);
  const { t } = useLocale();

  async function createSession() {
    if (!session) return;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: session.user.id, title: "New Session", mode: "engineering" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/app/$threadId", params: { threadId: data.id } });
  }

  const canDoItems = [t("canDoItem1"), t("canDoItem2"), t("canDoItem3"), t("canDoItem4")];
  const notSupportedItems = [t("notSupportedItem1"), t("notSupportedItem2"), t("notSupportedItem3")];

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-5xl">
        <div className="size-12 rounded-xl bg-accent/10 border border-accent/20 grid place-items-center mx-auto mb-6">
          <Terminal className="size-5 text-accent" />
        </div>
        <h1 className="text-center text-3xl font-bold tracking-tight mb-4 leading-snug">
          {t("welcomeTitle")}
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-relaxed text-muted-foreground">
          {t("welcomeSubtitle")}
        </p>
        <div className="mb-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {session && (
            <ProjectUploadDialog
              userId={session.user.id}
              trigger={
                <button className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-zinc-200">
                  {t("uploadOrImport")}
                </button>
              }
            />
          )}
          <button
            onClick={createSession}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-white/5"
          >
            {t("createAiSession")}
          </button>
        </div>
        {projects.length === 0 ? (
          <div className="mb-8 rounded-lg border border-border bg-surface p-5">
            <Boxes className="mb-3 size-5 text-accent" />
            <div className="text-sm font-semibold">{t("ingestionReady")}</div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {t("ingestionReadyBody")}
            </p>
          </div>
        ) : activeProject ? (
          <div className="mb-8 rounded-lg border border-accent/20 bg-accent/5 p-4 text-start">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{activeProject.name}</div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("activeProject")} ·{" "}
                  <bdi dir="ltr">{activeProject.source_type}</bdi>
                </div>
              </div>
              <ProjectStatusBadge
                status={activeProject.latest_job?.status ?? activeProject.status}
              />
            </div>
            <div className="mt-4">
              <ProjectManifestCard manifest={manifest} />
            </div>
            <div className="mt-4">
              <ProjectTextPreviewPanel
                previews={activeProjectPreviews}
                loading={activeProjectPreviewsLoading}
              />
            </div>
          </div>
        ) : null}
        <div className="grid gap-3 text-start md:grid-cols-3">
          {[
            { i: Sparkles, t: t("structuredPlanning"), b: t("structuredPlanningBody") },
            { i: ShieldCheck, t: t("safeContext"), b: t("safeContextBody") },
            { i: LockKeyhole, t: t("governedAccess"), b: t("governedAccessBody") },
          ].map((c) => (
            <div key={c.t} className="p-4 rounded-lg border border-border bg-surface">
              <c.i className="size-4 text-accent mb-2" />
              <div className="text-xs font-semibold">{c.t}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{c.b}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <InfoPanel icon={CircleDashed} title={t("canDoNow")} items={canDoItems} />
          <InfoPanel icon={Terminal} title={t("notSupportedYet")} items={notSupportedItems} />
        </div>
      </div>
    </div>
  );
}

function InfoPanel({
  icon: Icon,
  title,
  items,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-accent shrink-0" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
