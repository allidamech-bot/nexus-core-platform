import { FileArchive, FolderOpen, FolderSync } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ProjectUploadDialog } from "@/features/projects/ProjectUploadDialog";

export function ProjectActionCard() {
  const { session } = useAuth();

  if (!session) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-3xl mx-auto mt-8">
      <ProjectUploadDialog
        userId={session.user.id}
        defaultMode="zip"
        trigger={
          <button className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group">
            <div className="grid place-items-center size-8 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
              <FileArchive className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-foreground">رفع مشروع ZIP</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Upload Archive
              </span>
            </div>
          </button>
        }
      />

      <ProjectUploadDialog
        userId={session.user.id}
        defaultMode="folder"
        trigger={
          <button className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group">
            <div className="grid place-items-center size-8 rounded-lg bg-accent/10 text-accent group-hover:bg-accent/20 transition-colors">
              <FolderOpen className="size-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-foreground">استيراد مجلد</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
                Import Folder
              </span>
            </div>
          </button>
        }
      />

      <button
        onClick={() => {
          // Focus or open sidebar, or just rely on the sidebar
          const sidebar = document.querySelector('[data-project-sidebar="true"]');
          if (sidebar) {
            sidebar.scrollIntoView({ behavior: "smooth" });
          } else {
            // Alternatively if we implement a picker drawer later
          }
        }}
        className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface/50 hover:bg-surface text-sm font-medium transition-colors text-left group"
      >
        <div className="grid place-items-center size-8 rounded-lg bg-foreground/10 text-foreground group-hover:bg-foreground/20 transition-colors">
          <FolderSync className="size-4" />
        </div>
        <div className="flex flex-col">
          <span className="text-foreground">اختيار مشروع موجود</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Choose Existing
          </span>
        </div>
      </button>
    </div>
  );
}
