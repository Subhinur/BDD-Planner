import assert from "node:assert/strict";
import test from "node:test";

import {
  groupTasksByDate,
  loadTasks,
  normalizeTask,
  parseStringList,
  readValue,
  saveTasks,
  saveValue,
  type Task
} from "../src/lib/planner";

const NOW = "2026-08-06T00:00:00.000Z";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    title: "Keep me",
    description: null,
    status: "DRAFT",
    priority: "MEDIUM",
    category: "personal",
    dueDate: "2027-09-01",
    progress: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  };
}

test("a stored empty task list remains empty", () => {
  const result = loadTasks("[]", () => [task()], NOW);

  assert.deepEqual(result.tasks, []);
  assert.equal(result.recovery, null);
});

test("a missing task key receives starter tasks", () => {
  const starters = [task()];
  const result = loadTasks(null, () => starters, NOW);

  assert.deepEqual(result.tasks, starters);
  assert.equal(result.recovery, null);
});

test("malformed task JSON is quarantined instead of silently replaced", () => {
  const result = loadTasks("{broken", () => [task()], NOW);

  assert.deepEqual(result.tasks, []);
  assert.equal(result.recovery, "{broken");
  assert.match(result.warning || "", /recovery/i);
});

test("a malformed tag list is isolated from task loading", () => {
  const rawTasks = JSON.stringify([task()]);

  assert.deepEqual(parseStringList("{broken"), []);
  assert.deepEqual(loadTasks(rawTasks, () => [], NOW).tasks, [task()]);
});

test("normalization rejects a non-string due date", () => {
  assert.equal(normalizeTask({ ...task(), dueDate: { bad: true } }, NOW), null);
});

test("normalization sanitizes optional fields and clamps progress", () => {
  const normalized = normalizeTask({
    ...task(),
    description: 42,
    category: {},
    progress: 250,
    createdAt: "bad-date"
  }, NOW);

  assert.deepEqual(normalized, {
    ...task(),
    description: null,
    category: "personal",
    progress: 100,
    createdAt: NOW
  });
});

test("tasks on the same month and day in different years stay separate", () => {
  const groups = groupTasksByDate([
    task({ id: "2027", dueDate: "2027-09-01" }),
    task({ id: "2028", dueDate: "2028-09-01" })
  ], new Date("2026-08-06T12:00:00"));

  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.key), ["2027-09-01", "2028-09-01"]);
  assert.match(groups[0].label, /2027/);
  assert.match(groups[1].label, /2028/);
});

test("storage write failures return an actionable error", () => {
  const storage = {
    setItem() {
      throw new Error("quota exceeded");
    }
  };

  assert.match(saveTasks(storage, [task()]) || "", /not saved/i);
});

test("preference write failures are reported without throwing", () => {
  const values = new Map<string, string>();
  const workingStorage = { setItem: (key: string, value: string) => values.set(key, value) };
  const failingStorage = { setItem: () => { throw new Error("blocked"); } };

  assert.equal(saveValue(workingStorage, "theme", "dark"), null);
  assert.equal(values.get("theme"), "dark");
  assert.match(saveValue(failingStorage, "theme", "dark") || "", /not saved/i);
});

test("storage read failures are reported without inventing missing data", () => {
  const storage = { getItem: () => { throw new Error("blocked"); } };
  const result = readValue(storage, "tasks");

  assert.equal(result.value, null);
  assert.match(result.error || "", /could not be read/i);
});
