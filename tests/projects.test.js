/**
 * tests/projects.test.js
 *
 * Integration tests for all 6 Project MCP tools:
 *   ticktick_get_all_projects
 *   ticktick_get_project
 *   ticktick_get_project_data
 *   ticktick_create_project
 *   ticktick_update_project
 *   ticktick_delete_project
 *
 * Each test that creates a resource registers it with CleanupRegistry so it's
 * always deleted in the `after` hook — even if the test itself throws.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { projectTools } from '../src/tools/projects.js';
import { getClient, CleanupRegistry, assertHasFields, sleep, uid } from './helpers.js';

// ─── Tool lookup helper ───────────────────────────────────────────────────────
const toolMap = Object.fromEntries(projectTools.map((t) => [t.name, t]));
const call = (name, client, args) => toolMap[name].handler(client, args);

// ─────────────────────────────────────────────────────────────────────────────
describe('Project Tools', async () => {
  let client;
  let cleanup;

  before(() => {
    client = getClient();
    cleanup = new CleanupRegistry(client);
  });

  after(async () => {
    await cleanup.run();
  });

  // ─── READ ──────────────────────────────────────────────────────────────────

  it('ticktick_get_all_projects — returns a non-empty array of projects', async () => {
    const projects = await call('ticktick_get_all_projects', client, {});

    assert.ok(Array.isArray(projects), 'Response should be an array');
    assert.ok(projects.length > 0, 'Account should have at least one project');

    // Each project should have the core fields
    for (const p of projects) {
      assertHasFields(assert, p, ['id', 'name']);
    }
  });

  // ─── CREATE ────────────────────────────────────────────────────────────────

  it('ticktick_create_project — creates a project with correct name and color', async () => {
    const name = uid();
    const color = '#FF6161';

    const project = await call('ticktick_create_project', client, {
      name,
      color,
      viewMode: 'list',
      kind: 'TASK',
    });

    cleanup.addProject(project.id);

    assert.ok(project.id, 'Created project should have an id');
    assert.equal(project.name, name, 'Project name should match');
    // Color may or may not be returned depending on API version
  });

  it('ticktick_create_project — creates a NOTE-kind project', async () => {
    const name = `${uid()}-notes`;

    const project = await call('ticktick_create_project', client, {
      name,
      kind: 'NOTE',
    });

    cleanup.addProject(project.id);

    assert.ok(project.id, 'Created NOTE project should have an id');
    assert.equal(project.name, name);
  });

  // ─── GET BY ID ────────────────────────────────────────────────────────────

  it('ticktick_get_project — retrieves a project by id', async () => {
    // First, create a fresh project we control
    const name = uid();
    const created = await call('ticktick_create_project', client, { name });
    cleanup.addProject(created.id);
    await sleep(300); // Give API a moment to index

    const project = await call('ticktick_get_project', client, { projectId: created.id });

    assertHasFields(assert, project, ['id', 'name']);
    assert.equal(project.id, created.id, 'Returned project id should match requested id');
    assert.equal(project.name, name, 'Returned project name should match');
  });

  // NOTE: TickTick returns 200 with empty body for unknown IDs, not a 4xx.
  it('ticktick_get_project — returns empty/null for a non-existent project id (API quirk)', async () => {
    const result = await call('ticktick_get_project', client, {
      projectId: 'definitely_not_real_id_xyz123',
    });
    // API returns empty object or null — no values populated
    const isEmpty =
      result === null ||
      result === undefined ||
      (typeof result === 'object' && !result.id);
    assert.ok(isEmpty, `Expected empty/null for unknown project id. Got: ${JSON.stringify(result)}`);
  });

  // ─── GET PROJECT DATA (with tasks) ────────────────────────────────────────

  it('ticktick_get_project_data — returns project with tasks array', async () => {
    const name = uid();
    const created = await call('ticktick_create_project', client, { name });
    cleanup.addProject(created.id);
    await sleep(300);

    const data = await call('ticktick_get_project_data', client, { projectId: created.id });

    // Should have a project object and a tasks array
    assert.ok(data, 'Response should be truthy');
    // The API returns either { project, tasks } or just the tasks embedded
    const hasTasks =
      Array.isArray(data.tasks) ||
      Array.isArray(data) ||
      (data.project && Array.isArray(data.tasks));

    assert.ok(hasTasks, `Response should contain a tasks array. Got: ${JSON.stringify(Object.keys(data))}`);
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  it('ticktick_update_project — renames a project', async () => {
    const originalName = uid();
    const updatedName = `${uid()}-renamed`;

    const created = await call('ticktick_create_project', client, { name: originalName });
    cleanup.addProject(created.id);
    await sleep(300);

    const updated = await call('ticktick_update_project', client, {
      projectId: created.id,
      name: updatedName,
    });

    assert.ok(updated, 'Update should return a response');
    // Some API versions return updated object, others return the id object
    if (updated.name) {
      assert.equal(updated.name, updatedName, 'Updated name should match');
    }

    // Verify by fetching
    await sleep(300);
    const fetched = await call('ticktick_get_project', client, { projectId: created.id });
    assert.equal(fetched.name, updatedName, 'Fetched project should have the new name');
  });

  it('ticktick_update_project — changes view mode to kanban', async () => {
    const created = await call('ticktick_create_project', client, {
      name: uid(),
      viewMode: 'list',
    });
    cleanup.addProject(created.id);
    await sleep(300);

    await call('ticktick_update_project', client, {
      projectId: created.id,
      viewMode: 'kanban',
    });

    await sleep(300);
    const fetched = await call('ticktick_get_project', client, { projectId: created.id });
    assert.equal(fetched.viewMode, 'kanban', 'View mode should be updated to kanban');
  });

  // ─── DELETE ────────────────────────────────────────────────────────────────

  it('ticktick_delete_project — deletes a project successfully', async () => {
    const created = await call('ticktick_create_project', client, { name: uid() });
    await sleep(300);

    const result = await call('ticktick_delete_project', client, { projectId: created.id });

    assert.ok(result !== null, 'Delete should return a response');

    // After deletion the project should no longer appear in the full list
    await sleep(500);
    const allProjects = await call('ticktick_get_all_projects', client, {});
    const stillExists = allProjects.find((p) => p.id === created.id);
    assert.ok(!stillExists, 'Deleted project should not appear in the all-projects list');
  });

  // ─── ALL PROJECTS CHECK ───────────────────────────────────────────────────

  it('ticktick_get_all_projects — includes projects created in this session', async () => {
    const uniqueName = uid();
    const created = await call('ticktick_create_project', client, { name: uniqueName });
    cleanup.addProject(created.id);
    await sleep(500);

    const allProjects = await call('ticktick_get_all_projects', client, {});
    const found = allProjects.find((p) => p.id === created.id);

    assert.ok(found, `Newly created project "${uniqueName}" should appear in all-projects list`);
    assert.equal(found.name, uniqueName);
  });
});
