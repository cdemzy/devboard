"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArrowLeft,
  Database,
  Ellipsis,
  FolderKanban,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api, json } from "@/lib/api";
import { moveTask } from "@/lib/board";
import type { Project, ProjectTag, Status, Task } from "@/lib/types";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Tooltip } from "./ui/tooltip";
import { SectionLoader } from "./ui/section-loader";
import { TaskEditor } from "./editors";
import { KanbanBoard } from "./kanban-board";

const boardErrorToastId = "board-error";
const platformNameToastId = "platform-name-error";
const tagColorValues = { green: "#386C4E", yellow: "#886826", purple: "#6C5082", orange: "#88522F", blue: "#355F8B", pink: "#7B4760", red: "#924943", brown: "#6D5340" } as const;

function reportBoardError(error: unknown, fallback: string, retry?: () => void) {
  toast.error(error instanceof Error ? error.message : fallback, {
    id: boardErrorToastId,
    duration: Infinity,
    ...(retry ? { action: { label: "Reload board", onClick: retry } } : {}),
  });
}
function capitalizePlatform(value: string) {
  return value.replace(/(^|[\s-])\p{L}/gu, (character) => character.toUpperCase());
}
export function ProjectView({
  project,
  update,
  refresh,
}: {
  project: Project;
  update: (project: Project) => void;
  refresh: () => Promise<void>;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [view, setView] = useState<"board" | "archived">("board");
  const [archivedTasksLoading, setArchivedTasksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const moving = useRef(false);
  const [projectDraft, setProjectDraft] = useState(() => ({ name: project.name === "New Project" ? "" : project.name, description: project.description, tags: project.tags }));
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<ProjectTag[]>([]);
  const [tagMenuId, setTagMenuId] = useState<string | null>(null);
  const [tagNameDraft, setTagNameDraft] = useState("");
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const tagNameInputRef = useRef<HTMLInputElement>(null);
  const pendingTagColorsRef = useRef<Record<string, { color: ProjectTag["color"]; previous: ProjectTag["color"] }>>({});
  const loadTagSuggestions = useCallback(async () => {
    const tags = await api<ProjectTag[]>("/project-tags");
    setTagSuggestions(tags.map((tag) => pendingTagColorsRef.current[tag.id] ? { ...tag, color: pendingTagColorsRef.current[tag.id].color } : tag));
  }, []);
  const [editor, setEditor] = useState<{ task?: Task; status?: Status } | null>(
    null,
  );
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  useEffect(() => {
    setProjectDraft({ name: project.name === "New Project" ? "" : project.name, description: project.description, tags: project.tags });
    setTagInput("");
  }, [project.id]);
  useEffect(() => {
    void loadTagSuggestions().catch(() => undefined);
  }, [loadTagSuggestions]);
  useEffect(() => {
    if (tagMenuId) {
      const activeTag = tagSuggestions.find((tag) => tag.id === tagMenuId);
      if (activeTag) void persistTagColor(activeTag);
    }
    setTagMenuId(null);
  // The menu should only close when the search input changes, not on color-state updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagInput]);
  useEffect(() => {
    function closeTags(event: PointerEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) {
        if (tagMenuId && !tagNameDraft.trim()) {
          toast.error("Platform name is required.", { id: platformNameToastId, duration: Infinity });
          window.requestAnimationFrame(() => tagNameInputRef.current?.focus());
          return;
        }
        const activeTag = tagSuggestions.find((tag) => tag.id === tagMenuId);
        if (activeTag) void persistTagColor(activeTag);
        setTagsOpen(false);
        setTagMenuId(null);
      }
    }
    document.addEventListener("pointerdown", closeTags);
    return () => document.removeEventListener("pointerdown", closeTags);
  }, [tagMenuId, tagNameDraft, tagSuggestions]);
  useEffect(() => {
    const name = projectDraft.name.trim() || "New Project";
    const unchanged = name === project.name && projectDraft.description === project.description
      && projectDraft.tags.length === project.tags.length
      && projectDraft.tags.every((tag, index) => tag === project.tags[index]);
    if (unchanged) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          update(await api<Project>(`/projects/${project.id}`, json("PATCH", { ...projectDraft, name })));
          void loadTagSuggestions().catch(() => undefined);
          toast.dismiss(boardErrorToastId);
        } catch (error) {
          reportBoardError(error, "Unable to save project changes.");
        }
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project.id, project.name, project.description, project.tags, projectDraft, update, loadTagSuggestions]);
  const loadTasks = useCallback(async () => {
    try {
      const result = await api<Task[]>(`/projects/${project.id}/tasks`);
      setTasks(result);
      toast.dismiss(boardErrorToastId);
    } catch (error) {
      reportBoardError(error, "Unable to load tasks.", () => void loadTasks());
      throw error;
    }
  }, [project.id]);
  const loadArchivedTasks = useCallback(async () => {
    setArchivedTasksLoading(true);
    try {
      setArchivedTasks(await api<Task[]>(`/projects/${project.id}/tasks?archived=true`));
      toast.dismiss(boardErrorToastId);
    } catch (error) {
      reportBoardError(error, "Unable to load archived tasks.", () => void loadArchivedTasks());
      throw error;
    } finally {
      setArchivedTasksLoading(false);
    }
  }, [project.id]);
  useEffect(() => {
    let alive = true;
    loadTasks().catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [loadTasks]);
  async function action(
    work: () => Promise<void>,
    label = "Saving...",
    successMessage?: string,
  ) {
    setBusy(true);
    try {
      await work();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      reportBoardError(error, "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, status: Status, position: number) {
    if (moving.current || busy) return;
    moving.current = true;
    setBusy(true);
    const previous = tasks;
    setTasks(moveTask(tasks, id, status, position));
    try {
      setTasks(
        await api<Task[]>(
          `/tasks/${id}/move`,
          json("POST", { status, position }),
        ),
      );
      toast.dismiss(boardErrorToastId);
    } catch (error) {
      setTasks(previous);
      reportBoardError(error, "Move failed. The board has been restored; reload to check saved state.", () => void loadTasks());
    } finally {
      moving.current = false;
      setBusy(false);
    }
  }
  function archiveTask(task: Task) {
    void action(async () => {
      await api(`/tasks/${task.id}/archive`, json("POST"));
      await loadTasks();
      if (view === "archived") await loadArchivedTasks();
    }, "Archiving...", "Task archived");
  }
  function restoreTask(task: Task) {
    void action(async () => {
      await api(`/tasks/${task.id}/restore`, json("POST"));
      await Promise.all([loadTasks(), loadArchivedTasks()]);
    }, "Restoring...", "Task restored");
  }
  const completed = tasks.filter((task) => task.status === "done").length;
  const matchingTags = tagSuggestions.filter((tag) => tag.name.toLowerCase().includes(tagInput.trim().toLowerCase()));
  function addTag() {
    const tag = capitalizePlatform(tagInput.trim());
    if (!tag || tag.length > 40 || projectDraft.tags.some((item) => item.toLowerCase() === tag.toLowerCase()) || projectDraft.tags.length >= 20) return;
    setTagSuggestions((current) => current.some((item) => item.name.toLowerCase() === tag.toLowerCase()) ? current : [...current, { id: `pending-${tag.toLowerCase()}`, name: tag, color: "purple" }]);
    setProjectDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagInput("");
  }
  function toggleTag(tag: string) {
    setProjectDraft((current) => ({
      ...current,
      tags: current.tags.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? current.tags.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : [...current.tags, tag],
    }));
    setTagInput("");
  }
  function saveFallbackProjectName() {
    if (projectDraft.name.trim() || project.name === "New Project") return;
    void api<Project>(`/projects/${project.id}`, json("PATCH", { ...projectDraft, name: "New Project" }))
      .then(update)
      .catch((error) => reportBoardError(error, "Unable to save project changes."));
  }
  function updateTagColor(tag: ProjectTag, color: ProjectTag["color"]) {
    const pending = pendingTagColorsRef.current[tag.id];
    pendingTagColorsRef.current[tag.id] = { color, previous: pending?.previous ?? tag.color };
    setTagSuggestions((tags) => tags.map((item) => item.id === tag.id ? { ...item, color } : item));
  }
  async function persistTagColor(tag: ProjectTag) {
    const pending = pendingTagColorsRef.current[tag.id];
    if (!pending) return;
    delete pendingTagColorsRef.current[tag.id];
    if (pending.color === pending.previous || tag.id.startsWith("pending-")) return;
    try {
      const updated = await api<ProjectTag>(`/project-tags/${tag.id}`, json("PATCH", { color: pending.color }));
      if (!pendingTagColorsRef.current[tag.id]) {
        setTagSuggestions((tags) => tags.map((item) => item.id === updated.id ? updated : item));
      }
    } catch (error) {
      if (!pendingTagColorsRef.current[tag.id]) {
        setTagSuggestions((tags) => tags.map((item) => item.id === tag.id ? { ...item, color: pending.previous } : item));
      }
      reportBoardError(error, "Unable to save platform color.");
    }
  }
  async function renameTag(tag: ProjectTag, value: string) {
    const name = capitalizePlatform(value.trim());
    if (!name) {
      setTagsOpen(true);
      setTagMenuId(tag.id);
      toast.error("Platform name is required.", { id: platformNameToastId, duration: Infinity });
      window.requestAnimationFrame(() => tagNameInputRef.current?.focus());
      return;
    }
    if (name.length > 40 || name === tag.name) {
      setTagNameDraft(tag.name);
      return;
    }
    if (tagSuggestions.some((item) => item.id !== tag.id && item.name.toLowerCase() === name.toLowerCase())) {
      setTagNameDraft(tag.name);
      reportBoardError(new Error("A platform with this name already exists"), "Unable to rename platform.");
      return;
    }
    const previousSuggestions = tagSuggestions;
    const previousProjectTags = projectDraft.tags;
    setTagSuggestions((tags) => tags.map((item) => item.id === tag.id ? { ...item, name } : item));
    setProjectDraft((current) => ({ ...current, tags: current.tags.map((item) => item.toLowerCase() === tag.name.toLowerCase() ? name : item) }));
    toast.dismiss(platformNameToastId);
    if (tag.id.startsWith("pending-")) return;
    try {
      const updated = await api<ProjectTag>(`/project-tags/${tag.id}`, json("PATCH", { name }));
      setTagSuggestions((tags) => tags.map((item) => item.id === updated.id ? updated : item));
      await refresh();
    } catch (error) {
      setTagSuggestions(previousSuggestions);
      setProjectDraft((current) => ({ ...current, tags: previousProjectTags }));
      setTagNameDraft(tag.name);
      reportBoardError(error, "Unable to rename platform.");
    }
  }
  function toggleTagMenu(tag: ProjectTag) {
    if (tagMenuId === tag.id) {
      if (!tagNameDraft.trim()) {
        toast.error("Platform name is required.", { id: platformNameToastId, duration: Infinity });
        window.requestAnimationFrame(() => tagNameInputRef.current?.focus());
        return;
      }
      void persistTagColor(tag);
      setTagMenuId(null);
      return;
    }
    const activeTag = tagSuggestions.find((item) => item.id === tagMenuId);
    if (activeTag) void persistTagColor(activeTag);
    setTagNameDraft(tag.name);
    setTagMenuId(tag.id);
  }
  async function deleteTag(tag: ProjectTag) {
    const previousSuggestions = tagSuggestions;
    const previousProjectTags = projectDraft.tags;
    delete pendingTagColorsRef.current[tag.id];
    setTagSuggestions((tags) => tags.filter((item) => item.id !== tag.id));
    setProjectDraft((current) => ({ ...current, tags: current.tags.filter((name) => name.toLowerCase() !== tag.name.toLowerCase()) }));
    setTagMenuId(null);
    try {
      await api(`/project-tags/${tag.id}`, json("DELETE"));
    } catch (error) {
      setTagSuggestions(previousSuggestions);
      setProjectDraft((current) => ({ ...current, tags: previousProjectTags }));
      reportBoardError(error, "Unable to delete tag.");
      return;
    }
    try {
      await refresh();
    } catch (error) {
      reportBoardError(error, "Unable to refresh project after deleting tag.");
    }
  }
  return (
    <>
      <div className="px-5 pt-8 md:px-8">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-3xl flex-1">
            <input value={projectDraft.name} onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} onBlur={saveFallbackProjectName} aria-label="Project name" autoComplete="off" maxLength={120} placeholder="New Project" className="h-auto w-full !border-0 !bg-transparent px-0 py-0 !text-3xl !font-bold !leading-tight tracking-tight placeholder:text-muted-foreground !outline-none focus:!outline-none" />
            <input value={projectDraft.description} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} aria-label="Project description" maxLength={90} placeholder="Description" className="mt-2 h-auto w-full !border-0 !bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground !outline-none focus:!outline-none" />
            <div className="mt-3 flex items-start gap-5">
              <div className="flex h-9 w-40 shrink-0 items-center gap-2 pl-2 text-sm text-muted-foreground"><Database size={15} />Platform</div>
              <div ref={tagMenuRef} className="relative min-w-0 flex-1">
              <div role="button" tabIndex={0} onMouseDown={(event) => { if (event.target === event.currentTarget) event.preventDefault(); }} onClick={() => setTagsOpen(true)} onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setTagsOpen(true); } }} className={`flex min-h-9 cursor-pointer flex-wrap items-center gap-1.5 !outline-none [-webkit-tap-highlight-color:transparent] focus:!outline-none ${tagsOpen ? "rounded-t-md border border-border bg-accent px-3 py-3" : "rounded-md px-2 py-2"}`} aria-label="Edit project tags" aria-expanded={tagsOpen}>
                {projectDraft.tags.length === 0 && !tagsOpen ? <span className="px-1 text-xs text-muted-foreground">Add platform</span> : projectDraft.tags.map((tag) => { const catalog = tagSuggestions.find((item) => item.name.toLowerCase() === tag.toLowerCase()); return <span key={tag} style={{ backgroundColor: tagColorValues[catalog?.color ?? "purple"], fontSize: "12px", lineHeight: 1 }} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-white">{tag}<button type="button" onClick={(event) => { event.stopPropagation(); setProjectDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) })); }} aria-label={`Remove ${tag} tag`} className="rounded-sm text-white/65 hover:text-white"><X size={12} /></button></span>; })}
                {tagsOpen && <input autoFocus value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const exactMatch = tagSuggestions.find((tag) => tag.name.toLowerCase() === tagInput.trim().toLowerCase()); if (exactMatch) toggleTag(exactMatch.name); else addTag(); } }} aria-label="Search or create a project tag" maxLength={40} placeholder="Search for an option…" className="-ml-1 h-7 min-w-36 flex-1 !border-0 !bg-transparent px-0 text-xs !outline-none focus:!outline-none" />}
              </div>
              {tagsOpen && <div role="dialog" aria-label="Project tag options" className="absolute inset-x-0 top-full z-20 rounded-b-md border border-t-0 border-border bg-[#161b22] p-2 shadow-xl">
                <p className="mb-1.5 text-xs text-muted-foreground">Select a tag or create one</p>
                {matchingTags.length > 0 && <div className="flex flex-wrap gap-1.5">{matchingTags.map((tag) => <div key={tag.id} style={{ backgroundColor: tagColorValues[tag.color], fontSize: "12px", lineHeight: 1 }} className="relative flex items-center rounded-sm text-white"><button type="button" onClick={() => { setTagMenuId(null); toggleTag(tag.name); }} style={{ fontSize: "12px", lineHeight: 1 }} className="px-1.5 py-0.5">{tag.name}</button><button type="button" onClick={(event) => { event.stopPropagation(); toggleTagMenu(tag); }} aria-label={`Platform options for ${tag.name}`} className="mr-0.5 rounded-sm p-0.5 text-white/70 hover:text-white"><Ellipsis size={14} /></button>{tagMenuId === tag.id && <div className="absolute left-0 top-full z-30 mt-1 w-52 rounded-md border border-border bg-[#161b22] p-1.5 text-foreground shadow-xl"><div className="flex gap-1.5"><input ref={tagNameInputRef} value={tagNameDraft} onChange={(event) => { setTagNameDraft(event.target.value); if (event.target.value.trim()) toast.dismiss(platformNameToastId); }} onBlur={(event) => void renameTag(tag, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") { if (!tagNameDraft.trim()) { toast.error("Platform name is required.", { id: platformNameToastId, duration: Infinity }); return; } void persistTagColor(tag); setTagNameDraft(tag.name); setTagMenuId(null); } }} aria-label={`Rename ${tag.name}`} maxLength={40} className="h-8 !border !border-[#484f58] !bg-[#2d333b] px-2 py-1 text-xs !outline-none focus:!outline-none" /><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => void deleteTag(tag)} aria-label={`Delete ${tag.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-[#484f58] bg-[#2d333b] text-rose-300 hover:text-rose-200"><Trash2 size={13} /></button></div><div className="my-2 border-t border-border" /><p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Colors</p><div className="grid grid-cols-4 gap-1">{Object.entries(tagColorValues).map(([color, value]) => <button key={color} type="button" aria-label={`Set ${tag.name} to ${color}`} onClick={() => updateTagColor(tag, color as ProjectTag["color"])} style={{ backgroundColor: value }} className="h-5 rounded-sm" />)}</div></div>}</div>)}</div>}
                {tagInput.trim() && !tagSuggestions.some((tag) => tag.name.toLowerCase() === tagInput.trim().toLowerCase()) && <button type="button" onClick={addTag} className="mt-2 flex w-full items-center gap-2 rounded bg-[#2d333b] px-2 py-1.5 text-left text-xs">Create <span className="rounded-sm bg-[#484f58] px-2 py-0.5 text-foreground">{tagInput.trim()}</span></button>}
              </div>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Tooltip label={project.archived ? "Restore" : "Archive"}>
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  project.archived ? "Restore project" : "Archive project"
                }
                disabled={busy}
                onClick={() =>
                  void action(
                    async () => {
                      await api(
                        `/projects/${project.id}`,
                        json("PATCH", { archived: !project.archived }),
                      );
                      await refresh();
                    },
                    project.archived ? "Restoring..." : "Archiving...",
                    project.archived ? "Project restored" : "Project archived",
                  )
                }
              >
                {project.archived ? (
                  <ArrowLeft size={15} />
                ) : (
                  <Archive size={15} />
                )}
              </Button>
            </Tooltip>
            <Tooltip label="Delete">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete project"
                disabled={busy}
                onClick={() => setConfirmProjectDelete(true)}
              >
                <Trash2 size={15} />
              </Button>
            </Tooltip>
            {!project.archived && (
              <Button
                className="ml-3"
                disabled={busy || loading}
                onClick={() => setEditor({})}
              >
                <Plus size={15} />
                New task
              </Button>
            )}
          </div>
        </header>
        <div className="mb-5 flex items-center border-b border-border pb-3"><div className="flex items-center gap-1"><button onClick={() => setView("board")} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === "board" ? "bg-[#30363d] text-foreground shadow-sm" : "text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground"}`}><LayoutDashboard size={14} className={view === "board" ? "text-primary" : ""} />Board</button><button onClick={() => { setView("archived"); void loadArchivedTasks(); }} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === "archived" ? "bg-[#30363d] text-foreground shadow-sm" : "text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground"}`}><Archive size={14} />Archived tasks</button></div>{view === "board" && <span className="ml-auto text-xs text-muted-foreground">{`${tasks.length} tasks · ${completed} completed`}</span>}</div>
        {view === "archived" && <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-border bg-[#161b22] p-4">{archivedTasksLoading ? <p className="text-sm text-muted-foreground">Loading archived tasks…</p> : archivedTasks.length === 0 ? <p className="text-sm text-muted-foreground">No archived tasks.</p> : <div className="space-y-2">{archivedTasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-3"><div className="min-w-0 flex-1"><span className="text-xs font-medium text-primary">{task.ticket_id}</span><p className="truncate text-sm font-medium">{task.title}</p></div><Tooltip label="Restore"><Button variant="ghost" size="icon" aria-label={`Restore ${task.ticket_id}`} disabled={busy || project.archived} onClick={() => restoreTask(task)}><RotateCcw size={15} /></Button></Tooltip><Tooltip label="Delete permanently"><Button variant="ghost" size="icon" aria-label={`Delete ${task.ticket_id}`} disabled={busy} className="text-rose-300" onClick={() => setTaskToDelete(task)}><Trash2 size={15} /></Button></Tooltip></div>)}</div>}</motion.section>}
        {view === "board" && <motion.div key="board" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>{loading ? (
          <SectionLoader
            icon={project.archived ? Archive : FolderKanban}
            label="Loading board..."
          />
        ) : (
          <KanbanBoard
            tasks={tasks}
            disabled={project.archived}
            edit={(task) => setEditor({ task })}
            archive={archiveTask}
            create={(status) => setEditor({ status })}
            move={(...args) => void move(...args)}
          />
        )}</motion.div>}
        {project.archived && <p className="pb-6 text-[11px] text-muted-foreground">Restore this project to change its tasks.</p>}
      </div>
      {editor && (
        <TaskEditor
          task={editor.task}
          initialStatus={editor.status}
          close={() => setEditor(null)}
          save={async (data, taskId) => {
            if (taskId) {
              setTasks((previous) =>
                previous.map((task) =>
                  task.id === taskId
                    ? { ...task, ...data, updated_at: new Date().toISOString() }
                    : task,
                ),
              );
            }
            const saved = await api<Task>(
              taskId
                ? `/tasks/${taskId}`
                : `/projects/${project.id}/tasks`,
              json(taskId ? "PATCH" : "POST", data),
            );
            await loadTasks().catch(() => undefined);
            return saved;
          }}
        />
      )}
      <ConfirmDialog
        open={Boolean(taskToDelete)}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Delete task?"
        description={`This will permanently delete ${taskToDelete?.ticket_id ?? "this task"}.`}
        confirmLabel="Delete task"
        onConfirm={async () => {
          if (!taskToDelete) return;
          await api(`/tasks/${taskToDelete.id}`, json("DELETE"));
          await Promise.all([loadTasks(), loadArchivedTasks()]);
        }}
      />
      <ConfirmDialog
        open={confirmProjectDelete}
        onOpenChange={setConfirmProjectDelete}
        title="Delete project?"
        description={`This will permanently delete "${project.name}" and all of its tasks.`}
        confirmLabel="Delete project"
        onConfirm={async () => {
          await api(`/projects/${project.id}`, json("DELETE"));
          await refresh();
        }}
      />
    </>
  );
}
