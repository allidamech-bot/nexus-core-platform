import { useMemo, useRef, useState, type ReactNode } from "react";
import { FileArchive, Loader2, Upload } from "lucide-react";
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
import { useUploadProjectMutation } from "./projectQueries";
import { deriveProjectName, validateProjectZip } from "./projectUploadService";
import { PROJECT_UPLOAD_MAX_MB } from "./constants";

export function ProjectUploadDialog({ userId, trigger }: { userId: string; trigger: ReactNode }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const uploadProject = useUploadProjectMutation();

  const validationError = useMemo(() => (file ? validateProjectZip(file) : null), [file]);
  const busy = uploadProject.isPending;

  async function onSubmit() {
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
      setFile(null);
      setName("");
      setDescription("");
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
            <DialogTitle className="text-xl tracking-tight">Upload project archive</DialogTitle>
            <DialogDescription>
              Create a real project record, manifest, and safe text preview index from a ZIP
              archive.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full rounded-lg border border-dashed p-6 text-left transition-colors ${
              validationError
                ? "border-destructive/50 bg-destructive/5"
                : "border-border bg-surface"
            } hover:border-accent/40`}
          >
            <div className="flex items-start gap-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10">
                <FileArchive className="size-5 text-accent" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold">
                  {file ? file.name : "Select a .zip archive"}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  ZIP only, max {PROJECT_UPLOAD_MAX_MB}MB. Nexus Core reads small allowlisted text
                  previews only and never executes project code.
                </div>
                {file && (
                  <div className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB / {file.type || "unknown type"}
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

          {validationError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {validationError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Project name
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
              Description
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
            Cancel
          </Button>
          <Button type="button" onClick={onSubmit} disabled={busy || !file || !!validationError}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Create project
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
