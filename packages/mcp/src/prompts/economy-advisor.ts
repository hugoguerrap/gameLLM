import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GameController } from '../game-controller.js';
import { formatInventory } from '../formatter.js';

export function registerEconomyPrompt(server: McpServer, controller: GameController): void {
  server.prompt(
    'economy-advisor',
    'Get economic advice focused on resource management and trade',
    () => {
      const state = controller.getPlayerState();
      const inventory = formatInventory(state);
      const upgradeables = controller.getUpgradeableBuildings();

      const upgradeList = upgradeables
        .map(
          ({ def, currentLevel }) =>
            `- ${def.name} (Lv${currentLevel}→${currentLevel + 1}): ${def.production ? 'Production building' : def.storageBonus ? 'Storage' : 'Utility'}`,
        )
        .join('\n');

      const foodPerTick = state.population.current * 2;
      const foodProduction = state.buildings
        .filter((b) => b.constructionTicksRemaining <= 0)
        .reduce((sum, b) => {
          const prod = (b as unknown as { id: string }).id === 'granja' ? 5 * b.level : 0;
          return sum + prod;
        }, 0);

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `You are an economic advisor for a NODECOIN settlement. Analyze the economy and provide optimization recommendations.

Current Inventory:
${inventory}

Food Balance: ~${foodProduction} produced/tick vs ~${foodPerTick} consumed/tick (${foodProduction >= foodPerTick ? 'SURPLUS' : 'DEFICIT'})

Buildings Available for Upgrade:
${upgradeList || 'None'}

Population: ${state.population.current}/${state.population.max} (Happiness: ${state.population.happiness})
NODECOIN Balance: ${state.tokens.toFixed(2)}

Provide:
1. Resource bottleneck analysis
2. Top 3 economic priorities (what to build/upgrade)
3. Population management advice
4. Storage capacity warnings if any resources are near cap`,
            },
          },
        ],
      };
    },
  );
}
