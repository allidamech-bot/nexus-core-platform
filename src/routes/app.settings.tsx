import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Globe2, KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { useAuth } from "@/lib/auth";
import { useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import { UsageMeters } from "@/features/governance/UsageMeters";

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { session, user } = useAuth();
  const { t } = useLocale();
  const { data: usage } = useUsageOverviewQuery(session?.user.id ?? null);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-8 py-8">
        <div className="mb-8">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-accent">
            {t("settings")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Workspace settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Manage account preferences, language, plan visibility, usage posture, and future
            enterprise controls.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <SettingsCard icon={UserRound} title={t("profile")}>
              <div className="text-sm text-zinc-200">{user?.email ?? "Signed-in user"}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Profile editing, notification preferences, and identity metadata are reserved for
                the organization phase.
              </p>
            </SettingsCard>

            <SettingsCard icon={UsersRound} title={t("organization")}>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Organization membership, roles, workspace permissions, and domain controls are
                planned but not active yet.
              </p>
            </SettingsCard>

            <SettingsCard icon={Globe2} title={t("language")}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Language preference is saved locally and updates layout direction for Arabic.
                </p>
                <LanguageSwitcher />
              </div>
            </SettingsCard>

            <SettingsCard icon={KeyRound} title="API and access">
              <p className="text-xs leading-relaxed text-muted-foreground">
                API keys, SCIM, SSO, and service accounts are intentionally disabled until the
                enterprise security layer is ready.
              </p>
            </SettingsCard>

            <SettingsCard icon={ShieldCheck} title={t("dangerZone")}>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Workspace deletion and export controls will require admin approval and audit
                logging. No destructive settings are available in this phase.
              </p>
            </SettingsCard>
          </div>

          <div className="space-y-4">
            <SettingsCard icon={CreditCard} title={t("currentPlan")}>
              <div className="font-mono text-2xl font-semibold uppercase text-zinc-100">
                {usage?.planId ?? "starter"}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Billing is not connected. Limits are enforced through the governance foundation.
              </p>
            </SettingsCard>
            {usage && <UsageMeters overview={usage} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
