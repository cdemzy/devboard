"use client";
import { useState } from "react";
import { Check, Minimize2, Trash2, X } from "lucide-react";
import type { Project, Task, TaskInput, Status, Priority } from "@/lib/types";
import { statusLabels, statuses } from "@/lib/types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
export function ProjectEditor({
  project,
  close,
  save,
}: {
  project?: Project;
  close: () => void;
  save: (data: { name: string; description: string }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent>
        <DialogTitle className="text-lg font-semibold">
          {project ? "Edit project" : "New project"}
        </DialogTitle>
        <DialogDescription className="mb-6 mt-1 text-sm text-muted-foreground">
          Give your work a place to take shape.
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const name = String(form.get("name")).trim();
            if (!name) {
              setError("Enter a project name.");
              return;
            }
            setBusy(true);
            setError("");
            try {
              await save({
                name,
                description: String(form.get("description")),
              });
              close();
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "Unable to save.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Project name
            <input
              name="name"
              defaultValue={project?.name}
              required
              maxLength={120}
              placeholder="e.g. Developer portal"
              autoFocus
            />
          </label>
          <label>
            Description{" "}
            <textarea
              name="description"
              defaultValue={project?.description}
              maxLength={10000}
              placeholder="What are you building? (optional)"
            />
          </label>
          {error && (
            <p role="alert" className="text-rose-300">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button disabled={busy}>
              {busy ? "Saving…" : project ? "Save changes" : "Create project"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function TaskEditor({
  task,
  initialStatus = "todo",
  close,
  save,
  remove,
}: {
  task?: Task;
  initialStatus?: Status;
  close: () => void;
  save: (data: TaskInput) => Promise<void>;
  remove?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
      close();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
    >
      <DialogContent hideClose className="h-[80vh] w-[80vw] max-w-none">
        <DialogTitle className="text-lg font-semibold">
          {task ? "Task details" : "New task"}
        </DialogTitle>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4"
          onClick={close}
          disabled={busy}
          aria-label="Minimize task"
          title="Minimize task"
        >
          <Minimize2 size={16} />
        </Button>
        <DialogDescription className="mb-6 mt-1 text-sm text-muted-foreground">
          {task
            ? "Update the details and keep work moving."
            : "Start with a clear next step."}
        </DialogDescription>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const title = String(form.get("title")).trim();
            if (!title) {
              setError("Enter a task title.");
              return;
            }
            void run(() =>
              save({
                title,
                description: String(form.get("description")),
                status: form.get("status") as Status,
                priority: form.get("priority") as Priority,
              }),
            );
          }}
        >
          <label>
            Title
            <input
              name="title"
              defaultValue={task?.title}
              required
              maxLength={240}
              autoFocus
              placeholder="What needs to happen?"
            />
          </label>
          <label>
            Description
            <textarea
              name="description"
              defaultValue={task?.description}
              maxLength={10000}
              placeholder="Details, context, or acceptance criteria…"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label>
              Status
              <select
                name="status"
                defaultValue={task?.status ?? initialStatus}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Priority
              <select name="priority" defaultValue={task?.priority ?? "medium"}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          {task && (
            <p className="text-xs text-muted-foreground">
              Created {new Date(task.created_at).toLocaleDateString()} · Updated{" "}
              {new Date(task.updated_at).toLocaleDateString()}
            </p>
          )}
          {error && (
            <p role="alert" className="text-rose-300">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between pt-2">
            {remove ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-rose-300"
                disabled={busy}
                onClick={() => void remove()}
                aria-label="Delete task"
                title="Delete task"
              >
                <Trash2 size={15} />
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={close}
                disabled={busy}
                aria-label="Cancel"
                title="Cancel"
              >
                <X size={16} />
              </Button>
              <Button
                size="icon"
                disabled={busy}
                aria-label={task ? "Save changes" : "Create task"}
                title={task ? "Save changes" : "Create task"}
              >
                <Check size={16} />
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
