# Code review — ticktick-mcp

A stdio MCP server that exposes 14 tools wrapping the TickTick REST API, backed by a single-class HTTP client authenticated with a bearer token from `TICKTICK_ACCESS_TOKEN`.

Read in full: `package.json`, `bin/ticktick-mcp.js`, `src/index.js`, `src/client.js`, `src/tools/projects.js`, `src/tools/tasks.js`, `tests/helpers.js`, `tests/client.test.js`, `README.md`, `.gitignore`; skimmed `tests/tasks.test.js` and `tests/projects.test.js`; did not read `package-lock.json` beyond dependency resolution.

## Architecture

Three layers, cleanly separated and small enough to hold in your head:

1. **Transport/registration** — `src/index.js`. `main()` builds one `TickTickClient`, then loops over `[...projectTools, ...taskTools]` and calls `server.tool(name, description, zodShape, handler)` (`src/index.js:86-117`). Every handler is wrapped in the same try/catch that JSON-stringifies the result or returns `{isError: true}`.
2. **Tool definitions** — `src/tools/projects.js` and `src/tools/tasks.js` export plain arrays of `{name, description, inputSchema, handler}`. Handlers are thin: they build a request body from named args and delegate.
3. **HTTP** — `src/client.js`. `TickTickClient.request()` (`src/client.js:27-79`) is the single choke point for URL assembly, auth header, body serialisation, status handling and JSON parsing. Every named method (`getAllProjects`, `createTask`, …) is a one-line delegate.

State is minimal: the access token on the client instance (`src/client.js:16`) and nothing else. There is no cache, no session, no persistence. `bin/ticktick-mcp.js` is a two-line shebang shim that imports `src/index.js` for its side effect.

**What the structure gets right.** The data-driven tool array is the correct shape for this problem — adding a tool is one object literal, and `src/index.js` never needs to change. `request()` being the only place that touches `fetch` means a timeout, retry or rate limiter can be added in one function. Handlers contain no HTTP and no MCP types, so they are testable in isolation, and the tests exploit that.

**Where it will hurt.** The weak point is `jsonSchemaToZod` (`src/index.js:23-62`), a hand-rolled and deliberately shallow JSON-Schema-to-Zod converter. It handles exactly one level. Any `array` becomes `z.array(z.any())` (`src/index.js:42`) and any `object` becomes `z.object({}).passthrough()` (`src/index.js:44-45`). The consequence is not cosmetic: the carefully written nested schemas for `items` (`src/tools/tasks.js:112-138`, `237-251`) and `moves` (`src/tools/tasks.js:329-351`) are silently discarded, so the model is told "array of anything" and no validation happens before the payload reaches TickTick. `minItems: 1` on `moves` is likewise ignored. The repo is now maintaining two schema languages — JSON Schema in the tool files, Zod at registration — and the lossy bridge between them is where every future field-shape bug will live. The fix is to write the shapes in Zod once, or to hand the raw JSON Schema to the SDK, not to keep extending the converter.

Second structural issue: the tool array carries description prose, schema, and handler in one literal, so `src/tools/tasks.js` is 449 lines of which roughly 380 are schema. That is tolerable now and will not be at 40 tools.

## Code quality

**Undeclared dependency.** `src/index.js:3` imports `zod`, which is not in `package.json` dependencies (only `@modelcontextprotocol/sdk`, `node-fetch`, `open`). It resolves today purely because npm hoists the SDK's transitive `zod@4.3.6`. Any hoisting change, a stricter installer (pnpm, yarn PnP), or an SDK release that drops or narrows its zod range breaks the server at import time with no warning.

**Endpoints that do not exist in the documented API.** `moveTasks`, `getCompletedTasks` and `filterTasks` (`src/client.js:145-162`) hit `/open/v1/task/move`, `/open/v1/task/completed` and `/open/v1/task/filter`. The TickTick Open API v1 surface referenced by the README documents only project CRUD, `/project/{id}/data`, and task get/create/update/complete/delete. Those three paths belong to the unofficial internal v2 API and are, on the documented base URL, near-certain 404s. That is three of eight task tools — `ticktick_move_tasks`, `ticktick_get_completed_tasks`, `ticktick_filter_tasks` — advertised to the model as working. They cannot be confirmed here without a live token, but nothing in the repo or the linked docs supports them.

**Unused dependency.** `open@^10.1.0` is imported nowhere in `src`, `bin` or `tests` — a leftover from an OAuth flow the README explicitly says was dropped. `node-fetch@3` is also unnecessary: `engines` requires Node >=18, which has global `fetch`.

