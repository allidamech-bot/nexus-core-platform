import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CreditCard,
  FolderKanban,
  Globe2,
  KeyRound,
  Palette,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { TeamsHub } from "@/features/teams/TeamsHub";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { useAuth } from "@/lib/auth";
import { useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import { UsageMeters } from "@/features/governance/UsageMeters";
import { ThemeSelector } from "@/features/theme/ThemeSelector";
import { useIsAdminQuery } from "@/features/admin/adminQueries";
import { useProjectWorkspace } from "@/features/projects/projectWorkspaceContext";
import { AiProviderSettings } from "@/features/settings/AiProviderSettings";
import { useBillingPlansQuery, useCheckoutSessionMutation } from "@/features/billing/billingQueries";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { session, user } = useAuth();
  const { t } = useLocale();
  const { data: usage } = useUsageOverviewQuery(session?.user.id ?? null);
  const userId = session?.user.id ?? "";
  const { data: isAdmin = false } = useIsAdminQuery(Boolean(session), userId);
  const { activeProject } = useProjectWorkspace();
  const { data: plans = [], isLoading: plansLoading } = useBillingPlansQuery();
  const checkoutMutation = useCheckoutSessionMutation();

  const handleCheckout = async (planId: string) => {
    try {
      const url = await checkoutMutation.mutateAsync(planId);
      window.location.href = url;
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-none px-3 py-6 sm:max-w-5xl sm:px-8 sm:py-10">
        <div className="mb-6 rounded-3xl border border-border bg-surface px-4 py-5 sm:mb-8 sm:px-6 sm:py-7">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-accent">
            {t("settings")}
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {t("settings")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("settingsHeroSubtitle")}
          </p>
        </div>

        <section className="mb-6 sm:mb-8">
          <div className="mb-3 font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("quickControls")}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <QuickControlCard icon={Palette} title={t("theme")}>
              <ThemeSelector />
            </QuickControlCard>

            <QuickControlCard icon={Globe2} title={t("language")}>
              <LanguageSwitcher />
            </QuickControlCard>

            {isAdmin && (
              <QuickControlCard icon={Boxes} title={t("adminControl")}>
                <Link
                  to="/app/admin"
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  {t("adminControl")}
                </Link>
              </QuickControlCard>
            )}

            {activeProject && (
              <QuickControlCard icon={FolderKanban} title={t("projectTools")}>
                <Link
                  to="/app"
                  className="flex min-h-[44px] w-full min-w-0 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition-colors hover:bg-surface-elevated"
                >
                  <span className="min-w-0 truncate">{activeProject.name}</span>
                </Link>
              </QuickControlCard>
            )}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {t("account")}
            </div>
            <SettingsCard icon={UserRound} title={t("profile")}>
              <div className="text-sm text-foreground" dir="ltr">
                {user?.email ?? t("signedInUser")}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("profileBody")}
              </p>
            </SettingsCard>

            <SettingsCard icon={UsersRound} title={t("organization")}>
              <div className="pt-2">
                <TeamsHub />
              </div>
            </SettingsCard>

            <SettingsCard icon={KeyRound} title={t("apiAccess")}>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("apiAccessBody")}</p>
              <AiProviderSettings />
            </SettingsCard>

            <div className="pt-2 font-mono text-[11px] font-semibold uppercase tracking-widest text-destructive">
              {t("dangerZone")}
            </div>
            <SettingsCard icon={ShieldCheck} title={t("dangerZone")} tone="danger">
              <p className="text-xs leading-relaxed text-destructive/80">{t("dangerZoneBody")}</p>
            </SettingsCard>
          </div>

          <div className="space-y-4">
            <SettingsCard icon={CreditCard} title={t("currentPlan")}>
              <div className="font-mono text-2xl font-semibold uppercase text-foreground" dir="ltr">
                {usage?.planId ?? "starter"}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("currentPlanBody")}
              </p>
            </SettingsCard>
            {usage && <UsageMeters overview={usage} onUpgrade={() => {
              const upgradePlan = plans.find(p => p.id !== usage.planId && p.id !== "starter");
              if (upgradePlan) handleCheckout(upgradePlan.id);
            }} />}
            
            <SettingsCard icon={CreditCard} title={t("availablePlans")}>
              {plansLoading ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {plans.map((plan) => (
                    <div key={plan.id} className="flex items-center justify-between rounded-lg border border-border bg-background/50 p-3">
                      <div>
                        <div className="font-semibold text-sm">{plan.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {plan.monthly_price_cents ? `$${(plan.monthly_price_cents / 100).toFixed(2)}/mo` : t("contactSales")}
                        </div>
                      </div>
                      <button
                        onClick={() => handleCheckout(plan.id)}
                        disabled={usage?.planId === plan.id || checkoutMutation.isPending || !plan.stripe_price_id}
                        className="rounded-md border border-accent bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                      >
                        {usage?.planId === plan.id ? t("activePlan") : t("upgrade")}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SettingsCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickControlCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-accent" />
        <h2 className="min-w-0 truncate text-sm font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SettingsCard({
  icon: Icon,
  title,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={`min-w-0 rounded-2xl border p-4 sm:p-5 ${
        tone === "danger" ? "border-destructive/30 bg-destructive/10" : "border-border bg-surface"
      }`}
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon
          className={`size-4 shrink-0 ${tone === "danger" ? "text-destructive" : "text-accent"}`}
        />
        <h2 className="min-w-0 text-base font-semibold sm:text-sm">{title}</h2>
      </div>
      {children}
    </section>
  );
}
