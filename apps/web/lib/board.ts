import { statuses, type Status, type Task } from "./types";
export function columnTasks(tasks: Task[], status: Status): Task[] {
  return tasks
    .filter((task) => task.status === status)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}
export function moveTask(
  tasks: Task[],
  id: string,
  status: Status,
  position: number,
): Task[] {
  const task = tasks.find((item) => item.id === id);
  if (!task) return tasks;
  const remaining = tasks.filter((item) => item.id !== id);
  const target = columnTasks(remaining, status);
  target.splice(Math.max(0, Math.min(position, target.length)), 0, {
    ...task,
    status,
  });
  return statuses.flatMap((column) =>
    (column === status ? target : columnTasks(remaining, column)).map(
      (item, index) => ({ ...item, position: index }),
    ),
  );
}
