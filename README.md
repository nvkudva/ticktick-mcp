# ticktick-mcp

> A Model Context Protocol (MCP) server for [TickTick](https://ticktick.com), exposing all TickTick Open API endpoints as MCP tools so Claude (and any MCP-compatible AI) can manage your tasks and projects.

---

## Features

- 🗂 **Full Project Management** — list, get, create, update, delete projects
- ✅ **Full Task Management** — create, read, update, complete, delete tasks
- 🔀 **Move Tasks** — move tasks between projects
- 🔍 **Advanced Filtering** — filter tasks by project, date, priority, tag, status
- 📋 **Completed Tasks** — query completed tasks within any date range
- 🔐 **Simple Token Auth** — just set an env var, no OAuth dance needed
- ⚡ **Zero Config** — run instantly with `npx`

---

## Quick Start

### 1. Get a TickTick API Access Token

Go to [developer.ticktick.com](https://developer.ticktick.com) and register an application to obtain an access token (or use a personal access token from the dashboard).

### 2. Run with npx

```bash
TICKTICK_ACCESS_TOKEN=your_token_here npx ticktick-mcp
```

### 3. Or install globally

```bash
npm install -g ticktick-mcp
TICKTICK_ACCESS_TOKEN=your_token_here ticktick-mcp
```

---

## Claude Desktop Configuration

Add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "npx",
      "args": ["ticktick-mcp"],
      "env": {
        "TICKTICK_ACCESS_TOKEN": "your_token_here"
      }
    }
  }
}
```

The config file is located at:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `TICKTICK_ACCESS_TOKEN` | ✅ Yes | Your TickTick API access token (Bearer token) |

---

## Available Tools

### Project Tools

| Tool | Description |
|---|---|
| `ticktick_get_all_projects` | List all projects in your account |
| `ticktick_get_project` | Get a project by ID |
| `ticktick_get_project_data` | Get project with all its tasks and columns |
| `ticktick_create_project` | Create a new project |
| `ticktick_update_project` | Update project name, color, view mode, etc. |
| `ticktick_delete_project` | Delete a project (and all its tasks) |

### Task Tools

| Tool | Description |
|---|---|
| `ticktick_get_task` | Get a task by project ID and task ID |
| `ticktick_create_task` | Create a new task with full metadata |
| `ticktick_update_task` | Update any field on an existing task |
| `ticktick_complete_task` | Mark a task as completed |
| `ticktick_delete_task` | Permanently delete a task |
| `ticktick_move_tasks` | Move tasks between projects |
| `ticktick_get_completed_tasks` | Query completed tasks by date range |
| `ticktick_filter_tasks` | Advanced filtering by project, date, priority, tag, status |

---

## Task Priority Values

| Value | Level |
|---|---|
| `0` | None |
| `1` | Low |
| `3` | Medium |
| `5` | High |

## Task Status Values

| Value | Meaning |
|---|---|
| `0` | Active (Normal) |
| `2` | Completed |

---

## Example Prompts (for Claude)

Once connected, you can ask Claude things like:

- *"Show me all my TickTick projects"*
- *"Create a task called 'Review PR' in my Work project, due tomorrow with high priority"*
- *"List all tasks in the 'Personal' project"*
- *"Mark the task [task ID] as complete"*
- *"Move the task [task ID] from 'Inbox' to 'Work'"*
- *"What tasks did I complete last week?"*
- *"Find all high-priority tasks due this month"*

---

## Development

```bash
git clone <repo>
cd ticktick-mcp
npm install
TICKTICK_ACCESS_TOKEN=your_token npm run dev
```

---

## API Reference

This server implements the [TickTick Open API](https://developer.ticktick.com/docs#/openapi).

- Base URL: `https://api.ticktick.com`
- Auth: Bearer token (`Authorization: Bearer <token>`)
- Scopes: `tasks:read`, `tasks:write`
