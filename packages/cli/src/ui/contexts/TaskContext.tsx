/**
 * Task context for managing task state in the CLI UI
 *
 * Provides reactive task state by subscribing to the task store.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  getAllTasks,
  subscribeToTasks,
  createTask,
  updateTask,
  getTask,
  clearTasks,
} from '@beans/core';
import type { Task, TaskCreateOptions, TaskUpdateOptions } from '@beans/core';

/**
 * Read-only task state context
 */
interface TaskStateValue {
  tasks: Task[];
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
}

/**
 * Task action handlers context
 */
interface TaskActionsValue {
  createTask: (options: TaskCreateOptions) => Task;
  updateTask: (options: TaskUpdateOptions) => Task | null;
  getTask: (id: string) => Task | undefined;
  clearTasks: () => void;
}

const TaskStateContext = createContext<TaskStateValue | null>(null);
const TaskActionsContext = createContext<TaskActionsValue | null>(null);

export interface TaskProviderProps {
  children: ReactNode;
}

export function TaskProvider({ children }: TaskProviderProps): React.ReactElement {
  const [tasks, setTasks] = useState<Task[]>(() => getAllTasks());

  // Subscribe to task store updates
  useEffect(() => {
    const unsubscribe = subscribeToTasks((updatedTasks) => {
      setTasks(updatedTasks);
    });
    return unsubscribe;
  }, []);

  // Compute counts
  const pendingCount = useMemo(
    () => tasks.filter(t => t.status === 'pending').length,
    [tasks]
  );
  const inProgressCount = useMemo(
    () => tasks.filter(t => t.status === 'in_progress').length,
    [tasks]
  );
  const completedCount = useMemo(
    () => tasks.filter(t => t.status === 'completed').length,
    [tasks]
  );

  // Memoize state value
  const stateValue = useMemo<TaskStateValue>(() => ({
    tasks,
    pendingCount,
    inProgressCount,
    completedCount,
  }), [tasks, pendingCount, inProgressCount, completedCount]);

  // Create stable action references
  const handleCreateTask = useCallback((options: TaskCreateOptions) => {
    return createTask(options);
  }, []);

  const handleUpdateTask = useCallback((options: TaskUpdateOptions) => {
    return updateTask(options);
  }, []);

  const handleGetTask = useCallback((id: string) => {
    return getTask(id);
  }, []);

  const handleClearTasks = useCallback(() => {
    clearTasks();
  }, []);

  // Memoize actions value
  const actionsValue = useMemo<TaskActionsValue>(() => ({
    createTask: handleCreateTask,
    updateTask: handleUpdateTask,
    getTask: handleGetTask,
    clearTasks: handleClearTasks,
  }), [handleCreateTask, handleUpdateTask, handleGetTask, handleClearTasks]);

  return (
    <TaskStateContext.Provider value={stateValue}>
      <TaskActionsContext.Provider value={actionsValue}>
        {children}
      </TaskActionsContext.Provider>
    </TaskStateContext.Provider>
  );
}

/**
 * Hook to access task state
 */
export function useTaskState(): TaskStateValue {
  const context = useContext(TaskStateContext);
  if (!context) {
    throw new Error('useTaskState must be used within a TaskProvider');
  }
  return context;
}

/**
 * Hook to access task actions
 */
export function useTaskActions(): TaskActionsValue {
  const context = useContext(TaskActionsContext);
  if (!context) {
    throw new Error('useTaskActions must be used within a TaskProvider');
  }
  return context;
}

/**
 * Combined hook for components that need both state and actions
 */
export function useTaskContext(): TaskStateValue & TaskActionsValue {
  const state = useTaskState();
  const actions = useTaskActions();
  return { ...state, ...actions };
}
