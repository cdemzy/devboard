"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, Minimize2, Trash2 } from "lucide-react";
import type { Priority, Project, Status, Task, TaskInput } from "@/lib/types";
import { statusLabels, statuses } from "@/lib/types";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

function capitalizeFirst(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function ProjectEditor({ project, close, save }: {
  project?: Project;
  close: () => void;
  save: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">{project ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription className="mb-6 mt-1 text-sm text-muted-foreground">Give your work a place to take shape.</DialogDescription>
        <form className="space-y-4" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name")).trim();
          if (!name) { setError("Enter a project name."); return; }
          setBusy(true); setError("");
          try { await save({ name, description: String(form.get("description")) }); close(); }
          catch (error) { setError(error instanceof Error ? error.message : "Unable to save."); }
          finally { setBusy(false); }
        }}>
          <label>Project name<input name="name" defaultValue={project?.name} required maxLength={120} placeholder="e.g. Developer portal" autoFocus /></label>
          <label>Description<textarea name="description" defaultValue={project?.description} maxLength={10000} placeholder="What are you building? (optional)" /></label>
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button disabled={busy}>{busy ? "Saving…" : project ? "Save changes" : "Create project"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaskEditor({ task, initialStatus = "todo", close, save, remove }: {
  task?: Task;
  initialStatus?: Status;
  close: () => void;
  save: (data: TaskInput, taskId?: string) => Promise<Task>;
  remove?: (task: Task) => void;
}) {
  const [currentTask, setCurrentTask] = useState(task);
  const [draft, setDraft] = useState<TaskInput>({
    title: task?.title ?? "",
    description: task?.description ?? "",
    status: task?.status ?? initialStatus,
    priority: task?.priority ?? "medium",
  });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const lastSavedRevision = useRef(0);
  const saving = useRef(false);
  const draftRef = useRef(draft);
  const taskRef = useRef(currentTask);

  function updateDraft(change: Partial<TaskInput>) {
    revision.current += 1;
    setDraft((previous) => {
      const updated = { ...previous, ...change };
      draftRef.current = updated;
      return updated;
    });
    setDirty(true);
  }

  const saveLatest = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      while (lastSavedRevision.current < revision.current) {
        const revisionAtSave = revision.current;
        const nextDraft = draftRef.current;
        const title = nextDraft.title.trim();
        if (!title) break;
        const saved = await save({ ...nextDraft, title }, taskRef.current?.id);
        taskRef.current = saved;
        setCurrentTask(saved);
        lastSavedRevision.current = revisionAtSave;
      }
      if (lastSavedRevision.current === revision.current) setDirty(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [save]);

  useEffect(() => {
    if (dirty) void saveLatest();
  }, [dirty, draft, saveLatest]);

  function minimize() {
    if (dirty) void saveLatest();
    close();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent hideClose className="h-[80vh] w-[80vw] max-w-none">
        <DialogTitle className="text-lg font-semibold">{currentTask ? "Task details" : "New task"}</DialogTitle>
        <div className="absolute right-4 top-4 flex items-center gap-1">
          {currentTask && remove && <Tooltip label="Delete"><Button type="button" variant="ghost" size="icon" className="text-rose-300" onClick={() => remove(currentTask)} disabled={busy} aria-label="Delete task"><Trash2 size={15} /></Button></Tooltip>}
          <Tooltip label="Minimize"><Button type="button" variant="ghost" size="icon" onClick={minimize} aria-label="Minimize task"><Minimize2 size={16} /></Button></Tooltip>
        </div>
        <DialogDescription className="mb-6 mt-1 text-sm text-muted-foreground">{currentTask ? "Update the details and keep work moving." : "Start with a clear next step."}</DialogDescription>
        <div className="space-y-4">
          <label>Title<input name="title" value={draft.title} onChange={(event) => updateDraft({ title: capitalizeFirst(event.target.value) })} required maxLength={240} autoCapitalize="sentences" autoFocus placeholder="What needs to happen?" /></label>
          <label>Description<textarea name="description" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} maxLength={10000} placeholder="Details, context, or acceptance criteria…" /></label>
          <div className="grid grid-cols-2 gap-4">
            <label>Status<select name="status" value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as Status })}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label>Priority<select name="priority" value={draft.priority} onChange={(event) => updateDraft({ priority: event.target.value as Priority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          </div>
          {currentTask && <p className="text-xs text-muted-foreground">Created {new Date(currentTask.created_at).toLocaleDateString()} · Updated {new Date(currentTask.updated_at).toLocaleDateString()}</p>}
          {error && <p role="alert" className="text-rose-300">{error}</p>}
          <p className="flex items-center gap-2 pt-2 text-xs text-muted-foreground" aria-live="polite">
            {busy ? <LoaderCircle size={13} className="animate-spin" /> : null}
            {busy ? "Saving changes…" : dirty ? "Changes waiting to save…" : "All changes saved"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
