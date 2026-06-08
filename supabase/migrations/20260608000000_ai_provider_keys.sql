CREATE TABLE public.ai_provider_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider_type TEXT NOT NULL, -- 'openai', 'anthropic', 'ollama'
    api_key TEXT NOT NULL,
    base_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own AI keys" 
ON public.ai_provider_keys 
FOR ALL USING (auth.uid() = user_id);
