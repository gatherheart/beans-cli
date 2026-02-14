/**
 * Tests for the multi-agent task store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createTask,
  updateTask,
  getTask,
  getAllTasks,
  getTasksByStatus,
  getUnblockedTasks,
  deleteTask,
  clearTasks,
  subscribe,
} from '../../../packages/core/src/agents/multi-agent/task-store.js';

describe('TaskStore', () => {
  beforeEach(() => {
    clearTasks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createTask', () => {
    it('should create a task with pending status', () => {
      const task = createTask({
        subject: 'Test task',
        description: 'A test task description',
      });

      expect(task.id).toBeDefined();
      expect(task.subject).toBe('Test task');
      expect(task.description).toBe('A test task description');
      expect(task.status).toBe('pending');
      expect(task.blocks).toEqual([]);
      expect(task.blockedBy).toEqual([]);
    });

    it('should create tasks with unique IDs', () => {
      const task1 = createTask({ subject: 'Task 1', description: 'Desc 1' });
      const task2 = createTask({ subject: 'Task 2', description: 'Desc 2' });

      expect(task1.id).not.toBe(task2.id);
    });

    it('should include optional activeForm and metadata', () => {
      const task = createTask({
        subject: 'Task',
        description: 'Desc',
        activeForm: 'Processing task',
        metadata: { priority: 'high' },
      });

      expect(task.activeForm).toBe('Processing task');
      expect(task.metadata).toEqual({ priority: 'high' });
    });
  });

  describe('updateTask', () => {
    it('should update task status', () => {
      const task = createTask({ subject: 'Task', description: 'Desc' });

      const updated = updateTask({ taskId: task.id, status: 'in_progress' });

      expect(updated?.status).toBe('in_progress');
    });

    it('should update multiple fields', () => {
      const task = createTask({ subject: 'Task', description: 'Desc' });

      const updated = updateTask({
        taskId: task.id,
        subject: 'Updated Task',
        description: 'Updated Desc',
        owner: 'test-agent',
      });

      expect(updated?.subject).toBe('Updated Task');
      expect(updated?.description).toBe('Updated Desc');
      expect(updated?.owner).toBe('test-agent');
    });

    it('should add dependencies', () => {
      const task1 = createTask({ subject: 'Task 1', description: 'Desc' });
      const task2 = createTask({ subject: 'Task 2', description: 'Desc' });

      updateTask({ taskId: task2.id, addBlockedBy: [task1.id] });
      updateTask({ taskId: task1.id, addBlocks: [task2.id] });

      const updated1 = getTask(task1.id);
      const updated2 = getTask(task2.id);

      expect(updated1?.blocks).toContain(task2.id);
      expect(updated2?.blockedBy).toContain(task1.id);
    });

    it('should return null for non-existent task', () => {
      const result = updateTask({ taskId: 'nonexistent', status: 'completed' });

      expect(result).toBeNull();
    });
  });

  describe('getTask', () => {
    it('should return task by ID', () => {
      const created = createTask({ subject: 'Task', description: 'Desc' });

      const retrieved = getTask(created.id);

      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent task', () => {
      const result = getTask('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllTasks', () => {
    it('should return all tasks', () => {
      createTask({ subject: 'Task 1', description: 'Desc' });
      createTask({ subject: 'Task 2', description: 'Desc' });

      const all = getAllTasks();

      expect(all).toHaveLength(2);
    });

    it('should return empty array when no tasks', () => {
      const all = getAllTasks();

      expect(all).toEqual([]);
    });
  });

  describe('getTasksByStatus', () => {
    it('should filter tasks by status', () => {
      createTask({ subject: 'Pending 1', description: 'Desc' });
      createTask({ subject: 'Pending 2', description: 'Desc' });
      const task3 = createTask({ subject: 'In Progress', description: 'Desc' });
      updateTask({ taskId: task3.id, status: 'in_progress' });

      const pending = getTasksByStatus('pending');
      const inProgress = getTasksByStatus('in_progress');

      expect(pending).toHaveLength(2);
      expect(inProgress).toHaveLength(1);
    });
  });

  describe('getUnblockedTasks', () => {
    it('should return pending tasks with no blockers', () => {
      createTask({ subject: 'Unblocked', description: 'Desc' });

      const unblocked = getUnblockedTasks();

      expect(unblocked).toHaveLength(1);
    });

    it('should exclude blocked tasks', () => {
      const task1 = createTask({ subject: 'Blocker', description: 'Desc' });
      const task2 = createTask({ subject: 'Blocked', description: 'Desc' });
      updateTask({ taskId: task2.id, addBlockedBy: [task1.id] });

      const unblocked = getUnblockedTasks();

      expect(unblocked).toHaveLength(1);
      expect(unblocked[0].subject).toBe('Blocker');
    });

    it('should include task when blockers are completed', () => {
      const task1 = createTask({ subject: 'Blocker', description: 'Desc' });
      const task2 = createTask({ subject: 'Blocked', description: 'Desc' });
      updateTask({ taskId: task2.id, addBlockedBy: [task1.id] });
      updateTask({ taskId: task1.id, status: 'completed' });

      const unblocked = getUnblockedTasks();

      expect(unblocked).toHaveLength(1);
      expect(unblocked[0].subject).toBe('Blocked');
    });
  });

  describe('deleteTask', () => {
    it('should delete a task', () => {
      const task = createTask({ subject: 'Task', description: 'Desc' });

      const result = deleteTask(task.id);

      expect(result).toBe(true);
      expect(getTask(task.id)).toBeUndefined();
    });

    it('should return false for non-existent task', () => {
      const result = deleteTask('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on task changes', () => {
      const listener = vi.fn();
      subscribe(listener);

      createTask({ subject: 'Task', description: 'Desc' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.any(Array));
    });

    it('should allow unsubscribing', () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      unsubscribe();
      createTask({ subject: 'Task', description: 'Desc' });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
