/**
 * Task store for multi-agent coordination
 *
 * Module-level state management for tasks with reactive subscriptions.
 */

import type {
  Task,
  TaskStatus,
  TaskCreateOptions,
  TaskUpdateOptions,
  TaskStoreListener,
} from './types.js';

/** Module-level task storage */
const tasks = new Map<string, Task>();

/** Listeners for task updates */
const listeners = new Set<TaskStoreListener>();

/** Counter for generating unique task IDs */
let taskIdCounter = 0;

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  taskIdCounter++;
  return String(taskIdCounter);
}

/**
 * Get current ISO timestamp
 */
function now(): string {
  return new Date().toISOString();
}

/**
 * Notify all listeners of task changes
 */
function notifyListeners(): void {
  const allTasks = getAllTasks();
  for (const listener of listeners) {
    listener(allTasks);
  }
}

/**
 * Create a new task
 */
export function createTask(options: TaskCreateOptions): Task {
  const id = generateTaskId();
  const timestamp = now();

  const task: Task = {
    id,
    subject: options.subject,
    description: options.description,
    activeForm: options.activeForm,
    status: 'pending',
    blocks: [],
    blockedBy: [],
    metadata: options.metadata,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  tasks.set(id, task);
  notifyListeners();

  return task;
}

/**
 * Update an existing task
 */
export function updateTask(options: TaskUpdateOptions): Task | null {
  const task = tasks.get(options.taskId);
  if (!task) {
    return null;
  }

  const updated: Task = {
    ...task,
    updatedAt: now(),
  };

  if (options.subject !== undefined) {
    updated.subject = options.subject;
  }
  if (options.description !== undefined) {
    updated.description = options.description;
  }
  if (options.activeForm !== undefined) {
    updated.activeForm = options.activeForm;
  }
  if (options.status !== undefined) {
    updated.status = options.status;
  }
  if (options.owner !== undefined) {
    updated.owner = options.owner;
  }
  if (options.metadata !== undefined) {
    updated.metadata = { ...updated.metadata, ...options.metadata };
  }
  if (options.addBlocks) {
    const newBlocks = new Set([...updated.blocks, ...options.addBlocks]);
    updated.blocks = Array.from(newBlocks);
  }
  if (options.addBlockedBy) {
    const newBlockedBy = new Set([...updated.blockedBy, ...options.addBlockedBy]);
    updated.blockedBy = Array.from(newBlockedBy);
  }

  tasks.set(options.taskId, updated);
  notifyListeners();

  return updated;
}

/**
 * Get a task by ID
 */
export function getTask(id: string): Task | undefined {
  return tasks.get(id);
}

/**
 * Get all tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(tasks.values());
}

/**
 * Get tasks with a specific status
 */
export function getTasksByStatus(status: TaskStatus): Task[] {
  return getAllTasks().filter(task => task.status === status);
}

/**
 * Get pending tasks that are not blocked
 */
export function getUnblockedTasks(): Task[] {
  return getAllTasks().filter(task => {
    if (task.status !== 'pending') {
      return false;
    }
    // Check if all blocking tasks are completed
    for (const blockerId of task.blockedBy) {
      const blocker = tasks.get(blockerId);
      if (blocker && blocker.status !== 'completed') {
        return false;
      }
    }
    return true;
  });
}

/**
 * Get tasks owned by a specific agent
 */
export function getTasksByOwner(owner: string): Task[] {
  return getAllTasks().filter(task => task.owner === owner);
}

/**
 * Delete a task
 */
export function deleteTask(id: string): boolean {
  const existed = tasks.delete(id);
  if (existed) {
    notifyListeners();
  }
  return existed;
}

/**
 * Clear all tasks
 */
export function clearTasks(): void {
  tasks.clear();
  taskIdCounter = 0;
  notifyListeners();
}

/**
 * Subscribe to task updates
 */
export function subscribe(listener: TaskStoreListener): () => void {
  listeners.add(listener);
  // Return unsubscribe function
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Get current task count
 */
export function getTaskCount(): number {
  return tasks.size;
}

/**
 * Check if a task exists
 */
export function hasTask(id: string): boolean {
  return tasks.has(id);
}
