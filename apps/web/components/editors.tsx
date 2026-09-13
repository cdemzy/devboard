"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LayersPlus, LoaderCircle, Minimize2, Trash2, X } from "lucide-react";
import type { Priority, Project, ProjectTag, Status, Task, TaskInput } from "@/lib/types";
import { statusLabels, statuses } from "@/lib/types";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { api } from "@/lib/api";

function capitalizeFirst(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

export function ProjectEditor({ project, close, save }: {
  project?: Project;
  close: () => void;
  save: (data: { name: string; description: string; tags: string[] }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tags, setTags] = useState<string[]>(project?.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<ProjectTag[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void api<ProjectTag[]>("/project-tags").then((savedTags) => {
      if (active) setSuggestions(savedTags);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  function addTag(value = tagInput) {
    const tag = value.trim();
    if (!tag) return;
    if (tag.length > 40) { setError("Tags can be up to 40 characters."); return; }
    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setTagInput("");
      return;
    }
    if (tags.length >= 20) { setError("A project can have up to 20 tags."); return; }
    setTags((current) => [...current, tag]);
    setTagInput("");
    setSuggestionsOpen(false);
    setError("");
  }

  const matchingSuggestions = suggestions.filter((tag) =>
    !tags.some((selected) => selected.toLowerCase() === tag.name.toLowerCase())
    && tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()),
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) close(); }}>
      <DialogContent className="project-editor-dialog h-[80vh] w-[80vw] max-w-none p-10 md:p-14">
        <DialogTitle className="sr-only">{project ? "Edit project" : "New project"}</DialogTitle>
        <form className="project-editor-form mx-auto flex h-full max-w-3xl flex-col" onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          const name = String(form.get("name")).trim();
          if (!name) { setError("Enter a project name."); return; }
          setBusy(true); setError("");
          try { await save({ name, description: String(form.get("description")), tags }); close(); }
          catch (error) { setError(error instanceof Error ? error.message : "Unable to save."); }
          finally { setBusy(false); }
        }}>
          <input name="name" defaultValue={project?.name} required maxLength={120} autoComplete="off" placeholder="Untitled project" autoFocus className="project-editor-name h-auto border-0 bg-transparent px-0 py-2 text-3xl font-semibold tracking-tight placeholder:text-muted-foreground/55 focus-visible:ring-0 md:text-4xl" />
          <div className="project-editor-description-field mt-8 grid gap-2">
            <span className="text-sm font-medium text-muted-foreground">Description</span>
            <textarea name="description" defaultValue={project?.description} maxLength={90} placeholder="Add a description…" className="project-editor-description min-h-28 resize-y border-0 bg-transparent px-0 text-base focus-visible:ring-0" />
          </div>
          <div className="project-editor-platform-field mt-7 grid gap-2">
            <span className="text-sm font-medium text-muted-foreground">Platform</span>
            <div className="project-editor-platform-input relative flex min-h-10 flex-wrap items-center gap-1.5">
              {tags.map((tag) => <span key={tag} className="project-editor-tag flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs text-primary"><span>{tag}</span><button type="button" onClick={(event) => { event.stopPropagation(); setTags((current) => current.filter((item) => item !== tag)); }} className="project-editor-tag-remove rounded-full hover:text-foreground" aria-label={`Remove ${tag} tag`}><X size={12} /></button></span>)}
            <input value={tagInput} onChange={(event) => { setTagInput(event.target.value); setSuggestionsOpen(true); }} onFocus={() => setSuggestionsOpen(true)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} maxLength={40} placeholder="Add a platform" aria-label="Add project platform" aria-expanded={suggestionsOpen && matchingSuggestions.length > 0} aria-controls="project-tag-suggestions" className="project-editor-tag-input h-8 w-32 border-0 bg-transparent px-0 text-sm focus-visible:ring-0" />
              <Button type="button" variant="ghost" size="sm" onClick={() => addTag()} disabled={!tagInput.trim()}>Add</Button>
              {suggestionsOpen && matchingSuggestions.length > 0 && <div id="project-tag-suggestions" role="listbox" className="project-editor-tag-suggestions absolute left-0 top-full z-10 mt-2 w-64 max-h-40 overflow-y-auto rounded-md border border-border bg-[#161b22] p-1 shadow-lg">{matchingSuggestions.map((tag) => <button key={tag.id} type="button" role="option" onMouseDown={(event) => event.preventDefault()} onClick={() => addTag(tag.name)} className="project-editor-tag-suggestion flex w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"><span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">{tag.name}</span></button>)}</div>}
            </div>
          </div>
          {error && <p role="alert" className="project-editor-error text-rose-300">{error}</p>}
          <div className="project-editor-actions mt-auto flex justify-end border-t border-border pt-5">
            {project ? <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button> : <Tooltip label="Create project"><Button size="icon" aria-label="Create project" disabled={busy}>{busy ? <LoaderCircle size={16} className="animate-spin" /> : <LayersPlus size={17} />}</Button></Tooltip>}
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

  function minimize() {
    if (dirty) void saveLatest();
    close();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) minimize(); }}>
      <DialogContent hideClose className="task-editor-dialog h-[80vh] w-[80vw] max-w-none">
        <DialogTitle className="text-lg font-semibold">{currentTask ? "Task details" : "New task"}</DialogTitle>
        <div className="task-editor-toolbar absolute right-4 top-4 flex items-center gap-1">
          {currentTask && remove && <Tooltip label="Delete"><Button type="button" variant="ghost" size="icon" className="task-editor-delete text-rose-300" onClick={() => remove(currentTask)} disabled={busy} aria-label="Delete task"><Trash2 size={15} /></Button></Tooltip>}
          <Tooltip label="Minimize"><Button type="button" variant="ghost" size="icon" onClick={minimize} aria-label="Minimize task"><Minimize2 size={16} /></Button></Tooltip>
        </div>
        <div className="task-editor-fields space-y-4">
          <label>Title<input name="title" value={draft.title} onChange={(event) => updateDraft({ title: capitalizeFirst(event.target.value) })} onBlur={() => { if (dirty) void saveLatest(); }} required maxLength={240} autoComplete="off" autoCapitalize="sentences" autoFocus placeholder="What needs to happen?" /></label>
          <label>Description<textarea name="description" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} onBlur={() => { if (dirty) void saveLatest(); }} maxLength={10000} placeholder="Details, context, or acceptance criteria…" /></label>
          <div className="task-editor-selects grid grid-cols-2 gap-4">
            <label>Status<select name="status" value={draft.status} onChange={(event) => updateDraft({ status: event.target.value as Status })} onBlur={() => { if (dirty) void saveLatest(); }}>{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <label>Priority<select name="priority" value={draft.priority} onChange={(event) => updateDraft({ priority: event.target.value as Priority })} onBlur={() => { if (dirty) void saveLatest(); }}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
          </div>
          {currentTask && <p className="task-editor-metadata text-xs text-muted-foreground">Created {new Date(currentTask.created_at).toLocaleDateString()} · Updated {new Date(currentTask.updated_at).toLocaleDateString()}</p>}
          {error && <p role="alert" className="task-editor-error text-rose-300">{error}</p>}
          <p className="task-editor-save-status flex items-center gap-2 pt-2 text-xs text-muted-foreground" aria-live="polite">
            {busy ? <LoaderCircle size={13} className="animate-spin" /> : null}
            {busy ? "Saving changes…" : dirty ? "Changes waiting to save…" : "All changes saved"}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
