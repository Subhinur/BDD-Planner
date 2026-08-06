export type Status = "DRAFT" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  category: string | null;
  dueDate: string | null;
  progress: number;
  createdAt: string;
  updatedAt: string;
};

export const TASK_STORAGE_KEY = "desktopPlanner.tasks";
export const TASK_RECOVERY_STORAGE_KEY = "desktopPlanner.tasks.recovery";

export const statusToProgress: Record<Status, number> = {
  DRAFT: 0,
  IN_PROGRESS: 45,
  REVIEW: 85,
  DONE: 100
};

const statuses: Status[] = ["DRAFT", "IN_PROGRESS", "REVIEW", "DONE"];
const priorities: Priority[] = ["LOW", "MEDIUM", "HIGH"];
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric"
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value)) return false;
  const key = value.slice(0, 10);
  const parsed = new Date(`${key}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === key;
}

function isValidTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

export function normalizeTask(raw: unknown, now = new Date().toISOString()): Task | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id.trim()) return null;
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;
  if (typeof raw.status !== "string" || !statuses.includes(raw.status as Status)) return null;
  if (typeof raw.priority !== "string" || !priorities.includes(raw.priority as Priority)) return null;
  if (raw.dueDate !== null && raw.dueDate !== undefined && !isValidDate(raw.dueDate)) return null;

  const status = raw.status as Status;
  const progress = typeof raw.progress === "number" && Number.isFinite(raw.progress)
    ? Math.min(100, Math.max(0, raw.progress))
    : statusToProgress[status];

  return {
    id: raw.id.trim(),
    title: raw.title.trim(),
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description.trim() : null,
    status,
    priority: raw.priority as Priority,
    category: typeof raw.category === "string" && raw.category.trim() ? raw.category.trim() : "personal",
    dueDate: typeof raw.dueDate === "string" ? raw.dueDate.slice(0, 10) : null,
    progress,
    createdAt: isValidTimestamp(raw.createdAt) ? raw.createdAt as string : now,
    updatedAt: isValidTimestamp(raw.updatedAt) ? raw.updatedAt as string : now
  };
}

export type TaskLoadResult = {
  tasks: Task[];
  recovery: string | null;
  warning: string | null;
};

export function loadTasks(
  raw: string | null,
  createStarters: () => Task[],
  now = new Date().toISOString()
): TaskLoadResult {
  if (raw === null) {
    return { tasks: createStarters(), recovery: null, warning: null };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Task storage is not an array");

    const tasks = parsed.map((item) => normalizeTask(item, now));
    if (tasks.some((task) => task === null)) {
      return {
        tasks: tasks.filter((task): task is Task => task !== null),
        recovery: raw,
        warning: "Some saved tasks were invalid. The original data was copied to recovery storage."
      };
    }

    return { tasks: tasks as Task[], recovery: null, warning: null };
  } catch {
    return {
      tasks: [],
      recovery: raw,
      warning: "Saved tasks could not be read. The original data was copied to recovery storage."
    };
  }
}

export function parseStringList(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      : [];
  } catch {
    return [];
  }
}

type ReadableStorage = Pick<Storage, "getItem">;
type WritableStorage = Pick<Storage, "setItem">;

export function readValue(storage: ReadableStorage, key: string) {
  try {
    return { value: storage.getItem(key), error: null };
  } catch {
    return { value: null, error: "Saved data could not be read. Storage was left unchanged." };
  }
}

export function saveValue(storage: WritableStorage, key: string, value: string): string | null {
  try {
    storage.setItem(key, value);
    return null;
  } catch {
    return "Changes were not saved. Free device storage and try again.";
  }
}

export function saveTasks(storage: WritableStorage, tasks: Task[]): string | null {
  return saveValue(storage, TASK_STORAGE_KEY, JSON.stringify(tasks));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function taskDateKey(task: Task) {
  return task.dueDate ? task.dueDate.slice(0, 10) : "none";
}

function isOverdueAt(task: Task, now: Date) {
  if (!task.dueDate || task.status === "DONE") return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return new Date(`${taskDateKey(task)}T00:00:00`) < today;
}

function groupLabel(task: Task, now: Date) {
  if (!task.dueDate) return "No due date";
  const key = taskDateKey(task);
  const dateLabel = DATE_FORMATTER.format(new Date(`${key}T00:00:00`));
  if (isOverdueAt(task, now)) return `Overdue · ${dateLabel}`;
  if (key === localDateKey(now)) return "Today";
  if (key === localDateKey(addDays(now, 1))) return "Tomorrow";
  return dateLabel;
}

export function groupTasksByDate(tasks: Task[], now = new Date()) {
  const groups = new Map<string, { key: string; label: string; tasks: Task[] }>();

  tasks.forEach((task) => {
    const key = taskDateKey(task);
    const group = groups.get(key);
    if (group) {
      group.tasks.push(task);
    } else {
      groups.set(key, { key, label: groupLabel(task, now), tasks: [task] });
    }
  });

  return Array.from(groups.values());
}
