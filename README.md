# ticktick-mcp

A stdio MCP server that exposes the TickTick task API as 14 tools, for use from Claude Desktop or any MCP client.

It authenticates with a single bearer token from an environment variable, so there is no OAuth flow to run.

## Requirements

- Node 18 or newer (`fetch` and the `node:test` runner are both assumed)
- A TickTick account
- A TickTick API access token. Register an application at [developer.ticktick.com](https://developer.ticktick.com) to obtain one. The server refuses to start without it.

## Run it

The name `ticktick-mcp` on the public npm registry belongs to an unrelated package. Install from this repository, not from npm.

```bash
git clone https://github.com/nvkudva/ticktick-mcp.git
cd ticktick-mcp
npm install
TICKTICK_ACCESS_TOKEN=your_token_here npm start
```

The process stays in the foreground and prints nothing on success — an MCP server talks over stdio, so silence means it is waiting for a client.

To wire it into Claude Desktop, add this to `claude_desktop_config.json` (`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows), using the absolute path to your clone:

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "node",
      "args": ["/absolute/path/to/ticktick-mcp/bin/ticktick-mcp.js"],
      "env": { "TICKTICK_ACCESS_TOKEN": "your_token_here" }
    }
  }
}
```

## Configuration

| Variable | Required | What it is |
|---|---|---|
| `TICKTICK_ACCESS_TOKEN` | Yes | TickTick API bearer token, sent as `Authorization: Bearer <token>` |

## How it works

Three layers. `src/client.js` holds `TickTickClient`, whose single `request()` method does all URL assembly, auth, body serialisation and status handling against `https://api.ticktick.com`; every named method is a one-line delegate. `src/tools/projects.js` and `src/tools/tasks.js` export plain arrays of `{name, description, inputSchema, handler}` — six project tools and eight task tools. `src/index.js` loops over both arrays, converts each JSON Schema to a Zod shape and registers it with the MCP SDK, wrapping every handler in one try/catch. `bin/ticktick-mcp.js` is a shebang shim that imports `src/index.js`. There is no cache, no session and no persisted state beyond the token.

Task priority is `0` none, `1` low, `3` medium, `5` high. Task status is `0` active, `2` completed.

## Status

Project and task CRUD (`get_all_projects`, `get_project`, `get_project_data`, `create_project`, `update_project`, `delete_project`, `get_task`, `create_task`, `update_task`, `complete_task`, `delete_task`) map to endpoints documented in the TickTick Open API.

Known gaps, as of 2026-09-07:

- `ticktick_move_tasks`, `ticktick_get_completed_tasks` and `ticktick_filter_tasks` call paths that are not in the documented Open API surface. They have not been confirmed to work against a live token and may return 404.
- `zod` is imported by `src/index.js` but is not declared in `package.json`. It resolves today only through npm hoisting of the SDK's own copy; pnpm or Yarn PnP will fail at import.
- The schema converter in `src/index.js` handles one level only. Nested shapes for `items` and `moves` are flattened to "array of anything", so those arguments are not validated before they reach TickTick.
- `npm test` runs live integration tests against a real account: it creates and deletes real projects and tasks, and errors without `TICKTICK_ACCESS_TOKEN`. Only the client constructor tests run offline. Do not run it against an account you care about.
- `ticktick_delete_project` and `ticktick_delete_task` are exposed with no confirmation step and no dry run. Deletion is permanent.
- Requests have no timeout, no retry and no 429 handling, so a slow upstream will hang a tool call.

## License

No licence file yet — all rights reserved. `package.json` declares MIT, but the repository carries no licence text.
