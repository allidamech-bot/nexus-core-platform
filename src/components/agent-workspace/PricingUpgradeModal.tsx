import { Loader2, X, Check, Sparkles } from "lucide-react";
import { useBillingPlansQuery, useCheckoutSessionMutation } from "@/features/billing/billingQueries";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";

interface PricingUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingUpgradeModal({ isOpen, onClose }: PricingUpgradeModalProps) {
  const { session } = useAuth();
  const { data: plans = [], isLoading: plansLoading } = useBillingPlansQuery();
  const checkoutMutation = useCheckoutSessionMutation();

  const handleUpgrade = async (planId: string) => {
    if (!session?.user.id) return;
    try {
      const url = await checkoutMutation.mutateAsync(planId);
      window.location.href = url;
    } catch {
      toast.error("Failed to initiate checkout");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogOverlay className="bg-black/80 backdrop-blur-sm z-50" />
      <DialogContent className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-yellow-500/30 bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] p-0 shadow-2xl shadow-yellow-500/10 overflow-hidden outline-none">
        <div className="relative p-6 sm:p-10">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
          
          <div className="mx-auto max-w-2xl text-center mb-10 mt-4">
            <div className="inline-flex items-center justify-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-4 py-1.5 text-sm font-bold uppercase tracking-widest text-yellow-500 mb-6">
              <Sparkles className="size-4" /> Limit Reached
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl mb-4">
              Unlock the Full Power of Nexus Core
            </h2>
            <p className="text-base text-gray-400 sm:text-lg">
              Upgrade your workspace to access unlimited sandboxes, advanced AI capabilities, and strict governance tools.
            </p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-8 animate-spin text-yellow-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8 max-w-4xl mx-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 shadow-xl transition-all hover:border-yellow-500/50 hover:bg-white/10"
                >
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                    <div className="mb-6 flex items-baseline gap-2">
                      <span className="text-4xl font-extrabold text-white">
                        ${plan.monthly_price_cents ? plan.monthly_price_cents / 100 : 0}
                      </span>
                      <span className="text-sm font-medium text-gray-400">/month</span>
                    </div>
                    
                    <ul className="space-y-4 mb-8">
                      {["Unlimited Sandbox Executions", "Advanced Patch Generation", "Priority GPU Access", "Quorum Approval Engine"].map((feature, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                          <Check className="size-5 shrink-0 text-yellow-500" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={checkoutMutation.isPending}
                    className="w-full rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-600 px-4 py-3.5 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {checkoutMutation.isPending ? <Loader2 className="mx-auto size-5 animate-spin" /> : "Upgrade Now"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
