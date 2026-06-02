import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Globe2, KeyRound, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { useAuth } from "@/lib/auth";
import { useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import { UsageMeters } from "@/features/governance/UsageMeters";
import { ThemeSelector } from "@/features/theme/ThemeSelector";

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { session, user } = useAuth();
  const { t } = useLocale();
  const { data: usage } = useUsageOverviewQuery(session?.user.id ?? null);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-8 sm:py-10">
        <div className="mb-10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-accent">
            {t("settings")}
          </div>
          <h1 className="text-3xl font-bold tracking-tight leading-snug">{t("settingsTitle")}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("settingsSubtitle")}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <SettingsCard icon={UserRound} title={t("profile")}>
              <div className="text-sm text-foreground" dir="ltr">
                {user?.email ?? t("signedInUser")}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {t("profileBody")}
              </p>
            </SettingsCard>

            <SettingsCard icon={UsersRound} title={t("organization")}>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("organizationBody")}
              </p>
            </SettingsCard>

            <SettingsCard icon={Globe2} title={t("language")}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs leading-relaxed text-muted-foreground">{t("languageBody")}</p>
                <LanguageSwitcher />
              </div>
            </SettingsCard>

            <SettingsCard icon={Globe2} title={t("theme")}>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">{t("themeBody")}</p>
              <ThemeSelector />
            </SettingsCard>

            <SettingsCard icon={KeyRound} title={t("apiAccess")}>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("apiAccessBody")}</p>
            </SettingsCard>

            <SettingsCard icon={ShieldCheck} title={t("dangerZone")}>
              <p className="text-xs leading-relaxed text-muted-foreground">{t("dangerZoneBody")}</p>
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
        <Icon className="size-4 text-accent shrink-0" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
