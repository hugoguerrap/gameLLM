import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GameController } from '../game-controller.js';
import { formatStatus } from '../formatter.js';

export function registerStrategyPrompt(server: McpServer, controller: GameController): void {
  server.prompt(
    'strategy-advisor',
    'Get strategic advice for your settlement based on current state',
    () => {
      const state = controller.getPlayerState();
      const availableBuildings = controller.getAvailableBuildings();
      const availableResearch = controller.getAvailableResearch();
      const status = formatStatus(state);

      const buildingList = availableBuildings
        .map((b) => `- ${b.name} (${b.id}): ${b.description}`)
        .join('\n');

      const researchList = availableResearch
        .map((t) => `- ${t.name} (${t.id}): ${t.description} [${t.researchTicks} ticks]`)
        .join('\n');

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are a strategic advisor for a NODECOIN settlement. Analyze the current state and provide actionable recommendations.

Current Settlement Status:
${status}

Available Buildings to Construct:
${buildingList || 'None available'}

Available Technologies to Research:
${researchList || 'None available'}

Based on this information, provide:
1. Your top 3 priority actions (build, research, recruit, etc.)
2. Any warnings about resource shortages or vulnerabilities
3. A brief strategic outlook for the next 50 ticks

Keep advice concise and actionable. Use the game tool names (game_build, game_research, etc.) in your recommendations.`,
            },
          },
        ],
      };
    },
  );
}
