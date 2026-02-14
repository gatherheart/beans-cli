/**
 * Task tools for multi-agent task management
 */

import { z } from 'zod';
import { BaseTool } from '../base-tool.js';
import type { ToolExecutionResult, ToolExecutionOptions } from '../types.js';
import {
  createTask,
  updateTask,
  getTask,
  getAllTasks,
} from '../../agents/multi-agent/task-store.js';
import type { TaskStatus } from '../../agents/multi-agent/types.js';

// TaskCreate schema
const TaskCreateSchema = z.object({
  subject: z.string().describe('A brief title for the task'),
  description: z.string().describe('A detailed description of what needs to be done'),
  activeForm: z
    .string()
    .optional()
    .describe('Present continuous form shown in spinner when in_progress (e.g., "Running tests")'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Arbitrary metadata to attach to the task'),
});

type TaskCreateParams = z.infer<typeof TaskCreateSchema>;

/**
 * Tool for creating tasks
 */
export class TaskCreateTool extends BaseTool<TaskCreateParams> {
  readonly name = 'task_create';
  readonly description =
    'Create a new task to track work. Use this for complex multi-step tasks that benefit from tracking progress. Tasks start with "pending" status.';
  readonly schema = TaskCreateSchema;

  async execute(
    params: TaskCreateParams,
    _options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const task = createTask({
      subject: params.subject,
      description: params.description,
      activeForm: params.activeForm,
      metadata: params.metadata,
    });

    return {
      content: `Task #${task.id} created successfully: ${task.subject}`,
      metadata: { taskId: task.id },
    };
  }
}

// TaskUpdate schema
const TaskUpdateSchema = z.object({
  taskId: z.string().describe('The ID of the task to update'),
  subject: z.string().optional().describe('New subject for the task'),
  description: z.string().optional().describe('New description for the task'),
  activeForm: z
    .string()
    .optional()
    .describe('Present continuous form shown in spinner when in_progress'),
  status: z
    .enum(['pending', 'in_progress', 'completed'])
    .optional()
    .describe('New status for the task'),
  owner: z.string().optional().describe('New owner for the task'),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe('Metadata keys to merge into the task'),
  addBlocks: z
    .array(z.string())
    .optional()
    .describe('Task IDs that this task blocks'),
  addBlockedBy: z
    .array(z.string())
    .optional()
    .describe('Task IDs that block this task'),
});

type TaskUpdateParams = z.infer<typeof TaskUpdateSchema>;

/**
 * Tool for updating tasks
 */
export class TaskUpdateTool extends BaseTool<TaskUpdateParams> {
  readonly name = 'task_update';
  readonly description =
    'Update an existing task. Use to change status (pending -> in_progress -> completed), update description, or set dependencies.';
  readonly schema = TaskUpdateSchema;

  async execute(
    params: TaskUpdateParams,
    _options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const task = updateTask({
      taskId: params.taskId,
      subject: params.subject,
      description: params.description,
      activeForm: params.activeForm,
      status: params.status as TaskStatus | undefined,
      owner: params.owner,
      metadata: params.metadata as Record<string, unknown> | undefined,
      addBlocks: params.addBlocks,
      addBlockedBy: params.addBlockedBy,
    });

    if (!task) {
      return {
        content: `Task #${params.taskId} not found`,
        isError: true,
      };
    }

    let updateSummary = `Updated task #${task.id}`;
    if (params.status) {
      updateSummary += ` status`;
    }

    return {
      content: updateSummary,
      metadata: { task },
    };
  }
}

// TaskGet schema
const TaskGetSchema = z.object({
  taskId: z.string().describe('The ID of the task to retrieve'),
});

type TaskGetParams = z.infer<typeof TaskGetSchema>;

/**
 * Tool for getting a single task
 */
export class TaskGetTool extends BaseTool<TaskGetParams> {
  readonly name = 'task_get';
  readonly description =
    'Retrieve a task by its ID. Returns full task details including description, status, and dependencies.';
  readonly schema = TaskGetSchema;

  async execute(
    params: TaskGetParams,
    _options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const task = getTask(params.taskId);

    if (!task) {
      return {
        content: `Task #${params.taskId} not found`,
        isError: true,
      };
    }

    const blockedByStr = task.blockedBy.length > 0
      ? `\nBlocked by: ${task.blockedBy.join(', ')}`
      : '';
    const blocksStr = task.blocks.length > 0
      ? `\nBlocks: ${task.blocks.join(', ')}`
      : '';
    const ownerStr = task.owner ? `\nOwner: ${task.owner}` : '';

    return {
      content: `Task #${task.id}: ${task.subject}
Status: ${task.status}${ownerStr}${blockedByStr}${blocksStr}

${task.description}`,
      metadata: { task },
    };
  }
}

// TaskList schema
const TaskListSchema = z.object({});

type TaskListParams = z.infer<typeof TaskListSchema>;

/**
 * Tool for listing all tasks
 */
export class TaskListTool extends BaseTool<TaskListParams> {
  readonly name = 'task_list';
  readonly description =
    'List all tasks in the task store. Shows ID, subject, status, and blocked status for each task.';
  readonly schema = TaskListSchema;

  async execute(
    _params: TaskListParams,
    _options?: ToolExecutionOptions
  ): Promise<ToolExecutionResult> {
    const tasks = getAllTasks();

    if (tasks.length === 0) {
      return {
        content: 'No tasks found.',
        metadata: { tasks: [] },
      };
    }

    const taskLines = tasks.map(task => {
      const statusIcon = {
        pending: ' ',
        in_progress: '*',
        completed: '+',
      }[task.status];

      const blockedStr = task.blockedBy.length > 0
        ? ` (blocked by: ${task.blockedBy.join(', ')})`
        : '';
      const ownerStr = task.owner ? ` [${task.owner}]` : '';

      return `#${task.id}. [${statusIcon}] ${task.subject}${ownerStr}${blockedStr}`;
    });

    return {
      content: taskLines.join('\n'),
      metadata: { tasks },
    };
  }
}
