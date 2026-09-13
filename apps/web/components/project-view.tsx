"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArrowLeft,
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
import type { Project, Status, Task } from "@/lib/types";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Tooltip } from "./ui/tooltip";
import { SectionLoader } from "./ui/section-loader";
import { TaskEditor } from "./editors";
import { KanbanBoard } from "./kanban-board";

const boardErrorToastId = "board-error";

function reportBoardError(error: unknown, fallback: string, retry?: () => void) {
  toast.error(error instanceof Error ? error.message : fallback, {
    id: boardErrorToastId,
    duration: Infinity,
    ...(retry ? { action: { label: "Reload board", onClick: retry } } : {}),
  });
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
  const [projectDraft, setProjectDraft] = useState(() => ({ name: project.name, description: project.description, tags: project.tags }));
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [tagsOpen, setTagsOpen] = useState(false);
  const tagMenuRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<{ task?: Task; status?: Status } | null>(
    null,
  );
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  useEffect(() => {
    setProjectDraft({ name: project.name, description: project.description, tags: project.tags });
    setTagInput("");
  }, [project.id]);
  useEffect(() => {
    void api<string[]>("/project-tags").then(setTagSuggestions).catch(() => undefined);
  }, []);
  useEffect(() => {
    function closeTags(event: PointerEvent) {
      if (tagMenuRef.current && !tagMenuRef.current.contains(event.target as Node)) setTagsOpen(false);
    }
    document.addEventListener("pointerdown", closeTags);
    return () => document.removeEventListener("pointerdown", closeTags);
  }, []);
  useEffect(() => {
    const name = projectDraft.name.trim();
    const unchanged = name === project.name && projectDraft.description === project.description
      && projectDraft.tags.length === project.tags.length
      && projectDraft.tags.every((tag, index) => tag === project.tags[index]);
    if (unchanged || !name) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          update(await api<Project>(`/projects/${project.id}`, json("PATCH", { ...projectDraft, name })));
          toast.dismiss(boardErrorToastId);
        } catch (error) {
          reportBoardError(error, "Unable to save project changes.");
        }
      })();
    }, 500);
    return () => window.clearTimeout(timer);
  }, [project.id, project.name, project.description, project.tags, projectDraft, update]);
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
  const availableTags = tagSuggestions.filter((tag) =>
    !projectDraft.tags.some((selected) => selected.toLowerCase() === tag.toLowerCase())
    && tag.toLowerCase().includes(tagInput.trim().toLowerCase()),
  );
  function addTag() {
    const tag = tagInput.trim();
    if (!tag || tag.length > 40 || projectDraft.tags.some((item) => item.toLowerCase() === tag.toLowerCase()) || projectDraft.tags.length >= 20) return;
    setProjectDraft((current) => ({ ...current, tags: [...current.tags, tag] }));
    setTagInput("");
    setTagsOpen(false);
  }
  return (
    <>
      <div className="px-5 pt-8 md:px-8">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 max-w-3xl flex-1">
            <input value={projectDraft.name} onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} aria-label="Project name" autoComplete="off" maxLength={120} className="h-auto w-full !border-0 !bg-transparent px-0 py-0 text-3xl font-bold tracking-tight !outline-none focus:!outline-none md:text-4xl" />
            <input value={projectDraft.description} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} aria-label="Project description" maxLength={10000} placeholder="Add a description…" className="mt-2 h-auto w-full !border-0 !bg-transparent px-0 py-0 text-sm leading-6 text-muted-foreground !outline-none focus:!outline-none" />
            <div ref={tagMenuRef} className="relative mt-3">
              <div role="button" tabIndex={0} onClick={() => setTagsOpen(true)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setTagsOpen(true); } }} className={`flex min-h-9 cursor-pointer flex-wrap items-center gap-1.5 rounded-md px-1 py-1 transition-colors ${tagsOpen ? "outline outline-2 outline-ring outline-offset-1" : "hover:bg-accent/40"}`} aria-label="Edit project tags" aria-expanded={tagsOpen}>
                {projectDraft.tags.length === 0 ? <span className="px-1 text-xs text-muted-foreground">Add tags</span> : projectDraft.tags.map((tag) => <span key={tag} className="flex items-center gap-1 rounded-full bg-primary/15 px-2 py-1 text-xs text-primary">{tag}<button type="button" onClick={(event) => { event.stopPropagation(); setProjectDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) })); }} aria-label={`Remove ${tag} tag`} className="rounded-full hover:text-foreground"><X size={12} /></button></span>)}
              </div>
              {tagsOpen && <div role="dialog" aria-label="Project tag options" className="absolute inset-x-0 top-full z-20 mt-2 rounded-lg border border-border bg-[#161b22] p-3 shadow-xl">
                <p className="mb-2 text-xs text-muted-foreground">Select a tag or create one</p>
                {availableTags.length > 0 ? <div className="flex flex-wrap gap-1.5">{availableTags.map((tag) => <button key={tag} type="button" onClick={() => setProjectDraft((current) => ({ ...current, tags: [...current.tags, tag] }))} className="rounded-full bg-accent px-2.5 py-1 text-xs hover:bg-[#30363d]">{tag}</button>)}</div> : <p className="text-xs text-muted-foreground">No saved tags yet.</p>}
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3"><input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} aria-label="Create project tag" maxLength={40} placeholder="Create a tag" className="h-8 !border-0 !bg-transparent px-0 text-xs !outline-none focus:!outline-none" /><button type="button" onClick={addTag} disabled={!tagInput.trim()} className="text-xs text-primary disabled:opacity-50">Add</button></div>
              </div>}
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
