import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Loader2 } from "lucide-react";
import type { AgentSessionResult } from "@/lib/agent-types";

interface AgentResultBlockProps {
  result: AgentSessionResult | null;
  isLoading: boolean;
  projectName?: string | null;
  hasIndexedFiles: boolean;
  mode: string;
}

function detectLanguage(text: string): "arabic" | "english" | "mixed" {
  const arabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
  const arabicMatches = text.match(arabicRegex);
  if (arabicMatches && arabicMatches.length > text.length * 0.3) return "arabic";
  if (arabicMatches && arabicMatches.length > 0) return "mixed";
  return "english";
}

function generateNaturalResponse(
  intent: "greeting" | "general_chat" | "project_review",
  input: string,
  projectName: string | null | undefined,
  hasIndexedFiles: boolean,
  mode: string,
): string {
  const detectedLang = detectLanguage(input);
  const isArabic = detectedLang === "arabic" || detectedLang === "mixed";

  if (intent === "greeting") {
    if (isArabic) {
      const projectInfo = projectName ? `على مشروع ${projectName}. ` : "";
      const filesInfo = hasIndexedFiles ? "أقدر أراجع الملفات المفهرسة. " : "";
      return `أهلاً، أنا جاهز ${projectInfo}${filesInfo}ماذا تريد أن أفحص أولاً؟`;
    }
    const projectInfo = projectName ? `on the ${projectName} project. ` : "";
    const filesInfo = hasIndexedFiles ? "I can work with your indexed files. " : "";
    return `Hello! I'm ready ${projectInfo}${filesInfo}What would you like me to examine first?`;
  }

  if (intent === "general_chat") {
    if (isArabic) {
      return `أفهم طلبك. ${projectName ? `أنا هنا أساعدك في مشروع ${projectName}.` : "كيف يمكنني مساعدتك اليوم؟"}`;
    }
    return projectName
      ? `I understand. I'm here to help with the ${projectName} project.`
      : "I'm ready to help. How can I assist you today?";
  }

  if (intent === "project_review") {
    if (isArabic) {
      return projectName
        ? `**فهم المهمة**: طلبك يتعلق بتحليل أو مراجعة مشروع ${projectName}.
**السياق المتاح**: ${hasIndexedFiles ? "تم تحميل ملفات مفهرسة." : "لم يتم فهرسة ملفات بعد."}
**النتيجة**: تم تحضير ملخص التحليل والتقييمات في لوحة الآثار.
**الخطوة التالية**: راجع الخطة والتقارير على الجانب الأيمن للاطلاع على التفاصيل.
**تنويه**: هذه المراجعة للقراءة فقط — لم يتم تطبيق أي تغييرات على ملفات المشروع.`
        : `**فهم المهمة**: طلب تحليل أو مراجعة.
**السياق المتاح**: لا توجد مشروع مرتبط بهذه الجلسة.
**ملاحظة**: قم بإرفاق مشروع للحصول على تحليل مبني على محتوى فعلي.`;
    }

    return projectName
      ? `**Understanding**: Your request involves analysis or review of the ${projectName} project.
**Available context**: ${hasIndexedFiles ? "Indexed files are available." : "No indexed files attached yet."}
**Result**: Analysis summary and review artifacts are prepared in the right panel.
**Next step**: Review the plan and reports on the right for full details.
**Note**: This is a read-only review — no changes have been applied to project files.`
      : `**Understanding**: Your request involves project review.
**Available context**: No project attached to this session.
**Note**: Attach a project for grounded analysis with actual file content.`;
  }

  return "Ready to help.";
}

export function AgentResultBlock({
  result,
  isLoading,
  projectName,
  hasIndexedFiles,
  mode,
}: AgentResultBlockProps) {
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-accent">
        <Loader2 className="size-3 animate-spin" />
        Preparing response...
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const naturalText =
    result.naturalResponse ??
    generateNaturalResponse("project_review", "", projectName, hasIndexedFiles, mode);

  const hasArtifacts =
    result.plan || result.patchProposals || result.validationPlan || result.finalReport;

  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground leading-relaxed">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => <p className="mb-2 leading-relaxed" {...props} />,
            ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />,
            ol: ({ node, ...props }) => (
              <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
            ),
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code
                  className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-accent"
                  {...props}
                />
              ) : (
                <pre className="mb-2 overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-[11px]">
                  <code {...props} />
                </pre>
              ),
            a: ({ node, ...props }) => (
              <a className="text-accent underline underline-offset-2" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
          }}
        >
          {naturalText}
        </ReactMarkdown>
      </div>

      {hasArtifacts && (
        <div className="text-[10px] text-muted-foreground">
          Review artifacts prepared in the right panel.
        </div>
      )}

      {!hasArtifacts && <div className="text-[10px] text-muted-foreground">No review artifacts generated.</div>}
    </div>
  );
}