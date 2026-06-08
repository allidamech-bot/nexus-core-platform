import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export function AiProviderSettings() {
  const { session } = useAuth();
  const [providerType, setProviderType] = useState("openai");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadKey() {
      if (!session) return;
      try {
        const { data, error } = await (supabase as any)
          .from("ai_provider_keys")
          .select("api_key, base_url, provider_type")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (data) {
          setProviderType(data.provider_type);
          setApiKey(data.api_key);
          setBaseUrl(data.base_url || "");
        }
      } catch (err) {
        console.error("Failed to load AI provider key", err);
      } finally {
        setLoading(false);
      }
    }
    loadKey();
  }, [session]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    setSaving(true);
    try {
      const { error } = await (supabase as any).from("ai_provider_keys").upsert(
        {
          user_id: session.user.id,
          provider_type: providerType,
          api_key: apiKey,
          base_url: baseUrl || null,
        },
        { onConflict: "user_id" },
      );

      if (error) throw error;
      toast.success("AI Provider settings saved successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
      </div>
    );

  return (
    <form onSubmit={handleSave} className="space-y-3 mt-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-widest">
          Provider Type
        </label>
        <select
          value={providerType}
          onChange={(e) => setProviderType(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="openai">OpenAI Compatible</option>
          <option value="anthropic">Anthropic</option>
          <option value="ollama">Ollama (Local)</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-widest">
          API Key
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-foreground uppercase tracking-widest">
          Base URL (Optional)
        </label>
        <input
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="https://api.openai.com/v1"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        className="flex min-h-[40px] items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-bold text-accent-foreground disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
        Save Provider
      </button>
    </form>
  );
}
