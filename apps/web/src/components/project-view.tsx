"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Archive,
  ArrowLeft,
  LayoutDashboard,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { api, json } from "@/lib/api";
import { moveTask } from "@/lib/board";
import type { Project, Status, Task } from "@/lib/types";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./ui/confirm-dialog";
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
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
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
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit project"
              disabled={busy}
              onClick={() => setEditProject(true)}
            >
              <Pencil size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                project.archived ? "Restore project" : "Archive project"
              }
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api(
                    `/projects/${project.id}`,
                    json("PATCH", { archived: !project.archived }),
                  );
                  await refresh();
                })
              }
            >
              {project.archived ? (
                <ArrowLeft size={15} />
              ) : (
                <Archive size={15} />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Delete project"
              disabled={busy}
              onClick={() => setConfirmProjectDelete(true)}
            >
              <Trash2 size={15} />
            </Button>
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
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {busy
              ? "Saving..."
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
        {loading ? (
          <p role="status" className="py-12 text-muted-foreground">
            Loading tasks...
          </p>
        ) : (
          <KanbanBoard
            tasks={tasks}
            disabled={busy || project.archived}
            edit={(task) => setEditor({ task })}
            remove={setTaskToDelete}
            create={(status) => setEditor({ status })}
            move={(...args) => void move(...args)}
          />
        )}
        <p className="pb-6 text-[11px] text-muted-foreground">
          {project.archived
            ? "Restore this project to change its tasks."
            : "Use the task handle to drag. With a keyboard, press Space, use arrow keys, then Space to drop."}
        </p>
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
          save={async (data) => {
            await api(
              editor.task
                ? `/tasks/${editor.task.id}`
                : `/projects/${project.id}/tasks`,
              json(editor.task ? "PATCH" : "POST", data),
            );
            await loadTasks().catch(() =>
              setError(
                "Changes were saved, but the board could not reload. Use Reload board to see the saved state.",
              ),
            );
          }}
          remove={
            editor.task
              ? async () => {
                  setTaskToDelete(editor.task!);
                  setEditor(null);
                }
              : undefined
          }
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
          await loadTasks();
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
