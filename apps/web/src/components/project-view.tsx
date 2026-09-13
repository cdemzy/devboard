"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  Archive,
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api, json } from "@/lib/api";
import { moveTask } from "@/lib/board";
import type { Project, Status, Task } from "@/lib/types";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
import { Tooltip } from "./ui/tooltip";
import { SectionLoader } from "./ui/section-loader";
import { ProjectEditor, TaskEditor } from "./editors";
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
  const [editProject, setEditProject] = useState(false);
  const [editor, setEditor] = useState<{ task?: Task; status?: Status } | null>(
    null,
  );
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
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
  return (
    <>
      <div className="flex min-h-14 items-center gap-2 border-b border-border px-6 text-xs text-muted-foreground">
        <span>Projects</span>
        <span className="mx-1">/</span>
        <span className="truncate text-foreground">{project.name}</span>
        {project.archived && (
          <span className="ml-2 rounded bg-accent px-2 py-1">Archived</span>
        )}
      </div>
      <div className="px-5 pt-8 md:px-8">
        <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-semibold tracking-tight">
              {project.name}
            </h1>
            {project.description && (
              <p className="mt-2 max-w-2xl whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Tooltip label="Edit">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit project"
                disabled={busy}
                onClick={() => setEditProject(true)}
              >
                <Pencil size={15} />
              </Button>
            </Tooltip>
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
        <div className="mb-5 flex items-center border-b border-border pb-3"><div className="flex items-center gap-1 rounded-full bg-accent p-1"><button onClick={() => setView("board")} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === "board" ? "bg-[#30363d] text-foreground shadow-sm" : "text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground"}`}><LayoutDashboard size={14} className={view === "board" ? "text-primary" : ""} />Board</button><button onClick={() => { setView("archived"); void loadArchivedTasks(); }} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${view === "archived" ? "bg-[#30363d] text-foreground shadow-sm" : "text-muted-foreground hover:bg-[#30363d]/70 hover:text-foreground"}`}><Archive size={14} />Archived tasks</button></div>{view === "board" && <span className="ml-auto text-xs text-muted-foreground">{`${tasks.length} tasks · ${completed} completed`}</span>}</div>
        {view === "archived" && <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="rounded-lg border border-border bg-[#161b22] p-4">{archivedTasksLoading ? <p className="text-sm text-muted-foreground">Loading archived tasks…</p> : archivedTasks.length === 0 ? <p className="text-sm text-muted-foreground">No archived tasks.</p> : <div className="space-y-2">{archivedTasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-3"><div className="min-w-0 flex-1"><span className="text-xs font-medium text-primary">{task.ticket_id}</span><p className="truncate text-sm font-medium">{task.title}</p></div><Tooltip label="Restore"><Button variant="ghost" size="icon" aria-label={`Restore ${task.ticket_id}`} disabled={busy || project.archived} onClick={() => restoreTask(task)}><RotateCcw size={15} /></Button></Tooltip><Tooltip label="Delete permanently"><Button variant="ghost" size="icon" aria-label={`Delete ${task.ticket_id}`} disabled={busy} className="text-rose-300" onClick={() => setTaskToDelete(task)}><Trash2 size={15} /></Button></Tooltip></div>)}</div>}</motion.section>}
        {view === "board" && (loading ? (
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
        ))}
        {project.archived && <p className="pb-6 text-[11px] text-muted-foreground">Restore this project to change its tasks.</p>}
      </div>
      {editProject && (
        <ProjectEditor
          project={project}
          close={() => setEditProject(false)}
          save={async (data) => {
            update(
              await api<Project>(
                `/projects/${project.id}`,
                json("PATCH", data),
              ),
            );
          }}
        />
      )}
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
