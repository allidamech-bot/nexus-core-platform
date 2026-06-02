import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  CreditCard,
  Globe2,
  KeyRound,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { LanguageSwitcher } from "@/features/i18n/LanguageSwitcher";
import { useLocale } from "@/features/i18n/localeContext";
import { useAuth } from "@/lib/auth";
import { useUsageOverviewQuery } from "@/features/governance/governanceQueries";
import { UsageMeters } from "@/features/governance/UsageMeters";
import { ThemeSelector } from "@/features/theme/ThemeSelector";
import { useIsAdminQuery } from "@/features/admin/adminQueries";

export const Route = createFileRoute("/app/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  const { session, user } = useAuth();
  const { t } = useLocale();
  const { data: usage } = useUsageOverviewQuery(session?.user.id ?? null);
  const userId = session?.user.id ?? "";
  const { data: isAdmin = false } = useIsAdminQuery(Boolean(session), userId);

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-none px-3 py-6 sm:max-w-5xl sm:px-8 sm:py-10">
        <div className="mb-8 sm:mb-10">
          <div className="mb-3 font-mono text-[11px] uppercase tracking-widest text-accent">
            {t("settings")}
          </div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {t("settings")}
          </h1>
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
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

            {isAdmin && (
              <SettingsCard icon={Boxes} title={t("adminControl")}>
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  {t("workspaceOwner")}
                </p>
                <Link
                  to="/app/admin"
                  className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground transition-colors hover:bg-accent/90"
                >
                  {t("adminControl")}
                </Link>
              </SettingsCard>
            )}

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
    <section className="min-w-0 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="size-4 text-accent shrink-0" />
        <h2 className="min-w-0 text-base font-semibold sm:text-sm">{title}</h2>
      </div>
      {children}
    </section>
  );
}