**No request timeout, no retry, no backoff.** `src/client.js:50` calls `fetch` bare. A hung or slow TickTick response hangs the MCP tool call indefinitely, and the client has no way to cancel it. There is no handling for 429 despite this being a consumer API.

**Error handling.** The client's error path is good: it reads the body once as text, tries JSON, falls back to raw, and throws with the status code embedded (`src/client.js:57-68`). The empty-body and 204 cases are both handled (`src/client.js:53-55`, `70-72`). The registration wrapper (`src/index.js:104-114`) returns `err.message` only and drops the stack, which is right for a protocol response but leaves nothing on stderr — a failing tool call is invisible to whoever is debugging the server.

**Type discipline.** Plain JavaScript with JSDoc on the client methods and nothing on the tool handlers. No `tsconfig.json`, no `checkJs`. The JSON Schemas are the only contract, and as noted above they are not enforced.

**Duplication.** `SERVER_VERSION = '1.0.0'` (`src/index.js:11`) is copied from `package.json` and will drift. The `if (x !== undefined) body.x = x` block is written out longhand five times in `src/tools/projects.js:109-113` and `157-163`, and fourteen times in `src/tools/tasks.js:156-167` — the same shape as the loop already written in `src/tools/tasks.js:439-445`.

**`ticktick_update_task` passes unfiltered args.** `src/tools/tasks.js:261-263` does `const { taskId, ...rest } = args; const body = { id: taskId, ...rest }`. Every key the caller supplies is forwarded to the API verbatim, including keys not in the schema. It happens to work because the SDK strips unknown top-level keys, but it is the one handler that does not state its own contract, and it diverges from the explicit style used everywhere else.

**Test coverage.** 842 lines of tests across three files, and they are live integration tests against a real TickTick account. `tests/helpers.js:13-22` requires `TICKTICK_ACCESS_TOKEN`; `tests/tasks.test.js` creates two real projects and real tasks in the user's account; `tests/projects.test.js:184-196` creates and deletes a real project. There are no mocks, no fixtures, no `nock`, no fetch stub anywhere in `tests/`. Consequences: `npm test` cannot run in CI or on a fresh clone; it mutates production data; it is slow and network-flaky (`sleep` exists in `tests/helpers.js:93` specifically to avoid hammering the API). Only the four constructor tests at `tests/client.test.js:18-41` run offline — every other `describe` calls `getClient()` in `before`, so with no token the whole suite errors rather than skipping. `CleanupRegistry.run` (`tests/helpers.js:51-59`) swallows every delete failure with an empty catch, so a partial failure silently leaves orphaned `mcp-test-*` projects in the account with no signal. `tests/client.test.js:44-62` mutates `process.env` and restores it only inside the test body — an assertion failure leaves the env var deleted for every test that follows.

**Secrets and config.** Handled correctly. The token comes only from the environment, is never logged, and `.env` is gitignored. One caveat: `src/client.js:60` puts the raw upstream response body into the thrown message, which `src/index.js:110` returns to the model — if TickTick ever echoes request context in an error body, it lands in the transcript.

**Packaging.** `package.json` has empty `author`, no `repository`, no `files` allowlist and no `.npmignore`, so a publish would ship `tests/`. `"license": "MIT"` is declared but there is no `LICENSE` file in the repo.

## Risks

**Name collision on npm — the README's install instructions install someone else's code.** `package.json` declares `"name": "ticktick-mcp"`, and `ticktick-mcp` is already taken on the public registry by Jordy van Domselaar (`jordymvd`, latest `0.2.2`, repo `github.com/jordyvandomselaar/ticktick-mcp`). Every install path in `README.md` — `npx ticktick-mcp` (`README.md:28`), `npm install -g ticktick-mcp` (`README.md:34`), and the Claude Desktop config block at `README.md:44-56` — therefore downloads and runs that unrelated package, not this one. A user following the README hands their `TICKTICK_ACCESS_TOKEN` to third-party code they did not intend to run. This repo also cannot be published under that name, and its `bin` name `ticktick-mcp` collides with the other package's on global install. Both packages must be resolved: rename (a scope such as `@nvkudva/ticktick-mcp` is the cheapest fix) and correct every README instruction.

**Destructive tools with no confirmation.** `ticktick_delete_project` (`src/tools/projects.js:171-188`) deletes a project and every task in it, and `ticktick_delete_task` (`src/tools/tasks.js:296-317`) is permanent. Both are exposed to the model with nothing but a warning in the description string. A misparsed project ID is unrecoverable data loss on the user's real account. There is no dry-run, no name-confirmation argument, and no read-only mode.

**Running the test suite destroys and creates real user data.** Covered above; restating as a risk because `npm test` is the default thing a contributor runs.

