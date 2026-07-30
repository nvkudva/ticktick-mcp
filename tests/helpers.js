/**
 * tests/helpers.js
 * Shared utilities for TickTick MCP integration tests.
 */
import { TickTickClient } from '../src/client.js';

// ─── Client ──────────────────────────────────────────────────────────────────

/**
 * Returns a TickTickClient using the TICKTICK_ACCESS_TOKEN env var.
 * Tests should import this rather than constructing clients themselves.
 */
export function getClient() {
  const token = process.env.TICKTICK_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      'TICKTICK_ACCESS_TOKEN env var is required to run tests.\n' +
      'Run: TICKTICK_ACCESS_TOKEN=your_token npm test'
    );
  }
  return new TickTickClient(token);
}

// ─── Cleanup registry ────────────────────────────────────────────────────────

/**
 * A simple cleanup registry so tests can register resources to be deleted
 * at the end of the suite, even if an earlier test throws.
 *
 * Usage:
 *   const cleanup = new CleanupRegistry(client);
 *   cleanup.addProject(id);
 *   cleanup.addTask(projectId, taskId);
 *   after(async () => cleanup.run());
 */
export class CleanupRegistry {
  constructor(client) {
    this.client = client;
    this._tasks = [];    // [{ projectId, taskId }]
    this._projects = []; // [projectId]
  }

  addTask(projectId, taskId) {
    this._tasks.push({ projectId, taskId });
  }

  addProject(projectId) {
    this._projects.push(projectId);
  }

  async run() {
    // Delete tasks first, then projects
    for (const { projectId, taskId } of this._tasks) {
      try { await this.client.deleteTask(projectId, taskId); } catch { /* already gone */ }
    }
    for (const projectId of this._projects) {
      try { await this.client.deleteProject(projectId); } catch { /* already gone */ }
    }
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Returns an ISO date string N days from now */
export function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

/** Returns an ISO date string N days ago */
export function daysAgo(n) {
  return daysFromNow(-n);
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

/**
 * Assert that an object has all the listed keys (non-null/undefined values).
 * @param {object} obj
 * @param {string[]} keys
 */
export function assertHasFields(assert, obj, keys) {
  for (const key of keys) {
    assert.ok(
      obj[key] !== undefined && obj[key] !== null,
      `Expected field "${key}" to be present and non-null, got: ${JSON.stringify(obj[key])}`
    );
  }
}

/** Small sleep helper to avoid hammering the API */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Unique name generator for test resources so concurrent runs don't collide */
export const uid = () => `mcp-test-${Date.now()}`;
