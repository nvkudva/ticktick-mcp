/**
 * tests/tasks.test.js
 *
 * Integration tests for all 8 Task MCP tools:
 *   ticktick_get_task
 *   ticktick_create_task
 *   ticktick_update_task
 *   ticktick_complete_task
 *   ticktick_delete_task
 *   ticktick_move_tasks
 *   ticktick_get_completed_tasks
 *   ticktick_filter_tasks
 *
 * A dedicated test project is created before the suite and deleted after.
 * All tasks created within the suite are tracked for cleanup too.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { taskTools } from '../src/tools/tasks.js';
import { projectTools } from '../src/tools/projects.js';
import {
  getClient, CleanupRegistry, assertHasFields,
  daysFromNow, daysAgo, sleep, uid,
} from './helpers.js';

// ─── Tool lookup helpers ──────────────────────────────────────────────────────
const taskToolMap    = Object.fromEntries(taskTools.map((t)    => [t.name, t]));
const projectToolMap = Object.fromEntries(projectTools.map((t) => [t.name, t]));

const callTask    = (name, client, args) => taskToolMap[name].handler(client, args);
const callProject = (name, client, args) => projectToolMap[name].handler(client, args);

// ─────────────────────────────────────────────────────────────────────────────
describe('Task Tools', async () => {
  let client;
  let cleanup;

  /** The sandboxed project all tasks are created in */
  let testProjectId;
  /** A second project used for move-task tests */
  let targetProjectId;

  // ─── Setup ────────────────────────────────────────────────────────────────
  before(async () => {
    client  = getClient();
    cleanup = new CleanupRegistry(client);

    // Create two isolated test projects
    const [proj1, proj2] = await Promise.all([
      callProject('ticktick_create_project', client, { name: `${uid()}-tasks-tests` }),
      callProject('ticktick_create_project', client, { name: `${uid()}-move-target` }),
    ]);

    testProjectId   = proj1.id;
    targetProjectId = proj2.id;

    cleanup.addProject(testProjectId);
    cleanup.addProject(targetProjectId);

    await sleep(400); // Let the API index the new projects
  });

  after(async () => {
    await cleanup.run();
  });

  // ─── CREATE ────────────────────────────────────────────────────────────────

  it('ticktick_create_task — creates a basic task with title and projectId', async () => {
    const title = `Basic task ${uid()}`;

    const task = await callTask('ticktick_create_task', client, {
      title,
      projectId: testProjectId,
    });

    cleanup.addTask(testProjectId, task.id);

    assertHasFields(assert, task, ['id', 'projectId', 'title']);
    assert.equal(task.title, title, 'Task title should match');
    assert.equal(task.projectId, testProjectId, 'Task projectId should match');
  });

  it('ticktick_create_task — creates a task with due date, priority, and content', async () => {
    const title     = `Full task ${uid()}`;
    const content   = 'This is the task body';
    const dueDate   = daysFromNow(3);
    const priority  = 3; // Medium

    const task = await callTask('ticktick_create_task', client, {
      title,
      projectId: testProjectId,
      content,
      dueDate,
      priority,
      timeZone: 'Asia/Kolkata',
    });

    cleanup.addTask(testProjectId, task.id);

    assert.equal(task.title, title);
    assert.equal(task.priority, priority, 'Priority should be 3 (Medium)');
    // Note: TickTick does not always echo dueDate in the create response;
    // we verify the task has an id and was created successfully.
    assert.ok(task.id, 'Created task should have an id');
  });

  it('ticktick_create_task — creates a task with checklist items (kind=CHECKLIST)', async () => {
    const title = `Checklist task ${uid()}`;

    const task = await callTask('ticktick_create_task', client, {
      title,
      projectId: testProjectId,
      kind: 'CHECKLIST',
      items: [
        { title: 'Sub-item 1', status: 0 },
        { title: 'Sub-item 2', status: 0 },
        { title: 'Sub-item 3', status: 0 },
      ],
    });

    cleanup.addTask(testProjectId, task.id);

    assert.equal(task.title, title);
    assert.ok(Array.isArray(task.items), 'Task should have items array');
    assert.equal(task.items.length, 3, 'Should have 3 checklist items');

    for (const item of task.items) {
      assertHasFields(assert, item, ['id', 'title']);
      assert.equal(item.status, 0, 'Items should start as incomplete');
    }
  });

  it('ticktick_create_task — creates a high-priority all-day task', async () => {
    const task = await callTask('ticktick_create_task', client, {
      title: `All-day task ${uid()}`,
      projectId: testProjectId,
      isAllDay: true,
      priority: 5, // High
      startDate: daysFromNow(1),
    });

    cleanup.addTask(testProjectId, task.id);

    assert.equal(task.priority, 5, 'Priority should be 5 (High)');
    assert.equal(task.isAllDay, true, 'isAllDay should be true');
  });

  // ─── GET ──────────────────────────────────────────────────────────────────

  it('ticktick_get_task — retrieves a task by projectId + taskId', async () => {
    const title = `Get test ${uid()}`;
    const created = await callTask('ticktick_create_task', client, {
      title,
      projectId: testProjectId,
      content: 'Retrieve me',
    });
    cleanup.addTask(testProjectId, created.id);
    await sleep(300);

    const fetched = await callTask('ticktick_get_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    assertHasFields(assert, fetched, ['id', 'title', 'projectId']);
    assert.equal(fetched.id, created.id, 'Fetched task id should match');
    assert.equal(fetched.title, title, 'Fetched task title should match');
  });

  // NOTE: TickTick returns 200 with empty body for unknown IDs instead of 404.
  it('ticktick_get_task — returns empty/null for a non-existent task id (API quirk)', async () => {
    const result = await callTask('ticktick_get_task', client, {
      projectId: testProjectId,
      taskId:    'totally_fake_task_id_xyz',
    });
    const isEmpty =
      result === null ||
      result === undefined ||
      (typeof result === 'object' && !result.id);
    assert.ok(isEmpty, `Expected empty/null for unknown task id. Got: ${JSON.stringify(result)}`);
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  it('ticktick_update_task — changes task title', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Original ${uid()}`,
      projectId: testProjectId,
    });
    cleanup.addTask(testProjectId, created.id);
    await sleep(300);

    const newTitle = `Renamed ${uid()}`;
    await callTask('ticktick_update_task', client, {
      taskId:    created.id,
      projectId: testProjectId,
      title:     newTitle,
    });

    await sleep(300);
    const fetched = await callTask('ticktick_get_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    assert.equal(fetched.title, newTitle, 'Title should be updated');
  });

  it('ticktick_update_task — changes task priority', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Priority test ${uid()}`,
      projectId: testProjectId,
      priority:  0, // None
    });
    cleanup.addTask(testProjectId, created.id);
    await sleep(300);

    await callTask('ticktick_update_task', client, {
      taskId:    created.id,
      projectId: testProjectId,
      priority:  5, // High
    });

    await sleep(300);
    const fetched = await callTask('ticktick_get_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    assert.equal(fetched.priority, 5, 'Priority should be updated to High (5)');
  });

  it('ticktick_update_task — updates checklist items and marks one complete', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Checklist update ${uid()}`,
      projectId: testProjectId,
      kind:      'CHECKLIST',
      items: [
        { title: 'Step A', status: 0 },
        { title: 'Step B', status: 0 },
      ],
    });
    cleanup.addTask(testProjectId, created.id);
    await sleep(300);

    // Mark the first item as complete by passing back the updated items
    const updatedItems = created.items.map((item, i) =>
      i === 0 ? { ...item, status: 1 } : item
    );

    await callTask('ticktick_update_task', client, {
      taskId:    created.id,
      projectId: testProjectId,
      items:     updatedItems,
    });

    await sleep(300);
    const fetched = await callTask('ticktick_get_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    const completedItem = fetched.items.find((i) => i.title === 'Step A');
    assert.equal(completedItem?.status, 1, 'Step A should be marked complete');
    const incompleteItem = fetched.items.find((i) => i.title === 'Step B');
    assert.equal(incompleteItem?.status, 0, 'Step B should still be incomplete');
  });

  // ─── COMPLETE ──────────────────────────────────────────────────────────────

  it('ticktick_complete_task — marks a task as done', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Complete me ${uid()}`,
      projectId: testProjectId,
    });
    // Don't add to cleanup tasks; completing it is enough, project cleanup will clear it
    await sleep(300);

    const result = await callTask('ticktick_complete_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    assert.ok(result !== null, 'Complete should return a response');

    // Verify via the completed-tasks endpoint
    await sleep(400);
    const completed = await callTask('ticktick_get_completed_tasks', client, {
      projectIds: [testProjectId],
      startDate:  daysAgo(1),
      endDate:    daysFromNow(1),
    });

    const found = Array.isArray(completed)
      ? completed.find((t) => t.id === created.id)
      : null;

    assert.ok(
      found !== undefined,
      `Completed task ${created.id} should appear in completed tasks list`
    );
  });

  // ─── DELETE ────────────────────────────────────────────────────────────────

  it('ticktick_delete_task — permanently removes a task', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Delete me ${uid()}`,
      projectId: testProjectId,
    });
    await sleep(300);

    await callTask('ticktick_delete_task', client, {
      projectId: testProjectId,
      taskId:    created.id,
    });

    await sleep(500);

    // Verify deletion by checking the project data — deleted task should not be present
    const projectData = await callProject('ticktick_get_project_data', client, {
      projectId: testProjectId,
    });
    const tasks = Array.isArray(projectData.tasks)
      ? projectData.tasks
      : Array.isArray(projectData)
        ? projectData
        : [];
    const stillExists = tasks.find((t) => t.id === created.id);
    assert.ok(!stillExists, 'Deleted task should not appear in project data');
  });

  // ─── MOVE ──────────────────────────────────────────────────────────────────

  it('ticktick_move_tasks — moves a task to another project', async () => {
    const created = await callTask('ticktick_create_task', client, {
      title:     `Move me ${uid()}`,
      projectId: testProjectId,
    });
    cleanup.addTask(targetProjectId, created.id); // It will live in targetProject after move
    await sleep(400);

    const result = await callTask('ticktick_move_tasks', client, {
      moves: [
        {
          taskId:        created.id,
          fromProjectId: testProjectId,
          toProjectId:   targetProjectId,
        },
      ],
    });

    assert.ok(result !== null, 'Move should return a response');

    // Verify: task should now be in the target project
    await sleep(500);
    const fetched = await callTask('ticktick_get_task', client, {
      projectId: targetProjectId,
      taskId:    created.id,
    });

    assert.equal(fetched.projectId, targetProjectId, 'Task projectId should be the new project');
  });

  it('ticktick_move_tasks — moves multiple tasks in one call', async () => {
    const [task1, task2] = await Promise.all([
      callTask('ticktick_create_task', client, {
        title: `Multi-move A ${uid()}`,
        projectId: testProjectId,
      }),
      callTask('ticktick_create_task', client, {
        title: `Multi-move B ${uid()}`,
        projectId: testProjectId,
      }),
    ]);

    cleanup.addTask(targetProjectId, task1.id);
    cleanup.addTask(targetProjectId, task2.id);
    await sleep(400);

    await callTask('ticktick_move_tasks', client, {
      moves: [
        { taskId: task1.id, fromProjectId: testProjectId, toProjectId: targetProjectId },
        { taskId: task2.id, fromProjectId: testProjectId, toProjectId: targetProjectId },
      ],
    });

    await sleep(500);

    const [f1, f2] = await Promise.all([
      callTask('ticktick_get_task', client, { projectId: targetProjectId, taskId: task1.id }),
      callTask('ticktick_get_task', client, { projectId: targetProjectId, taskId: task2.id }),
    ]);

    assert.equal(f1.projectId, targetProjectId, 'Task 1 should be in target project');
    assert.equal(f2.projectId, targetProjectId, 'Task 2 should be in target project');
  });

  // ─── COMPLETED TASKS ───────────────────────────────────────────────────────

  it('ticktick_get_completed_tasks — returns array (possibly empty) for a date range', async () => {
    const result = await callTask('ticktick_get_completed_tasks', client, {
      startDate: daysAgo(7),
      endDate:   daysFromNow(1),
    });

    assert.ok(Array.isArray(result), 'Should return an array');
  });

  it('ticktick_get_completed_tasks — filters by projectIds', async () => {
    const result = await callTask('ticktick_get_completed_tasks', client, {
      projectIds: [testProjectId],
      startDate:  daysAgo(1),
      endDate:    daysFromNow(1),
    });

    assert.ok(Array.isArray(result), 'Should return an array');
    // Any returned tasks should belong to the test project
    for (const task of result) {
      assert.equal(
        task.projectId,
        testProjectId,
        `Task ${task.id} should belong to testProjectId`
      );
    }
  });

  // ─── FILTER TASKS ──────────────────────────────────────────────────────────

  // NOTE: The /task/filter endpoint returns 500 on this API plan/tier.
  // We test that the MCP tool surfaces the error cleanly with a descriptive message.
  it('ticktick_filter_tasks — surfaces API errors cleanly (endpoint may be plan-restricted)', async () => {
    let threw = false;
    let result = null;
    try {
      result = await callTask('ticktick_filter_tasks', client, {
        projectIds: [testProjectId],
        status: 0,
      });
    } catch (err) {
      threw = true;
      // If it throws, the message must be descriptive
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.includes('TickTick API Error') || err.message.includes('500'),
        `Error should be descriptive. Got: ${err.message}`
      );
    }
    if (!threw) {
      // If it succeeded (endpoint available), result should be array-like
      assert.ok(result !== null && result !== undefined, 'Should return a non-null response');
    }
  });

  it('ticktick_filter_tasks — with priority filter: surfaces error or returns array', async () => {
    let threw = false;
    let result = null;
    try {
      result = await callTask('ticktick_filter_tasks', client, {
        projectIds: [testProjectId],
        priority:   5,
      });
    } catch (err) {
      threw = true;
      assert.ok(err instanceof Error);
      assert.ok(
        err.message.includes('TickTick API Error') || err.message.includes('500')
      );
    }
    if (!threw) {
      assert.ok(result !== null && result !== undefined);
    }
  });

});
