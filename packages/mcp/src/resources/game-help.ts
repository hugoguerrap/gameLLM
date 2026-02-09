import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const GAME_RULES = `# NODECOIN - Game Rules

## Overview
NODECOIN is a strategy game where you manage a settlement that evolves through 4 eras.
Your settlement produces resources, grows population, researches technologies, and trains armies.
The game runs in real-time ticks (1 tick = 60 seconds).

## Resources
- **Wood**: Harvested by Aserradero (Sawmill). Used for construction.
- **Food**: Produced by Granja (Farm). Consumed by population each tick.
- **Stone**: Extracted by Mina (Mine). Used for advanced buildings.
- **Iron**: Extracted by Mina (Mine). Used for military and advanced buildings.
- **Gems**: Rare resource. Used for research and special buildings.
- **Mana**: Magical energy. Produced by Templo/Observatorio. Used for arcane research.

## Eras
1. **Aldea** (Village) - Basic buildings, farming, mining
2. **Pueblo** (Town) - Military, trade, religion, espionage
3. **Ciudad** (City) - Universities, fortresses, banks, guilds
4. **Metropolis** - Wonders, portals, oracles, legendary forges

## Buildings
Buildings are constructed with resources and take several ticks to complete.
Each building can be upgraded to increase its output.
Cost scales by 1.15x per level.

### Key Buildings
- **Choza**: Housing (+5 population cap per level)
- **Granja**: Food production (+5/tick per level)
- **Aserradero**: Wood production (+4/tick per level)
- **Mina**: Stone (+3/tick) and Iron (+1/tick) per level
- **Almacen**: Increases storage capacity (+200 per level)
- **Muralla**: Defense bonus (+10 per level)
- **Cuartel**: Required to train military units

## Military
Train units at the Cuartel (Barracks). Units follow a combat triangle:
- **Soldado** (Soldier) beats **Arquero** (Archer)
- **Arquero** (Archer) beats **Caballeria** (Cavalry)
- **Caballeria** (Cavalry) beats **Soldado** (Soldier)

Advanced units: Lancero, Catapulta, Espia, Mago

## Research
Research technologies to unlock new buildings, units, and bonuses.
Technologies form a tree with prerequisites.
Only one technology can be researched at a time.

## Population
Population grows when food is abundant and housing is available.
Happiness affects growth rate.
Each citizen consumes 2 food per tick.

## NODECOIN Token
Earn NODECOIN through gameplay. Tokens are used for trades and rankings.

## Tips
1. Build a Granja and Aserradero first to ensure resource flow
2. Build Chozas to increase population cap
3. Research Agriculture and Woodworking early
4. Build an Almacen before resources hit storage cap
5. Build a Cuartel and train soldiers for defense
`;

export function registerResources(server: McpServer): void {
  server.resource(
    'game-rules',
    'nodecoin://help/rules',
    async () => ({
      contents: [
        {
          uri: 'nodecoin://help/rules',
          mimeType: 'text/markdown',
          text: GAME_RULES,
        },
      ],
    }),
  );
}
