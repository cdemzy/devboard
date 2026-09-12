"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const [archivedTasksOpen, setArchivedTasksOpen] = useState(false);
  const [archivedTasksLoading, setArchivedTasksLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState("Saving...");
  const moving = useRef(false);
  const [error, setError] = useState("");
  const [editProject, setEditProject] = useState(false);
  const [editor, setEditor] = useState<{ task?: Task; status?: Status } | null>(
    null,
  );
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [confirmProjectDelete, setConfirmProjectDelete] = useState(false);
  const loadTasks = useCallback(async () => {
    const result = await api<Task[]>(`/projects/${project.id}/tasks`);
    setTasks(result);
  }, [project.id]);
  const loadArchivedTasks = useCallback(async () => {
    setArchivedTasksLoading(true);
    try {
      setArchivedTasks(await api<Task[]>(`/projects/${project.id}/tasks?archived=true`));
    } finally {
      setArchivedTasksLoading(false);
    }
  }, [project.id]);
  useEffect(() => {
    let alive = true;
    api<Task[]>(`/projects/${project.id}/tasks`)
      .then((result) => {
        if (alive) setTasks(result);
      })
      .catch((error) => {
        if (alive)
          setError(
            error instanceof Error ? error.message : "Unable to load tasks.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project.id]);
  async function action(
    work: () => Promise<void>,
    label = "Saving...",
    successMessage?: string,
  ) {
    setBusy(true);
    setActivity(label);
    setError("");
    try {
      await work();
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function move(id: string, status: Status, position: number) {
    if (moving.current || busy) return;
    moving.current = true;
    setBusy(true);
    setActivity("Moving...");
    setError("");
    const previous = tasks;
    setTasks(moveTask(tasks, id, status, position));
    try {
      setTasks(
        await api<Task[]>(
          `/tasks/${id}/move`,
          json("POST", { status, position }),
        ),
      );
    } catch (error) {
      setTasks(previous);
      setError(
        `${error instanceof Error ? error.message : "Move failed."} The board has been restored; retry or reload to check saved state.`,
      );
    } finally {
      moving.current = false;
      setBusy(false);
    }
  }
  function archiveTask(task: Task) {
    void action(async () => {
      await api(`/tasks/${task.id}/archive`, json("POST"));
      await loadTasks();
      if (archivedTasksOpen) await loadArchivedTasks();
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
        <span>Workspace</span>
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
        <div className="mb-5 flex items-center justify-between border-b border-border pb-3">
          <span className="flex items-center gap-2 text-xs font-medium">
            <LayoutDashboard size={14} className="text-primary" />
            Board
          </span>
          <Tooltip label="Archived tasks"><Button variant="ghost" size="sm" disabled={busy} onClick={() => { const nextOpen = !archivedTasksOpen; setArchivedTasksOpen(nextOpen); if (nextOpen) void loadArchivedTasks(); }}><Archive size={14} />Archived tasks</Button></Tooltip>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {busy
              ? activity
              : `${tasks.length} tasks · ${completed} completed`}
          </span>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-rose-900 bg-rose-950/20 p-3 text-sm text-rose-200"
          >
            {error}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void action(loadTasks)}
            >
              Reload board
            </Button>
          </div>
        )}
        {archivedTasksOpen && <section className="mb-5 rounded-lg border border-border bg-[#161b22] p-3"><div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Archive size={15} className="text-muted-foreground" />Archived tasks</h2><Button variant="ghost" size="sm" onClick={() => setArchivedTasksOpen(false)}>Close</Button></div>{archivedTasksLoading ? <p className="text-sm text-muted-foreground">Loading archived tasks…</p> : archivedTasks.length === 0 ? <p className="text-sm text-muted-foreground">No archived tasks.</p> : <div className="space-y-2">{archivedTasks.map((task) => <div key={task.id} className="flex items-center gap-3 rounded-md border border-border bg-background p-3"><div className="min-w-0 flex-1"><span className="text-xs font-medium text-primary">{task.ticket_id}</span><p className="truncate text-sm font-medium">{task.title}</p></div><Tooltip label="Restore"><Button variant="ghost" size="icon" aria-label={`Restore ${task.ticket_id}`} disabled={busy || project.archived} onClick={() => restoreTask(task)}><RotateCcw size={15} /></Button></Tooltip><Tooltip label="Delete permanently"><Button variant="ghost" size="icon" aria-label={`Delete ${task.ticket_id}`} disabled={busy} className="text-rose-300" onClick={() => setTaskToDelete(task)}><Trash2 size={15} /></Button></Tooltip></div>)}</div>}</section>}
        {loading ? (
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
        )}
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
            await loadTasks().catch(() =>
              setError(
                "Changes were saved, but the board could not reload. Use Reload board to see the saved state.",
              ),
            );
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
