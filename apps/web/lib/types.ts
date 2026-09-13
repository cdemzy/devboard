export const statuses = ["todo", "in_progress", "done"] as const;
export type Status = (typeof statuses)[number];
export type Priority = "low" | "medium" | "high";
export const statusLabels: Record<Status, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  done: "Done",
};
export type Project = {
  id: string;
  owner_id: string;
  name: string;
  ticket_prefix: string;
  description: string;
  tags: string[];
  archived: boolean;
  created_at: string;
  updated_at: string;
};
export type ProjectTag = {
  id: string;
  name: string;
  color: "green" | "yellow" | "purple" | "orange" | "blue" | "pink" | "red" | "brown";
};
export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  position: number;
  ticket_number: number;
  ticket_id: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
};
export type TaskInput = Pick<
  Task,
  "title" | "description" | "status" | "priority"
>;
