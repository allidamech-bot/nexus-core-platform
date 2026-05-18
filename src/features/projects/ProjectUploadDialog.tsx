import { useMemo, useRef, useState, type ReactNode } from "react";
import { FileArchive, FolderOpen, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useImportFolderMutation, useUploadProjectMutation } from "./projectQueries";
import { deriveProjectName, validateProjectZip } from "./projectUploadService";
import { PROJECT_UPLOAD_MAX_MB } from "./constants";
import { useLocale } from "@/features/i18n/localeContext";
import { summarizeFolderFiles, type FolderImportSummary } from "./folderImportService";

export function ProjectUploadDialog({ userId, trigger }: { userId: string; trigger: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"zip" | "folder">("zip");
  const [file, setFile] = useState<File | null>(null);
  const [folderSummary, setFolderSummary] = useState<FolderImportSummary | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const uploadProject = useUploadProjectMutation();
  const importFolder = useImportFolderMutation();
  const { t } = useLocale();

  const validationError = useMemo(() => (file ? validateProjectZip(file) : null), [file]);
  const busy = uploadProject.isPending || importFolder.isPending;
  const canSubmit =
    mode === "zip"
      ? Boolean(file && !validationError)
      : Boolean(folderSummary && !folderSummary.error);

  function resetForm() {
    setFile(null);
    setFolderSummary(null);
    setName("");
    setDescription("");
  }

  function acceptFolderFiles(files: FileList | File[]) {
    const summary = summarizeFolderFiles(Array.from(files));
    setFolderSummary(summary);
    setFile(null);
    setName(summary.rootName);
  }

  async function onSubmit() {
    if (mode === "folder") {
      if (!folderSummary) {
        toast.error("Select a project folder first.");
        return;
      }

      try {
        await importFolder.mutateAsync({
          userId,
          summary: folderSummary,
          projectName: name,
          description,
        });
        toast.success("Folder manifest imported. Safe file inventory is ready.");
        setOpen(false);
        resetForm();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Folder import failed.");
      }
      return;
    }

    if (!file) {
      toast.error("Select a .zip archive first.");
      return;
    }

    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      const result = await uploadProject.mutateAsync({
        userId,
        file,
        projectName: name,
        description,
      });

      toast.success(
        result.storageAvailable
          ? "Project archive uploaded. Ingestion foundation is ready."
          : "Project staged. Storage bucket is not configured yet.",
      );
      setOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Project upload failed.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-background p-0 sm:max-w-xl">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-xl tracking-tight">
              {t("uploadProjectArchive")}
            </DialogTitle>
            <DialogDescription>{t("uploadDescription")}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-1">
            {(["zip", "folder"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  resetForm();
                }}
                className={`rounded-md px-3 py-2 text-xs font-semibold ${
                  mode === option
                    ? "bg-accent/15 text-accent"
                    : "text-muted-foreground hover:bg-white/5"
                }`}
              >
                {option === "zip" ? t("uploadZip") : t("folderImport")}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() =>
              mode === "zip" ? fileInputRef.current?.click() : folderInputRef.current?.click()
            }
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const files = event.dataTransfer.files;
              if (!files.length) return;
              if (mode === "folder") {
                acceptFolderFiles(files);
              } else {
                const selected = files[0] ?? null;
                setFile(selected);
                setFolderSummary(null);
                setName(selected ? deriveProjectName(selected) : "");
              }
            }}
            className={`w-full rounded-lg border border-dashed p-6 text-left transition-colors ${
              validationError || folderSummary?.error
                ? "border-destructive/50 bg-destructive/5"
                : "border-border bg-surface"
            } hover:border-accent/40`}
          >
            <div className="flex items-start gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10">
                {mode === "zip" ? (
                  <FileArchive className="size-5 text-accent" />
                ) : (
                  <FolderOpen className="size-5 text-accent" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {mode === "zip"
                    ? file
                      ? file.name
                      : t("selectZipArchive")
                    : folderSummary
                      ? folderSummary.rootName
                      : t("dragFolder")}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {mode === "zip"
                    ? t("zipOnly", { max: PROJECT_UPLOAD_MAX_MB })
                    : "Local folder import builds a safe manifest from file names and metadata. Ignored directories stay out of the inventory."}
                </div>
                {file && (
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB / {file.type || "unknown type"}
                  </div>
                )}
                {folderSummary && (
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                    <Metric label={t("acceptedFiles")} value={folderSummary.accepted.length} />
                    <Metric label={t("ignoredFiles")} value={folderSummary.ignored.length} />
                    <Metric
                      label="Size"
                      value={`${(folderSummary.totalBytes / 1024 / 1024).toFixed(2)} MB`}
                    />
                  </div>
                )}
              </div>
            </div>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setName(selected ? deriveProjectName(selected) : "");
            }}
          />

          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(event) => {
              const files = event.target.files;
              if (files) acceptFolderFiles(files);
            }}
          />

          {(validationError || folderSummary?.error) && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {validationError ?? folderSummary?.error}
            </div>
          )}

          {folderSummary && folderSummary.ignored.length > 0 && (
            <div className="rounded-md border border-border bg-background/40 p-3">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("ignoredFiles")}
              </div>
              <div className="max-h-20 space-y-1 overflow-y-auto font-mono text-[10px] text-muted-foreground">
                {folderSummary.ignored.slice(0, 8).map((item) => (
                  <div key={`${item.path}-${item.reason}`} className="truncate">
                    {item.path} / {item.reason}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("projectName")}
            </label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nexus web application"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("description")}
            </label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional project context for operators."
              disabled={busy}
              className="min-h-[84px]"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={onSubmit} disabled={busy || !canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {t("createProject")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-border bg-background/50 px-2 py-1">
      <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-semibold text-zinc-200">{value}</div>
    </div>
  );
}
