"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Status = "DRAFT" | "IN_PROGRESS" | "REVIEW" | "DONE";
type Priority = "LOW" | "MEDIUM" | "HIGH";

type Task = {
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

const columns: Array<{ id: Status; label: string; className: string }> = [
  { id: "DRAFT", label: "draft", className: "draft" },
  { id: "IN_PROGRESS", label: "in progress", className: "in-progress" },
  { id: "REVIEW", label: "review", className: "review" },
  { id: "DONE", label: "done", className: "done" }
];

const statusToProgress: Record<Status, number> = {
  DRAFT: 0,
  IN_PROGRESS: 45,
  REVIEW: 85,
  DONE: 100
};

const defaultTags = ["planning", "design", "errand", "home", "personal"];
const TASK_STORAGE_KEY = "desktopPlanner.tasks";
const TAG_STORAGE_KEY = "desktopPlanner.customTags";
const HIDDEN_TAG_STORAGE_KEY = "desktopPlanner.hiddenTags";
const THEME_STORAGE_KEY = "desktopPlanner.theme";
const FONT_SIZE_STORAGE_KEY = "desktopPlanner.fontSize";
const DETAILS_PANEL_STORAGE_KEY = "desktopPlanner.detailsPanel";
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", { weekday: "short" });

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toDateInput(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function taskDateKey(task: Task) {
  return task.dueDate ? toDateInput(task.dueDate) : "none";
}

function todayKey() {
  return localDateKey(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isOverdue(task: Task) {
  if (!task.dueDate || task.status === "DONE") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.dueDate.slice(0, 10)}T00:00:00`) < today;
}

function formatDate(value: string | null) {
  if (!value) return "No due date";
  return DATE_FORMATTER.format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function groupLabel(task: Task) {
  if (!task.dueDate) return "No due date";
  if (isOverdue(task)) return "Overdue";

  const key = taskDateKey(task);
  const currentToday = todayKey();
  if (key === currentToday) return "Today";
  if (key === localDateKey(addDays(new Date(), 1))) return "Tomorrow";
  return formatDate(task.dueDate);
}

function groupTasksByDate(tasks: Task[]) {
  const groups: Array<{ label: string; tasks: Task[] }> = [];

  tasks.forEach((task) => {
    const label = groupLabel(task);
    const group = groups.find((item) => item.label === label);
    if (group) {
      group.tasks.push(task);
    } else {
      groups.push({ label, tasks: [task] });
    }
  });

  return groups;
}

function normalizeTask(raw: unknown): Task | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Partial<Task>;
  if (!item.id || !item.title || !item.status || !item.priority) return null;
  if (!columns.some((column) => column.id === item.status)) return null;
  if (!["LOW", "MEDIUM", "HIGH"].includes(item.priority)) return null;

  return {
    id: item.id,
    title: item.title,
    description: item.description || null,
    status: item.status,
    priority: item.priority,
    category: item.category || "personal",
    dueDate: item.dueDate || null,
    progress: Number.isFinite(item.progress) ? Number(item.progress) : statusToProgress[item.status],
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString()
  };
}

function starterTasks(): Task[] {
  const now = new Date().toISOString();
  const today = todayKey();
  const tomorrow = localDateKey(addDays(new Date(), 1));
  const nextWeek = localDateKey(addDays(new Date(), 6));

  return [
    {
      id: uid(),
      title: "Plan the week",
      description: "Pick the top priorities and block focus time.",
      status: "IN_PROGRESS",
      priority: "HIGH",
      category: "planning",
      dueDate: today,
      progress: 45,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uid(),
      title: "Review open errands",
      description: "Clear the quick wins before lunch.",
      status: "DRAFT",
      priority: "MEDIUM",
      category: "errand",
      dueDate: tomorrow,
      progress: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uid(),
      title: "Sketch next workspace tweak",
      description: "Capture ideas before deciding what to build.",
      status: "REVIEW",
      priority: "LOW",
      category: "design",
      dueDate: nextWeek,
      progress: 85,
      createdAt: now,
      updatedAt: now
    }
  ];
}

export function DashboardClient() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksReady, setTasksReady] = useState(false);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [hiddenTags, setHiddenTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fontSize, setFontSize] = useState(16);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "done" | "overdue">("all");
  const [selectedDate, setSelectedDate] = useState("all");
  const [dateWindowStart, setDateWindowStart] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const tagOptions = useMemo(() => {
    const taskTags = tasks.map((task) => task.category || "personal");
    const editingTag = editingTask?.category ? [editingTask.category] : [];
    return Array.from(new Set([...defaultTags, ...taskTags, ...customTags, ...editingTag]))
      .filter((tag) => tag === editingTask?.category || !hiddenTags.includes(tag))
      .sort();
  }, [customTags, editingTask?.category, hiddenTags, tasks]);

  useEffect(() => {
    try {
      const storedTasks = JSON.parse(localStorage.getItem(TASK_STORAGE_KEY) || "null");
      const normalizedTasks = Array.isArray(storedTasks)
        ? storedTasks.map(normalizeTask).filter((task): task is Task => Boolean(task))
        : [];
      setTasks(normalizedTasks.length ? normalizedTasks : starterTasks());

      const storedTags = JSON.parse(localStorage.getItem(TAG_STORAGE_KEY) || "[]");
      if (Array.isArray(storedTags)) {
        setCustomTags(storedTags.filter((tag) => typeof tag === "string"));
      }

      const storedHiddenTags = JSON.parse(localStorage.getItem(HIDDEN_TAG_STORAGE_KEY) || "[]");
      if (Array.isArray(storedHiddenTags)) {
        setHiddenTags(storedHiddenTags.filter((tag) => typeof tag === "string"));
      }
    } catch {
      setTasks(starterTasks());
      setCustomTags([]);
      setHiddenTags([]);
    } finally {
      setTasksReady(true);
    }
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "dark" || storedTheme === "light") {
      setTheme(storedTheme);
    }

    const storedFontSize = Number(localStorage.getItem(FONT_SIZE_STORAGE_KEY));
    if (Number.isFinite(storedFontSize) && storedFontSize >= 14 && storedFontSize <= 20) {
      setFontSize(storedFontSize);
    }

    const storedDetailsPanel = localStorage.getItem(DETAILS_PANEL_STORAGE_KEY);
    if (storedDetailsPanel === "open" || storedDetailsPanel === "closed") {
      setDetailsOpen(storedDetailsPanel === "open");
    }
  }, []);

  useEffect(() => {
    if (!tasksReady) return;
    localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks, tasksReady]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(DETAILS_PANEL_STORAGE_KEY, detailsOpen ? "open" : "closed");
  }, [detailsOpen]);

  useEffect(() => {
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(customTags));
  }, [customTags]);

  useEffect(() => {
    localStorage.setItem(HIDDEN_TAG_STORAGE_KEY, JSON.stringify(hiddenTags));
  }, [hiddenTags]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "active") return task.status !== "DONE";
      if (filter === "done") return task.status === "DONE";
      if (filter === "overdue") return isOverdue(task);
      return true;
    });
  }, [filter, tasks]);

  const allDateTabs = useMemo(() => {
    const counts = new Map<string, number>();
    visibleTasks.forEach((task) => {
      if (!task.dueDate) return;
      const key = taskDateKey(task);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    if (!counts.has(todayKey())) {
      counts.set(todayKey(), 0);
    }

    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, count]) => {
        const date = new Date(`${key}T00:00:00`);
        const dayLabel = key === todayKey() ? "Today" : DAY_FORMATTER.format(date);
        const dateLabel = key === localDateKey(addDays(new Date(), 1)) ? "Tomorrow" : DATE_FORMATTER.format(date);

        return {
          key,
          day: dayLabel,
          date: dateLabel,
          count
        };
      });
  }, [visibleTasks]);

  const maxDateWindowStart = Math.max(allDateTabs.length - 7, 0);
  const dateTabs = allDateTabs.slice(dateWindowStart, dateWindowStart + 7);

  useEffect(() => {
    if (dateWindowStart > maxDateWindowStart) {
      setDateWindowStart(maxDateWindowStart);
    }
  }, [dateWindowStart, maxDateWindowStart]);

  useEffect(() => {
    if (selectedDate !== "all" && !allDateTabs.some((tab) => tab.key === selectedDate)) {
      setSelectedDate("all");
    }
  }, [allDateTabs, selectedDate]);

  useEffect(() => {
    if (selectedDate === "all") return;
    const index = allDateTabs.findIndex((tab) => tab.key === selectedDate);
    if (index < 0) return;
    if (index < dateWindowStart) {
      setDateWindowStart(index);
    } else if (index >= dateWindowStart + 7) {
      setDateWindowStart(Math.min(index - 6, maxDateWindowStart));
    }
  }, [allDateTabs, dateWindowStart, maxDateWindowStart, selectedDate]);

  const selectedDateLabel = useMemo(() => {
    if (selectedDate === "all") return "all dates";
    return allDateTabs.find((tab) => tab.key === selectedDate)?.date || "selected date";
  }, [allDateTabs, selectedDate]);

  const selectedTasks = useMemo(() => {
    if (selectedDate === "all") return visibleTasks;
    return visibleTasks.filter((task) => taskDateKey(task) === selectedDate);
  }, [selectedDate, visibleTasks]);

  const denseMode = selectedTasks.length >= 12;
  const doneCount = selectedTasks.filter((task) => task.status === "DONE").length;
  const activeCount = selectedTasks.filter((task) => task.status !== "DONE").length;
  const inProgressCount = selectedTasks.filter((task) => task.status === "IN_PROGRESS").length;
  const overdueCount = selectedTasks.filter(isOverdue).length;
  const highPriorityCount = selectedTasks.filter((task) => task.priority === "HIGH").length;
  const onTrack = selectedTasks.length
    ? Math.round((selectedTasks.filter((task) => !isOverdue(task)).length / selectedTasks.length) * 100)
    : 100;

  function createOrUpdateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") || "").trim();

    if (!title) {
      setError("Task title is required.");
      return;
    }

    const status = String(form.get("status") || "DRAFT") as Status;
    const now = new Date().toISOString();
    const payload = {
      title,
      description: String(form.get("description") || "").trim() || null,
      status,
      priority: String(form.get("priority") || "MEDIUM") as Priority,
      category: String(form.get("category") || "personal"),
      dueDate: String(form.get("dueDate") || "") || null,
      progress: Number(form.get("progress") || statusToProgress[status])
    };

    setTasks((current) => {
      if (!editingTask) {
        return [
          ...current,
          {
            id: uid(),
            ...payload,
            createdAt: now,
            updatedAt: now
          }
        ];
      }

      return current.map((task) => task.id === editingTask.id ? { ...task, ...payload, updatedAt: now } : task);
    });

    setModalOpen(false);
    setEditingTask(null);
  }

  function updateTask(taskId: string, body: Partial<Task>) {
    setError("");
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, ...body, updatedAt: new Date().toISOString() } : task));
  }

  function deleteTask(taskId: string) {
    setError("");
    setTasks((current) => current.filter((task) => task.id !== taskId));
  }

  function toggleFinished(task: Task, finished: boolean) {
    updateTask(task.id, {
      status: finished ? "DONE" : "IN_PROGRESS",
      progress: finished ? 100 : Math.max(task.progress || 45, 45)
    });
  }

  function openCreateModal() {
    setEditingTask(null);
    setError("");
    setModalOpen(true);
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setError("");
    setModalOpen(true);
  }

  function addTag() {
    const tag = newTag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!tag) return;
    setCustomTags((current) => Array.from(new Set([...current, tag])));
    setHiddenTags((current) => current.filter((item) => item !== tag));
    setNewTag("");
  }

  function deleteTag(tag: string) {
    setCustomTags((current) => current.filter((item) => item !== tag));
    setHiddenTags((current) => Array.from(new Set([...current, tag])));
  }

  function clearCompleted() {
    setTasks((current) => current.filter((task) => task.status !== "DONE"));
  }

  return (
    <>
      <header className="topbar">
        <div className="breadcrumb">
          <span className="crumb-icon" aria-hidden="true">P</span>
          <span>Planner &gt; Today</span>
        </div>
        <div className="top-actions">
          <button
            className={`theme-toggle ${theme === "dark" ? "active" : ""}`}
            type="button"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"}
            aria-label="Toggle dark mode"
          >
            <span />
            <b>{theme}</b>
          </button>
          <label className="font-control">
            <span>Text</span>
            <input
              aria-label="Text size"
              type="range"
              min="14"
              max="20"
              step="1"
              value={fontSize}
              onChange={(event) => setFontSize(Number(event.target.value))}
            />
            <b>{fontSize}</b>
          </label>
          <button
            className={`button details-toggle ${detailsOpen ? "active" : ""}`}
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-pressed={detailsOpen}
          >
            details
          </button>
          <button className="button primary" type="button" onClick={openCreateModal}>+ add task</button>
        </div>
      </header>

      <main className={`layout ${detailsOpen ? "" : "details-closed"} ${denseMode ? "dense" : ""}`}>
        <section className="board-area" aria-label="Task board">
          <div className="board-header">
            <div>
              <h1 className="board-title">Desktop task board</h1>
              <div className="board-meta">{selectedTasks.length} tasks - stored on this device</div>
            </div>
            <nav className="filter-pills" aria-label="Board filters">
              {(["all", "active", "done", "overdue"] as const).map((item) => (
                <button
                  key={item}
                  className={`filter-pill ${filter === item ? "active" : ""}`}
                  type="button"
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}
            </nav>
          </div>

          <nav className="day-slider" aria-label="Task dates">
            <button
              className="day-nav"
              type="button"
              onClick={() => setDateWindowStart((current) => Math.max(current - 1, 0))}
              disabled={dateWindowStart === 0}
              aria-label="Previous dates"
            >
              &lt;
            </button>
            <div className="day-tabs">
              <button
                className={`day-tab all ${selectedDate === "all" ? "active" : ""}`}
                type="button"
                onClick={() => setSelectedDate("all")}
              >
                <span>All</span>
                <strong>{visibleTasks.length}</strong>
              </button>
              {dateTabs.map((tab) => (
                <button
                  className={`day-tab ${selectedDate === tab.key ? "active" : ""}`}
                  type="button"
                  key={tab.key}
                  onClick={() => setSelectedDate(tab.key)}
                >
                  <span>{tab.day}</span>
                  <b>{tab.date}</b>
                  <strong>{tab.count}</strong>
                </button>
              ))}
            </div>
            <button
              className="day-nav"
              type="button"
              onClick={() => setDateWindowStart((current) => Math.min(current + 1, maxDateWindowStart))}
              disabled={dateWindowStart >= maxDateWindowStart}
              aria-label="Next dates"
            >
              &gt;
            </button>
          </nav>

          {error ? <p className="form-error board-error">{error}</p> : null}

          {selectedTasks.length === 0 ? (
            <div className="board-empty">
              <strong>No tasks for {selectedDateLabel}</strong>
              <span>Select another day or add a task with this due date.</span>
              <button className="button primary" type="button" onClick={openCreateModal}>+ add task</button>
            </div>
          ) : (
            <div className="kanban">
              {columns.map((column) => {
                const columnTasks = selectedTasks.filter((task) => task.status === column.id);
                const taskGroups = groupTasksByDate(columnTasks);
                return (
                  <section
                    className="column"
                    data-status={column.id}
                    key={column.id}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (draggedId) {
                        updateTask(draggedId, { status: column.id, progress: statusToProgress[column.id] });
                        setDraggedId(null);
                      }
                    }}
                  >
                    <header className="column-header">
                      <span className={`status-dot ${column.className}`} />
                      <span className="column-name">{column.label}</span>
                      <span className="count-pill">{columnTasks.length}</span>
                    </header>
                    <div className="card-list">
                      {taskGroups.length ? taskGroups.map((group) => (
                        <div className="task-group" key={`${column.id}-${group.label}`}>
                          <div className="task-group-header">
                            <span>{group.label}</span>
                            <b>{group.tasks.length}</b>
                          </div>
                          {group.tasks.map((task) => (
                            <article
                              className={`task-card ${task.status === "DONE" ? "done" : ""}`}
                              draggable
                              key={task.id}
                              onDragStart={() => setDraggedId(task.id)}
                              onDragEnd={() => setDraggedId(null)}
                              onDoubleClick={() => openEditModal(task)}
                            >
                              <div className="card-top">
                                <label className="finish-check" aria-label={`Mark ${task.title} as finished`}>
                                  <input
                                    type="checkbox"
                                    checked={task.status === "DONE"}
                                    onChange={(event) => toggleFinished(task, event.target.checked)}
                                    onClick={(event) => event.stopPropagation()}
                                  />
                                  <span aria-hidden="true" />
                                </label>
                                <h3 className="task-title"><span className="done-check">done </span>{task.title}</h3>
                                <span className={`priority-dot ${task.priority.toLowerCase()}`} />
                              </div>
                              <p className="task-description">{task.description || "No description"}</p>
                              <div className="tags"><span className={`tag ${(task.category || "personal").toLowerCase()}`}>{task.category || "personal"}</span></div>
                              <div className="card-bottom">
                                <span className="due">{formatDate(task.dueDate)}</span>
                              </div>
                              {task.status === "IN_PROGRESS" ? <div className="card-progress"><span style={{ width: `${task.progress}%` }} /></div> : null}
                              <div className="card-actions">
                                <button className="text-button" type="button" onClick={() => openEditModal(task)}>edit</button>
                                <button className="text-button danger" type="button" onClick={() => deleteTask(task.id)}>delete</button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )) : <div className="empty-column">No tasks in {column.label}</div>}
                    </div>
                    <button className="add-card" type="button" onClick={openCreateModal}>+ add card</button>
                  </section>
                );
              })}
            </div>
          )}
        </section>

        <aside className="right-panel" aria-label="Planner details">
          <section className="panel-section">
            <h2 className="panel-title">Local summary</h2>
            <article className="profile-card">
              <div className="stat-grid">
                <div className="stat-cell"><strong>{activeCount}</strong><span>active</span></div>
                <div className="stat-cell"><strong>{doneCount}</strong><span>done</span></div>
                <div className="stat-cell"><strong>{inProgressCount}</strong><span>in progress</span></div>
                <div className="stat-cell"><strong>{onTrack}%</strong><span>on-track</span></div>
              </div>
            </article>
          </section>

          <section className="panel-section">
            <h2 className="panel-title">Today's plan</h2>
            <div className="plan-list">
              {tasks.filter((task) => taskDateKey(task) === todayKey()).slice(0, 4).map((task, index) => (
                <div className="plan-row" key={task.id}>
                  <span className="plan-time">{index === 0 ? "09:00" : index === 1 ? "11:30" : index === 2 ? "14:00" : "16:00"}</span>
                  <div className={`plan-card ${index % 2 ? "teal" : "purple"}`}>
                    <strong>{task.title}</strong>
                    <span>{task.status.toLowerCase().replace("_", " ")}</span>
                  </div>
                </div>
              ))}
              {tasks.every((task) => taskDateKey(task) !== todayKey()) ? (
                <div className="empty-column">Nothing due today</div>
              ) : null}
            </div>
          </section>

          <section className="panel-section">
            <h2 className="panel-title">Task stats</h2>
            <div className="profile-card compact">
              <div className="stat-grid">
                <div className="stat-cell"><strong>{overdueCount}</strong><span>overdue</span></div>
                <div className="stat-cell"><strong>{highPriorityCount}</strong><span>high priority</span></div>
              </div>
              <button className="button wide-button" type="button" onClick={clearCompleted} disabled={!tasks.some((task) => task.status === "DONE")}>
                clear completed
              </button>
            </div>
          </section>
        </aside>
      </main>

      {modalOpen ? (
        <div className="modal-shell open" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <h2 className="modal-title">{editingTask ? "Edit task" : "Add task"}</h2>
              <button className="button" type="button" onClick={() => setModalOpen(false)}>close</button>
            </div>
            <form className="modal-form" onSubmit={createOrUpdateTask}>
              <label className="field">
                <span className="field-label">Task title</span>
                <input name="title" type="text" placeholder="e.g. Submit vendor quote" defaultValue={editingTask?.title || ""} required />
              </label>
              <label className="field">
                <span className="field-label">Description</span>
                <input name="description" type="text" placeholder="Add helpful notes or context" defaultValue={editingTask?.description || ""} />
              </label>
              <div className="tag-manager">
                <label className="field-label">Tag</label>
                <select name="category" defaultValue={editingTask?.category || tagOptions[0] || "personal"}>
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
                <div className="tag-tools" aria-label="Add custom tag">
                  <label className="field">
                    <span className="field-label">New tag</span>
                    <input
                      value={newTag}
                      onChange={(event) => setNewTag(event.target.value)}
                      placeholder="e.g. tender"
                    />
                  </label>
                  <button className="button" type="button" onClick={addTag}>add tag</button>
                </div>
                <div className="tag-list" aria-label="Custom tags">
                  {tagOptions.length ? tagOptions.map((tag) => (
                    <span className="tag-edit" key={tag}>
                      {tag}
                      <button type="button" onClick={() => deleteTag(tag)} aria-label={`Delete ${tag} tag`}>x</button>
                    </span>
                  )) : <span className="tag-empty">No custom tags yet</span>}
                </div>
              </div>
              <div className="modal-grid">
                <label className="field">
                  <span className="field-label">Priority</span>
                  <select name="priority" defaultValue={editingTask?.priority || "MEDIUM"}>
                    <option value="LOW">low</option>
                    <option value="MEDIUM">medium</option>
                    <option value="HIGH">high</option>
                  </select>
                </label>
              </div>
              <div className="modal-grid">
                <label className="field">
                  <span className="field-label">Status</span>
                  <select name="status" defaultValue={editingTask?.status || "DRAFT"}>
                    <option value="DRAFT">draft</option>
                    <option value="IN_PROGRESS">in progress</option>
                    <option value="REVIEW">review</option>
                    <option value="DONE">done</option>
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Due date</span>
                  <input name="dueDate" type="date" defaultValue={toDateInput(editingTask?.dueDate || null)} />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Progress percent</span>
                <input name="progress" type="number" min="0" max="100" defaultValue={editingTask?.progress || 0} />
              </label>
              {error ? <p className="form-error">{error}</p> : null}
              <div className="modal-actions">
                <button className="button" type="button" onClick={() => setModalOpen(false)}>cancel</button>
                <button className="button primary" type="submit">{editingTask ? "save task" : "create task"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
