import fetch from 'node-fetch';

const BASE_URL = 'https://api.ticktick.com';

/**
 * TickTickClient - Handles all HTTP communication with the TickTick Open API.
 * Supports Bearer token auth (both personal access tokens and OAuth2 access tokens).
 */
export class TickTickClient {
  constructor(accessToken) {
    if (!accessToken) {
      throw new Error(
        'No TickTick access token provided. Set TICKTICK_ACCESS_TOKEN environment variable.'
      );
    }
    this.accessToken = accessToken;
  }

  /**
   * Makes an authenticated request to the TickTick API.
   * @param {string} method - HTTP method
   * @param {string} path - API path (e.g. '/open/v1/project')
   * @param {object} [body] - Request body (for POST/PUT)
   * @param {object} [queryParams] - URL query parameters
   * @returns {Promise<any>} - Parsed JSON response or null for 204
   */
  async request(method, path, body = null, queryParams = null) {
    let url = `${BASE_URL}${path}`;

    if (queryParams && Object.keys(queryParams).length > 0) {
      const params = new URLSearchParams(
        Object.fromEntries(
          Object.entries(queryParams).filter(([, v]) => v !== undefined && v !== null)
        )
      );
      url += `?${params.toString()}`;
    }

    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const options = { method, headers };
    if (body !== null && method !== 'GET' && method !== 'DELETE') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    // No content response
    if (response.status === 204) {
      return { success: true };
    }

    const text = await response.text();

    if (!response.ok) {
      let errorDetail = text;
      try {
        const errJson = JSON.parse(text);
        errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch {
        // not json, use raw text
      }
      throw new Error(`TickTick API Error [${response.status}]: ${errorDetail}`);
    }

    if (!text || text.trim() === '') {
      return { success: true };
    }

    try {
      return JSON.parse(text);
    } catch {
      return { success: true, raw: text };
    }
  }

  // ─────────────────────────────────────────────
  // PROJECT ENDPOINTS
  // ─────────────────────────────────────────────

  /** Get all user projects */
  getAllProjects() {
    return this.request('GET', '/open/v1/project');
  }

  /** Get a single project by ID */
  getProject(projectId) {
    return this.request('GET', `/open/v1/project/${projectId}`);
  }

  /** Get project with its tasks and columns */
  getProjectData(projectId) {
    return this.request('GET', `/open/v1/project/${projectId}/data`);
  }

  /** Create a new project */
  createProject(data) {
    return this.request('POST', '/open/v1/project', data);
  }

  /** Update an existing project */
  updateProject(projectId, data) {
    return this.request('POST', `/open/v1/project/${projectId}`, data);
  }

  /** Delete a project */
  deleteProject(projectId) {
    return this.request('DELETE', `/open/v1/project/${projectId}`);
  }

  // ─────────────────────────────────────────────
  // TASK ENDPOINTS
  // ─────────────────────────────────────────────

  /** Get a single task by project ID and task ID */
  getTask(projectId, taskId) {
    return this.request('GET', `/open/v1/project/${projectId}/task/${taskId}`);
  }

  /** Create a new task */
  createTask(data) {
    return this.request('POST', '/open/v1/task', data);
  }

  /** Update a task */
  updateTask(taskId, data) {
    return this.request('POST', `/open/v1/task/${taskId}`, data);
  }

  /** Mark a task as complete */
  completeTask(projectId, taskId) {
    return this.request('POST', `/open/v1/project/${projectId}/task/${taskId}/complete`);
  }

  /** Delete a task */
  deleteTask(projectId, taskId) {
    return this.request('DELETE', `/open/v1/project/${projectId}/task/${taskId}`);
  }

  /** Move tasks between projects */
  moveTasks(moves) {
    // moves: [{ fromProjectId, toProjectId, taskId }]
    return this.request('POST', '/open/v1/task/move', moves);
  }

  /** Get completed tasks within a time range */
  getCompletedTasks(projectIds, startDate, endDate) {
    return this.request('POST', '/open/v1/task/completed', {
      projectIds,
      startDate,
      endDate,
    });
  }

  /** Advanced task filtering */
  filterTasks(filters) {
    return this.request('POST', '/open/v1/task/filter', filters);
  }
}

/**
 * Creates a TickTickClient from environment variables.
 * Uses TICKTICK_ACCESS_TOKEN for direct token auth.
 */
export function createClientFromEnv() {
  const token = process.env.TICKTICK_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'TICKTICK_ACCESS_TOKEN environment variable is required. ' +
        'You can get an access token from https://developer.ticktick.com'
    );
  }
  return new TickTickClient(token);
}
