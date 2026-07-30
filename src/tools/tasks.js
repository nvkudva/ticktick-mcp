/**
 * Task-related MCP tools for TickTick.
 * Covers: get, create, update, complete, delete, move, filter, and list completed tasks.
 *
 * Priority levels in TickTick:
 *   0 = None, 1 = Low, 3 = Medium, 5 = High
 *
 * Task status:
 *   0 = Normal (active), 2 = Completed
 *
 * Task kind:
 *   TEXT = Regular task, NOTE = Note, CHECKLIST = Checklist task
 *
 * Date format: ISO 8601, e.g. "2024-01-15T09:00:00+05:30"
 */

export const taskTools = [
  // ─────────────────────────────────────────────
  // GET TASK
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_get_task',
    description:
      'Retrieve a specific task by its project ID and task ID. Returns full task details including title, content, due date, priority, checklist items, reminders, and status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project the task belongs to.',
        },
        taskId: {
          type: 'string',
          description: 'The unique ID of the task.',
        },
      },
      required: ['projectId', 'taskId'],
    },
    handler: async (client, { projectId, taskId }) => {
      return await client.getTask(projectId, taskId);
    },
  },

  // ─────────────────────────────────────────────
  // CREATE TASK
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_create_task',
    description:
      'Create a new task in TickTick. You can set the title, project, due date, priority, content, checklist items, reminders, and more. The task title and project ID are required.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title/name of the task. Required.',
        },
        projectId: {
          type: 'string',
          description: 'The ID of the project to add the task to. Required.',
        },
        content: {
          type: 'string',
          description: 'Optional. Main body/notes content for the task.',
        },
        desc: {
          type: 'string',
          description: 'Optional. A brief description or subtitle for the task.',
        },
        isAllDay: {
          type: 'boolean',
          description:
            'Optional. If true, the task is an all-day event without a specific time. Defaults to false.',
        },
        startDate: {
          type: 'string',
          description:
            'Optional. Start date/time in ISO 8601 format (e.g. "2024-06-15T09:00:00+00:00").',
        },
        dueDate: {
          type: 'string',
          description:
            'Optional. Due date/time in ISO 8601 format (e.g. "2024-06-15T18:00:00+00:00").',
        },
        timeZone: {
          type: 'string',
          description:
            'Optional. Timezone for the task dates (e.g. "America/New_York", "Asia/Kolkata"). Defaults to user\'s timezone.',
        },
        priority: {
          type: 'number',
          enum: [0, 1, 3, 5],
          description:
            'Optional. Task priority: 0 = None (default), 1 = Low, 3 = Medium, 5 = High.',
        },
        sortOrder: {
          type: 'number',
          description:
            'Optional. Sort order for positioning within the project. Lower values appear first.',
        },
        reminders: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Array of reminder strings in RRULE-adjacent format (e.g. ["TRIGGER:PT0S"] for at-time reminders, ["TRIGGER:-PT30M"] for 30 minutes before).',
        },
        repeatFlag: {
          type: 'string',
          description:
            'Optional. Recurrence rule in RRULE format (e.g. "RRULE:FREQ=DAILY;INTERVAL=1" for daily repeat).',
        },
        items: {
          type: 'array',
          description: 'Optional. Checklist sub-items for the task.',
          items: {
            type: 'object',
            properties: {
              title: {
                type: 'string',
                description: 'Text of the checklist item.',
              },
              status: {
                type: 'number',
                enum: [0, 1],
                description: '0 = Incomplete (default), 1 = Completed.',
              },
              startDate: {
                type: 'string',
                description: 'Optional. ISO 8601 date for the checklist item.',
              },
              isAllDay: {
                type: 'boolean',
                description: 'Optional. Whether the checklist item is an all-day entry.',
              },
            },
            required: ['title'],
          },
        },
        kind: {
          type: 'string',
          enum: ['TEXT', 'NOTE', 'CHECKLIST'],
          description:
            'Optional. Task kind: TEXT (default), NOTE (note-style task), CHECKLIST (task with sub-items).',
        },
      },
      required: ['title', 'projectId'],
    },
    handler: async (client, args) => {
      const {
        title, projectId, content, desc, isAllDay,
        startDate, dueDate, timeZone, priority, sortOrder,
        reminders, repeatFlag, items, kind,
      } = args;

      const body = { title, projectId };
      if (content !== undefined) body.content = content;
      if (desc !== undefined) body.desc = desc;
      if (isAllDay !== undefined) body.isAllDay = isAllDay;
      if (startDate !== undefined) body.startDate = startDate;
      if (dueDate !== undefined) body.dueDate = dueDate;
      if (timeZone !== undefined) body.timeZone = timeZone;
      if (priority !== undefined) body.priority = priority;
      if (sortOrder !== undefined) body.sortOrder = sortOrder;
      if (reminders !== undefined) body.reminders = reminders;
      if (repeatFlag !== undefined) body.repeatFlag = repeatFlag;
      if (items !== undefined) body.items = items;
      if (kind !== undefined) body.kind = kind;

      return await client.createTask(body);
    },
  },

  // ─────────────────────────────────────────────
  // UPDATE TASK
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_update_task',
    description:
      'Update an existing task in TickTick. Provide the task ID and project ID, then include only the fields you want to change. You can update the title, dates, priority, content, checklist items, and more.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The unique ID of the task to update. Required.',
        },
        projectId: {
          type: 'string',
          description: 'The ID of the project the task belongs to. Required.',
        },
        title: {
          type: 'string',
          description: 'Optional. New title for the task.',
        },
        content: {
          type: 'string',
          description: 'Optional. Updated body/notes content.',
        },
        desc: {
          type: 'string',
          description: 'Optional. Updated description/subtitle.',
        },
        isAllDay: {
          type: 'boolean',
          description: 'Optional. Updated all-day flag.',
        },
        startDate: {
          type: 'string',
          description: 'Optional. Updated start date/time in ISO 8601 format.',
        },
        dueDate: {
          type: 'string',
          description: 'Optional. Updated due date/time in ISO 8601 format.',
        },
        timeZone: {
          type: 'string',
          description: 'Optional. Updated timezone.',
        },
        priority: {
          type: 'number',
          enum: [0, 1, 3, 5],
          description: 'Optional. Updated priority: 0=None, 1=Low, 3=Medium, 5=High.',
        },
        sortOrder: {
          type: 'number',
          description: 'Optional. Updated sort order.',
        },
        reminders: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional. Updated reminders list.',
        },
        repeatFlag: {
          type: 'string',
          description: 'Optional. Updated recurrence rule in RRULE format.',
        },
        items: {
          type: 'array',
          description: 'Optional. Updated checklist sub-items.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Item ID (if updating existing item).' },
              title: { type: 'string', description: 'Text of the checklist item.' },
              status: { type: 'number', enum: [0, 1], description: '0=Incomplete, 1=Completed.' },
              startDate: { type: 'string', description: 'Optional ISO 8601 date.' },
              isAllDay: { type: 'boolean' },
            },
            required: ['title'],
          },
        },
        kind: {
          type: 'string',
          enum: ['TEXT', 'NOTE', 'CHECKLIST'],
          description: 'Optional. Updated task kind.',
        },
      },
      required: ['taskId', 'projectId'],
    },
    handler: async (client, args) => {
      const { taskId, ...rest } = args;
      const body = { id: taskId, ...rest };
      return await client.updateTask(taskId, body);
    },
  },

  // ─────────────────────────────────────────────
  // COMPLETE TASK
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_complete_task',
    description:
      'Mark a task as completed in TickTick. The task will be moved to the completed state and will appear in the "Completed" section.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project the task belongs to.',
        },
        taskId: {
          type: 'string',
          description: 'The unique ID of the task to complete.',
        },
      },
      required: ['projectId', 'taskId'],
    },
    handler: async (client, { projectId, taskId }) => {
      return await client.completeTask(projectId, taskId);
    },
  },

  // ─────────────────────────────────────────────
  // DELETE TASK
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_delete_task',
    description:
      'Permanently delete a task from TickTick. This action cannot be undone. Use with caution.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The ID of the project the task belongs to.',
        },
        taskId: {
          type: 'string',
          description: 'The unique ID of the task to delete.',
        },
      },
      required: ['projectId', 'taskId'],
    },
    handler: async (client, { projectId, taskId }) => {
      return await client.deleteTask(projectId, taskId);
    },
  },

  // ─────────────────────────────────────────────
  // MOVE TASKS
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_move_tasks',
    description:
      'Move one or more tasks from one project to another. Useful for organizing tasks across different lists/projects.',
    inputSchema: {
      type: 'object',
      properties: {
        moves: {
          type: 'array',
          description: 'Array of task move operations.',
          minItems: 1,
          items: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                description: 'The ID of the task to move.',
              },
              fromProjectId: {
                type: 'string',
                description: 'The ID of the project to move the task from.',
              },
              toProjectId: {
                type: 'string',
                description: 'The ID of the project to move the task to.',
              },
            },
            required: ['taskId', 'fromProjectId', 'toProjectId'],
          },
        },
      },
      required: ['moves'],
    },
    handler: async (client, { moves }) => {
      return await client.moveTasks(moves);
    },
  },

  // ─────────────────────────────────────────────
  // GET COMPLETED TASKS
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_get_completed_tasks',
    description:
      'Retrieve tasks that have been completed within a given date range. Optionally filter by specific projects. Useful for reviewing productivity or recently completed work.',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description:
            'Start date for the completed tasks query in ISO 8601 format (e.g. "2024-01-01T00:00:00+00:00"). Required.',
        },
        endDate: {
          type: 'string',
          description:
            'End date for the completed tasks query in ISO 8601 format (e.g. "2024-01-31T23:59:59+00:00"). Required.',
        },
        projectIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional. Array of project IDs to filter completed tasks by. If omitted, returns completed tasks from all projects.',
        },
      },
      required: ['startDate', 'endDate'],
    },
    handler: async (client, { startDate, endDate, projectIds }) => {
      return await client.getCompletedTasks(projectIds || null, startDate, endDate);
    },
  },

  // ─────────────────────────────────────────────
  // FILTER TASKS
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_filter_tasks',
    description:
      'Advanced task search and filtering. Filter tasks by project IDs, date range, priority level, tags, and completion status. This is useful for finding tasks matching specific criteria across multiple projects.',
    inputSchema: {
      type: 'object',
      properties: {
        projectIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional. Filter tasks to only these project IDs.',
        },
        startDate: {
          type: 'string',
          description:
            'Optional. Only return tasks with start/due date on or after this date (ISO 8601).',
        },
        endDate: {
          type: 'string',
          description:
            'Optional. Only return tasks with start/due date on or before this date (ISO 8601).',
        },
        priority: {
          type: 'number',
          enum: [0, 1, 3, 5],
          description:
            'Optional. Filter by priority level: 0=None, 1=Low, 3=Medium, 5=High.',
        },
        tag: {
          type: 'string',
          description: 'Optional. Filter tasks that have this tag.',
        },
        status: {
          type: 'number',
          enum: [0, 2],
          description:
            'Optional. Filter by task status: 0 = Active/Normal tasks, 2 = Completed tasks.',
        },
      },
      required: [],
    },
    handler: async (client, args) => {
      const filters = {};
      if (args.projectIds !== undefined) filters.projectIds = args.projectIds;
      if (args.startDate !== undefined) filters.startDate = args.startDate;
      if (args.endDate !== undefined) filters.endDate = args.endDate;
      if (args.priority !== undefined) filters.priority = args.priority;
      if (args.tag !== undefined) filters.tag = args.tag;
      if (args.status !== undefined) filters.status = args.status;
      return await client.filterTasks(filters);
    },
  },
];
