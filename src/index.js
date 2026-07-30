import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { createClientFromEnv } from './client.js';
import { projectTools, taskTools } from './tools/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Server Metadata
// ─────────────────────────────────────────────────────────────────────────────
const SERVER_NAME = 'ticktick-mcp';
const SERVER_VERSION = '1.0.0';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: convert our JSON Schema to Zod schema for SDK registration
// The MCP SDK v1.x accepts raw JSON schema shapes; we pass them as-is.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Converts a flat JSON Schema object properties definition to a zod shape.
 * Only handles primitive types + arrays + objects at one level deep —
 * sufficient for our API parameter shapes.
 */
function jsonSchemaToZod(schema) {
  if (!schema || !schema.properties) {
    return {};
  }

  const shape = {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType;

    if (prop.type === 'string') {
      zodType = prop.enum ? z.enum(prop.enum) : z.string();
    } else if (prop.type === 'number') {
      zodType = prop.enum
        ? z.union(prop.enum.map((v) => z.literal(v)))
        : z.number();
    } else if (prop.type === 'boolean') {
      zodType = z.boolean();
    } else if (prop.type === 'array') {
      zodType = z.array(z.any());
    } else if (prop.type === 'object') {
      zodType = z.object({}).passthrough();
    } else {
      zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return shape;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  // Validate token early and create a shared client instance
  let client;
  try {
    client = createClientFromEnv();
  } catch (err) {
    console.error(`[ticktick-mcp] ❌ ${err.message}`);
    process.exit(1);
  }

  // Create the MCP server
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all tools
  const allTools = [...projectTools, ...taskTools];

  for (const tool of allTools) {
    const zodShape = jsonSchemaToZod(tool.inputSchema);

    server.tool(
      tool.name,
      tool.description,
      zodShape,
      async (args) => {
        try {
          const result = await tool.handler(client, args);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (err) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Error: ${err.message}`,
              },
            ],
          };
        }
      }
    );
  }

  // Start the server using stdio transport (required for MCP clients like Claude Desktop)
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(
    `[ticktick-mcp] ✅ Server running with ${allTools.length} tools. Ready for connections.`
  );
}

main().catch((err) => {
  console.error(`[ticktick-mcp] Fatal error: ${err.message}`);
  process.exit(1);
});
