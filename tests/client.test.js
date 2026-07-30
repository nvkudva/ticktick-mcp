/**
 * tests/client.test.js
 *
 * Unit/integration tests for the TickTickClient HTTP layer:
 *   - Auth header injection
 *   - Error handling (4xx/5xx responses)
 *   - createClientFromEnv() validation
 *   - Correct base URL construction
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

import { TickTickClient, createClientFromEnv } from '../src/client.js';
import { getClient, sleep } from './helpers.js';

// ─────────────────────────────────────────────────────────────────────────────
describe('TickTickClient — constructor & auth', () => {

  it('throws when no token is provided', () => {
    assert.throws(
      () => new TickTickClient(undefined),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(err.message.toLowerCase().includes('token'), `Message: ${err.message}`);
        return true;
      }
    );
  });

  it('throws when empty string token is provided', () => {
    assert.throws(
      () => new TickTickClient(''),
      (err) => {
        assert.ok(err instanceof Error);
        return true;
      }
    );
  });

  it('stores the token on the instance', () => {
    const client = new TickTickClient('my-test-token');
    assert.equal(client.accessToken, 'my-test-token');
  });

  it('createClientFromEnv — throws when TICKTICK_ACCESS_TOKEN is not set', () => {
    const original = process.env.TICKTICK_ACCESS_TOKEN;
    delete process.env.TICKTICK_ACCESS_TOKEN;

    assert.throws(
      () => createClientFromEnv(),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('TICKTICK_ACCESS_TOKEN'),
          `Message should mention env var. Got: ${err.message}`
        );
        return true;
      }
    );

    // Restore
    if (original) process.env.TICKTICK_ACCESS_TOKEN = original;
  });

  it('createClientFromEnv — creates a client from env var', () => {
    const token = process.env.TICKTICK_ACCESS_TOKEN;
    if (!token) {
      // Skip if not set (this describe block runs in isolation too)
      return;
    }
    const client = createClientFromEnv();
    assert.ok(client instanceof TickTickClient, 'Should return a TickTickClient');
    assert.equal(client.accessToken, token);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TickTickClient — API error handling', () => {
  let client;

  before(() => {
    client = getClient();
  });

  it('throws a descriptive error for 404 responses', async () => {
    await assert.rejects(
      () => client.getTask('nonexistent_project', 'nonexistent_task'),
      (err) => {
        assert.ok(err instanceof Error, 'Should be an Error instance');
        assert.match(
          err.message,
          /TickTick API Error \[\d{3}\]/,
          `Error message should include status code. Got: ${err.message}`
        );
        return true;
      }
    );
  });

  // NOTE: TickTick API returns 200 with an empty/null body for unknown IDs
  // rather than a 4xx. We assert the response is null/empty rather than
  // expecting a rejection.
  it('returns null/empty for an invalid project ID (API quirk: no 404)', async () => {
    const result = await client.getProject('__invalid__');
    // Accept either null, undefined, empty object, or object without an id field
    const isEmpty =
      result === null ||
      result === undefined ||
      (typeof result === 'object' && !result.id);
    assert.ok(isEmpty, `Expected empty/null response for invalid id, got: ${JSON.stringify(result)}`);
  });

  it('throws for a bad token (401)', async () => {
    const badClient = new TickTickClient('bad_token_xyz');
    await assert.rejects(
      () => badClient.getAllProjects(),
      (err) => {
        assert.ok(err instanceof Error);
        assert.ok(
          err.message.includes('401') || err.message.includes('403') || err.message.includes('TickTick API Error'),
          `Expected auth error. Got: ${err.message}`
        );
        return true;
      }
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('TickTickClient — live connectivity', () => {
  let client;

  before(() => {
    client = getClient();
  });

  it('can reach the TickTick API and get a valid response', async () => {
    const projects = await client.getAllProjects();
    assert.ok(Array.isArray(projects), 'getAllProjects should return an array');
    assert.ok(projects.length >= 0, 'Should return zero or more projects');
  });

  it('returns projects with required shape', async () => {
    const projects = await client.getAllProjects();
    if (projects.length === 0) return; // Nothing to validate

    for (const p of projects) {
      assert.ok(typeof p.id === 'string' && p.id.length > 0, `Project id should be non-empty string: ${JSON.stringify(p)}`);
      assert.ok(typeof p.name === 'string', `Project name should be a string: ${JSON.stringify(p)}`);
    }
  });
});
