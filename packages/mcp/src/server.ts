import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { GameController } from './game-controller.js';
import { registerTools } from './tools/index.js';
import { registerResources } from './resources/game-help.js';
import { registerStrategyPrompt } from './prompts/strategy-advisor.js';
import { registerEconomyPrompt } from './prompts/economy-advisor.js';

export function createMcpServer(controller: GameController): McpServer {
  const server = new McpServer({
    name: 'nodecoin',
    version: '0.1.0',
  });

  registerTools(server, controller);
  registerResources(server);
  registerStrategyPrompt(server, controller);
  registerEconomyPrompt(server, controller);

  return server;
}

export async function startServer(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('NODECOIN MCP Server running on stdio');
}

export { McpServer };