**No timeout means a wedged tool call.** `src/client.js:50`. An MCP client waiting on a `fetch` with no `AbortSignal` has no recovery short of killing the server process.

**Unbounded response size.** `src/index.js:100` does `JSON.stringify(result, null, 2)` on whatever comes back. `ticktick_get_project_data` on a large project returns every task, pretty-printed, straight into the model's context with no truncation or paging.

**Version claims correctness it has not earned.** `package.json` says `1.0.0` and `README.md:3` claims the server exposes "all TickTick Open API endpoints", while three of fourteen tools point at undocumented paths and the suite cannot be run without a live account.

## Action items

| Priority | Item | File | Why |
|---|---|---|---|
| P0 | Rename the package (e.g. `@nvkudva/ticktick-mcp`) and fix every install instruction | `package.json:2`, `README.md:28,34,44-56` | `ticktick-mcp` on npm is jordymvd's package; the README makes users run a stranger's code with their TickTick token |
| P0 | Add `zod` to `dependencies` with a range matching the SDK's (`^3.25 \|\| ^4.0`) | `package.json:26-30`, `src/index.js:3` | Imported but undeclared; only resolves via npm hoisting and breaks on pnpm or any SDK dependency change |
| P0 | Verify `/open/v1/task/move`, `/task/completed`, `/task/filter` against a live token; remove the tools or document them as internal-v2 | `src/client.js:145-162`, `src/tools/tasks.js:322-448` | Three of eight task tools target paths absent from the Open API the README cites; likely 404 at runtime |
| P0 | Make the test suite runnable offline — stub `fetch` or gate live tests behind an explicit opt-in env flag | `tests/helpers.js:13-22`, `tests/tasks.test.js`, `tests/projects.test.js` | `npm test` currently creates and deletes real projects and tasks in the user's account |
| P1 | Add an `AbortSignal.timeout` to the fetch call and surface it as a configurable env var | `src/client.js:50` | No timeout means a slow upstream wedges the tool call with no recovery |
| P1 | Replace the shallow converter — define shapes in Zod directly or pass raw JSON Schema to the SDK | `src/index.js:23-62` | Nested `items` and `moves` schemas are dropped to `z.array(z.any())`; the model sees no shape and nothing is validated |
| P1 | Drop `open` from dependencies | `package.json:29` | Imported nowhere; dead weight in every install |
| P1 | Replace `node-fetch` with global `fetch` | `src/client.js:1`, `package.json:28` | `engines` already requires Node >=18; the dependency buys nothing |
| P1 | Log tool-handler errors to stderr before returning the MCP error result | `src/index.js:104-114` | Failures are currently invisible to anyone debugging the server process |
| P1 | Add a `LICENSE` file, plus `author`, `repository` and a `files` allowlist | `package.json:24-25` | MIT is declared with no licence text; a publish would ship `tests/` |
| P1 | Report cleanup failures instead of swallowing them | `tests/helpers.js:51-59` | Empty catches leave orphaned `mcp-test-*` projects in the real account with no signal |
| P1 | Restore `TICKTICK_ACCESS_TOKEN` in a `finally` or `afterEach` | `tests/client.test.js:44-62` | An assertion failure leaves the env var deleted, cascading into every later test |
| P2 | Add an opt-in guard (env flag or required confirmation arg) on the two destructive tools | `src/tools/projects.js:171-188`, `src/tools/tasks.js:296-317` | Unrecoverable deletion of real user data on a single misparsed ID |
| P2 | Truncate or page large tool results before stringifying | `src/index.js:100` | `ticktick_get_project_data` can dump an entire project into the model context unbounded |
| P2 | Read `SERVER_VERSION` from `package.json` instead of hardcoding it | `src/index.js:11` | Duplicated constant that will drift from the manifest |
| P2 | Build request bodies with a shared pick-defined-keys helper | `src/tools/projects.js:109-113,157-163`, `src/tools/tasks.js:156-167` | The same `if (x !== undefined)` line is written out ~25 times; the loop form already exists at `tasks.js:439-445` |
| P2 | Make `ticktick_update_task` name the fields it forwards | `src/tools/tasks.js:261-263` | Sole handler that spreads caller args verbatim; diverges from the explicit style used everywhere else |
| P2 | Handle 429 with backoff in `request()` | `src/client.js:57-68` | Consumer API with rate limits; the client currently turns a 429 into a hard tool failure |
| P2 | Correct the README's "all TickTick Open API endpoints" claim and pin the SDK range you actually test | `README.md:3`, `package.json:27` | Manifest says `^1.8.0` while the lock resolves `1.27.1`; a fresh install can pick up a different SDK than was ever tested |
