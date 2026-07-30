/**
 * Project-related MCP tools for TickTick.
 * Covers: list, get, create, update, delete projects + getting project data with tasks.
 */

export const projectTools = [
  // ─────────────────────────────────────────────
  // GET ALL PROJECTS
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_get_all_projects',
    description:
      'Retrieve all projects (lists) in the user\'s TickTick account. Returns an array of project objects with their IDs, names, colors, view modes, and permissions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    handler: async (client, _args) => {
      const projects = await client.getAllProjects();
      return projects;
    },
  },

  // ─────────────────────────────────────────────
  // GET PROJECT BY ID
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_get_project',
    description:
      'Retrieve a specific project by its ID. Returns metadata like name, color, view mode (list/kanban/timeline), and kind (TASK or NOTE).',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The unique ID of the project to retrieve.',
        },
      },
      required: ['projectId'],
    },
    handler: async (client, { projectId }) => {
      return await client.getProject(projectId);
    },
  },

  // ─────────────────────────────────────────────
  // GET PROJECT WITH TASKS AND COLUMNS
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_get_project_data',
    description:
      'Retrieve a project along with all its tasks and columns (for kanban views). This is the most comprehensive way to view everything inside a project in one call.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The unique ID of the project.',
        },
      },
      required: ['projectId'],
    },
    handler: async (client, { projectId }) => {
      return await client.getProjectData(projectId);
    },
  },

  // ─────────────────────────────────────────────
  // CREATE PROJECT
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_create_project',
    description:
      'Create a new project (list) in TickTick. You can set its name, color, view mode (list, kanban, or timeline), and kind (TASK for task lists, NOTE for note collections).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name of the new project.',
        },
        color: {
          type: 'string',
          description:
            'Optional. Hex color code for the project (e.g. "#FF6161"). If omitted, a default color is used.',
        },
        sortOrder: {
          type: 'number',
          description:
            'Optional. Sort order position of the project in the sidebar. Lower numbers appear first.',
        },
        viewMode: {
          type: 'string',
          enum: ['list', 'kanban', 'timeline'],
          description:
            'Optional. Default view mode for the project. One of: list, kanban, timeline. Defaults to list.',
        },
        kind: {
          type: 'string',
          enum: ['TASK', 'NOTE'],
          description:
            'Optional. Project type: TASK (default) for task management, NOTE for note-taking.',
        },
      },
      required: ['name'],
    },
    handler: async (client, { name, color, sortOrder, viewMode, kind }) => {
      const body = { name };
      if (color !== undefined) body.color = color;
      if (sortOrder !== undefined) body.sortOrder = sortOrder;
      if (viewMode !== undefined) body.viewMode = viewMode;
      if (kind !== undefined) body.kind = kind;
      return await client.createProject(body);
    },
  },

  // ─────────────────────────────────────────────
  // UPDATE PROJECT
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_update_project',
    description:
      'Update an existing project\'s metadata such as its name, color, view mode, or kind. Only provide the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The unique ID of the project to update.',
        },
        name: {
          type: 'string',
          description: 'Optional. New name for the project.',
        },
        color: {
          type: 'string',
          description: 'Optional. New hex color code (e.g. "#4772FA").',
        },
        sortOrder: {
          type: 'number',
          description: 'Optional. Updated sort order position.',
        },
        viewMode: {
          type: 'string',
          enum: ['list', 'kanban', 'timeline'],
          description: 'Optional. New default view mode.',
        },
        kind: {
          type: 'string',
          enum: ['TASK', 'NOTE'],
          description: 'Optional. New project kind.',
        },
      },
      required: ['projectId'],
    },
    handler: async (client, { projectId, name, color, sortOrder, viewMode, kind }) => {
      const body = {};
      if (name !== undefined) body.name = name;
      if (color !== undefined) body.color = color;
      if (sortOrder !== undefined) body.sortOrder = sortOrder;
      if (viewMode !== undefined) body.viewMode = viewMode;
      if (kind !== undefined) body.kind = kind;
      return await client.updateProject(projectId, body);
    },
  },

  // ─────────────────────────────────────────────
  // DELETE PROJECT
  // ─────────────────────────────────────────────
  {
    name: 'ticktick_delete_project',
    description:
      'Permanently delete a project from TickTick. WARNING: This will also delete all tasks inside the project. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'The unique ID of the project to delete.',
        },
      },
      required: ['projectId'],
    },
    handler: async (client, { projectId }) => {
      return await client.deleteProject(projectId);
    },
  },
];
