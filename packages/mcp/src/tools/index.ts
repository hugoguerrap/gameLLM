import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { GameController } from '../game-controller.js';
import { formatStatus, formatInventory, formatNarrative } from '../formatter.js';
import {
  BuildSchema,
  UpgradeSchema,
  DemolishSchema,
  RecruitSchema,
  StrategySchema,
  ResearchSchema,
  ExploreSchema,
  ClaimSchema,
  AttackSchema,
  AllianceCreateSchema,
  AllianceJoinSchema,
  DiplomacySchema,
  SpySchema,
  TradeCreateSchema,
  TradeAcceptSchema,
  TradeCancelSchema,
  PvpAttackSchema,
  ChainInspectSchema,
} from './schemas.js';
import { BUILDING_DEFINITIONS, TECH_DEFINITIONS, UNIT_DEFINITIONS, type UnitType } from 'nodegame-mcp-engine';
import type { SharedWorldState, RankingData } from 'nodegame-mcp-network';

function getNetworkRanking(controller: GameController, playerId: string): RankingData | null {
  const nm = controller.getNetworkManager();
  if (!nm) return null;
  const sm = nm.getSyncManager();
  if (!sm) return null;
  const shared = sm.getSharedState();
  return shared.rankings[playerId] ?? null;
}

export function registerTools(server: McpServer, controller: GameController): void {
  // ── Status Tools ──────────────────────────────────────────

  server.tool(
    'game_status',
    'View the current state of your settlement: resources, buildings, population, army, research, and active effects.',
    {},
    async () => {
      const state = controller.getPlayerState();
      return { content: [{ type: 'text', text: formatStatus(state) }] };
    },
  );

  server.tool(
    'game_inventory',
    'View a detailed inventory of all your resources, army units, and NODECOIN balance.',
    {},
    async () => {
      const state = controller.getPlayerState();
      return { content: [{ type: 'text', text: formatInventory(state) }] };
    },
  );

  server.tool(
    'game_map',
    'View explored and claimed zones on the world map.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = ['=== World Map ===', ''];

      // Local zones
      if (state.exploredZones.length === 0 && state.claimedZones.length === 0) {
        lines.push('No zones explored yet. Use game_explore to discover new territories.');
      } else {
        if (state.claimedZones.length > 0) {
          lines.push('Your Claimed Zones:');
          for (const z of state.claimedZones) lines.push(`  [CLAIMED] ${z}`);
          lines.push('');
        }
        const exploredOnly = state.exploredZones.filter((z) => !state.claimedZones.includes(z));
        if (exploredOnly.length > 0) {
          lines.push('Your Explored (unclaimed):');
          for (const z of exploredOnly) lines.push(`  [EXPLORED] ${z}`);
        }
      }

      // Network zones
      const sm = controller.getNetworkManager()?.getSyncManager();
      if (sm) {
        const shared = sm.getSharedState() as SharedWorldState;
        const zones = Object.entries(shared.zones ?? {});
        const otherZones = zones.filter(([, data]) => {
          return data.claimedBy && data.claimedBy !== state.id;
        });
        if (otherZones.length > 0) {
          lines.push('');
          lines.push('Other Players\' Zones:');
          for (const [zoneId, data] of otherZones) {
            const ownerName = shared.rankings?.[data.claimedBy!]?.name ?? data.claimedBy;
            lines.push(`  [${zoneId}] Claimed by ${ownerName}`);
          }
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_rankings',
    'View settlement rankings and statistics.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const totalUnits = Object.values(state.army.units).reduce((a, b) => a + b, 0);
      const totalResources = Object.values(state.resources).reduce((a, b) => a + b, 0);

      const lines: string[] = [
        '=== Your Settlement ===',
        '',
        `Settlement: ${state.name}`,
        `Era: ${state.era} | Tick: ${state.tick}`,
        `Population: ${state.population.current}`,
        `Buildings: ${state.buildings.length}`,
        `Army: ${totalUnits} units`,
        `Technologies: ${state.research.completed.length} researched`,
        `Total Resources: ${Math.floor(totalResources)}`,
        `NODECOIN: ${state.tokens.toFixed(2)}`,
        `Prestige Level: ${state.prestige.level}`,
        `Zones Claimed: ${state.claimedZones.length}`,
      ];

      // Show network rankings if available
      const sm = controller.getNetworkManager()?.getSyncManager();
      if (sm) {
        const shared = sm.getSharedState() as SharedWorldState;
        const rankings = Object.entries(shared.rankings ?? {});
        if (rankings.length > 0) {
          lines.push('');
          lines.push('=== World Rankings ===');
          lines.push('');
          const sorted = rankings.sort(([, a], [, b]) => b.tokens - a.tokens);
          for (const [playerId, data] of sorted) {
            const marker = playerId === state.id ? ' (you)' : '';
            lines.push(`  ${data.name}${marker} - Era ${data.era}, Prestige ${data.prestige}, ${data.tokens.toFixed(1)} tokens`);
          }
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Build Tools ───────────────────────────────────────────

  server.tool(
    'game_build',
    'Construct a new building. Use game_status to see available buildings. Costs resources and takes several ticks to complete.',
    BuildSchema,
    async ({ building_id }) => {
      const result = controller.build(building_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_upgrade',
    'Upgrade an existing building to the next level. Increases production/capacity.',
    UpgradeSchema,
    async ({ building_id }) => {
      const result = controller.upgrade(building_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_demolish',
    'Demolish an existing building. Refunds 50% of base resources.',
    DemolishSchema,
    async ({ building_id }) => {
      const result = controller.demolish(building_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_buildings_available',
    'List all buildings you can construct right now, based on your era and researched technologies.',
    {},
    async () => {
      controller.getPlayerState(); // catch-up
      const available = controller.getAvailableBuildings();

      if (available.length === 0) {
        return { content: [{ type: 'text', text: 'No new buildings available. Research new technologies or advance your era.' }] };
      }

      const lines = ['=== Available Buildings ===', ''];
      for (const def of available) {
        const costStr = Object.entries(def.baseCost)
          .map(([res, amt]) => `${amt} ${res}`)
          .join(', ');
        lines.push(`${def.name} (${def.id})`);
        lines.push(`  ${def.description}`);
        lines.push(`  Cost: ${costStr} | Build time: ${def.constructionTicks} ticks`);
        if (def.production) {
          const prodStr = Object.entries(def.production)
            .map(([res, amt]) => `+${amt} ${res}/tick`)
            .join(', ');
          lines.push(`  Production: ${prodStr}`);
        }
        if (def.populationCapacity) lines.push(`  Population: +${def.populationCapacity}`);
        if (def.storageBonus) lines.push(`  Storage: +${def.storageBonus}`);
        if (def.defenseBonus) lines.push(`  Defense: +${def.defenseBonus}`);
        if (def.happinessBonus) lines.push(`  Happiness: +${def.happinessBonus}`);
        lines.push('');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Research Tools ────────────────────────────────────────

  server.tool(
    'game_research',
    'Start researching a technology. Only one research can be active at a time.',
    ResearchSchema,
    async ({ tech_id }) => {
      const result = controller.research(tech_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_research_available',
    'List all technologies available for research right now.',
    {},
    async () => {
      controller.getPlayerState(); // catch-up
      const available = controller.getAvailableResearch();
      const state = controller.getPlayerState();

      const lines: string[] = ['=== Research ===', ''];

      if (state.research.current) {
        lines.push(`Currently researching: ${state.research.current} (progress: ${state.research.progress})`);
        lines.push('');
      }

      if (state.research.completed.length > 0) {
        lines.push(`Completed: ${state.research.completed.join(', ')}`);
        lines.push('');
      }

      if (available.length === 0) {
        lines.push('No new technologies available right now.');
      } else {
        lines.push('Available to research:');
        for (const tech of available) {
          const costStr = Object.entries(tech.cost)
            .filter(([, v]) => v > 0)
            .map(([res, amt]) => `${amt} ${res}`)
            .join(', ');
          lines.push(`  ${tech.name} (${tech.id})`);
          lines.push(`    ${tech.description}`);
          lines.push(`    Cost: ${costStr} | Time: ${tech.researchTicks} ticks`);
          if (tech.prerequisites.length > 0) {
            lines.push(`    Requires: ${tech.prerequisites.join(', ')}`);
          }
          lines.push('');
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Military Tools ────────────────────────────────────────

  server.tool(
    'game_recruit',
    'Recruit military units. Requires a Cuartel (Barracks).',
    RecruitSchema,
    async ({ unit_type, count }) => {
      const result = controller.recruit(unit_type, count);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_strategy',
    'Set your army combat strategy: aggressive (more damage), defensive (less damage taken), or balanced.',
    StrategySchema,
    async ({ strategy }) => {
      const result = controller.setStrategy(strategy);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_army',
    'View detailed army information including available units to recruit.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const availableUnits = controller.getAvailableUnits();

      const lines: string[] = ['=== Army ===', ''];
      lines.push(`Strategy: ${state.army.strategy}`);
      lines.push('');

      const totalUnits = Object.values(state.army.units).reduce((a, b) => a + b, 0);
      if (totalUnits === 0) {
        lines.push('No units recruited yet.');
      } else {
        lines.push('Current Forces:');
        for (const [type, count] of Object.entries(state.army.units)) {
          if (count > 0) {
            const def = UNIT_DEFINITIONS[type as keyof typeof UNIT_DEFINITIONS];
            lines.push(`  ${def.name} (${type}): ${count} | ATK:${def.attack} DEF:${def.defense} HP:${def.health}`);
          }
        }
      }
      lines.push('');

      if (availableUnits.length > 0) {
        lines.push('Available to Recruit:');
        for (const unit of availableUnits) {
          lines.push(`  ${unit.name} (${unit.type}): ${unit.cost}`);
        }
      } else {
        lines.push('Build a Cuartel (Barracks) to recruit units.');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Combat Tools ─────────────────────────────────────────

  server.tool(
    'game_attack',
    'Attack an NPC target with your army. Targets: bandits (easy), raiders (medium), dragon (hard). Requires army units.',
    AttackSchema,
    async ({ target }) => {
      const result = controller.attack(target);
      const lines = [result.message];
      if (result.data?.battleReport) {
        const report = result.data.battleReport as Record<string, unknown>;
        lines.push('');
        lines.push(`Winner: ${report.winner}`);
        if (report.attackerLosses) {
          const losses = report.attackerLosses as Record<string, number>;
          const lossStr = Object.entries(losses)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          if (lossStr) lines.push(`Your losses: ${lossStr}`);
        }
      }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: !result.success,
      };
    },
  );

  // ── Prestige Tools ──────────────────────────────────────

  server.tool(
    'game_prestige',
    'View your prestige level, legacy multiplier, ascension bonuses, and tokens earned.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = [
        '=== Prestige ===',
        '',
        `Prestige Level: ${state.prestige.level}`,
        `Legacy Multiplier: ${state.prestige.legacyMultiplier.toFixed(2)}x`,
        `Total Tokens Earned: ${state.prestige.totalTokensEarned.toFixed(2)}`,
        `Current Tokens: ${state.tokens.toFixed(2)}`,
      ];

      if (state.prestige.bonuses.length > 0) {
        lines.push('');
        lines.push('Ascension Bonuses:');
        for (const bonus of state.prestige.bonuses) {
          lines.push(`  +${(bonus.value * 100).toFixed(0)}% ${bonus.type}`);
        }
      }

      lines.push('');
      if (state.era >= 2 && state.tokens >= 500 && state.tick >= 50) {
        lines.push('You are eligible to ascend! Use game_ascend to reset with bonuses.');
      } else {
        const reqs: string[] = [];
        if (state.era < 2) reqs.push('Era >= Pueblo (2)');
        if (state.tokens < 500) reqs.push(`500 tokens (have ${state.tokens.toFixed(0)})`);
        if (state.tick < 50) reqs.push(`50 ticks (at ${state.tick})`);
        lines.push(`Ascension requires: ${reqs.join(', ')}`);
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_ascend',
    'Ascend to the next prestige level. Resets your settlement but keeps tokens, prestige bonuses, and legacy multiplier. Requires Era >= Pueblo, 500 tokens, 50 ticks.',
    {},
    async () => {
      const result = controller.ascend();
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  // ── Explore Tools ─────────────────────────────────────────

  server.tool(
    'game_explore',
    'Send explorers to discover a new zone on the world map.',
    ExploreSchema,
    async ({ zone_id }) => {
      const result = controller.explore(zone_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_claim',
    'Claim an explored zone as your territory.',
    ClaimSchema,
    async ({ zone_id }) => {
      const result = controller.claim(zone_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  // ── Market / Trade Tools ─────────────────────────────────

  server.tool(
    'game_market',
    'View the current market: your NODECOIN balance and active trade offers.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const openOffers = state.tradeOffers.filter((o) => o.status === 'open');
      const lines: string[] = [
        '=== Market ===',
        '',
        `NODECOIN Balance: ${state.tokens.toFixed(2)}`,
        '',
      ];

      // Show local offers
      if (openOffers.length === 0) {
        lines.push('Your Offers: None');
      } else {
        lines.push(`Your Offers (${openOffers.length}):`);
        for (const o of openOffers) {
          const offerStr = Object.entries(o.offering)
            .filter(([, v]) => v && v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          const wantStr = Object.entries(o.requesting)
            .filter(([, v]) => v && v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          lines.push(`  [${o.id}] Offering: ${offerStr} | Wants: ${wantStr} (expires tick ${o.expiresAtTick})`);
        }
      }

      // Show network trade offers
      const sm = controller.getNetworkManager()?.getSyncManager();
      if (sm) {
        const shared = sm.getSharedState() as SharedWorldState;
        const networkOffers = (shared.tradeOffers ?? []).filter((o) => o.from !== state.id);
        if (networkOffers.length > 0) {
          lines.push('');
          lines.push(`Network Offers (${networkOffers.length}):`);
          for (const o of networkOffers) {
            const fromName = shared.rankings?.[o.from]?.name ?? o.from;
            const offerStr = Object.entries(o.offer)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${v} ${k}`)
              .join(', ');
            const wantStr = Object.entries(o.want)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${v} ${k}`)
              .join(', ');
            lines.push(`  [${o.id}] From: ${fromName} | Offering: ${offerStr} | Wants: ${wantStr}`);
          }
        }
      }

      if (openOffers.length === 0 && !controller.getNetworkManager()?.getSyncManager()) {
        lines.push('');
        lines.push('Use game_trade_create to post a trade offer.');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_trade_create',
    'Create a trade offer. Resources you offer are escrowed until the trade completes or expires.',
    TradeCreateSchema,
    async ({ offering, requesting, expires_in_ticks }) => {
      const result = controller.createTradeOffer(offering, requesting, expires_in_ticks);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_trade_accept',
    'Accept an open trade offer. You must have the requested resources.',
    TradeAcceptSchema,
    async ({ offer_id }) => {
      const result = controller.acceptTrade(offer_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_trade_cancel',
    'Cancel one of your open trade offers. Escrowed resources are refunded.',
    TradeCancelSchema,
    async ({ offer_id }) => {
      const result = controller.cancelTrade(offer_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_trade_list',
    'List all your trade offers with their current status.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = ['=== Your Trade Offers ===', ''];

      if (state.tradeOffers.length === 0) {
        lines.push('No trade offers. Use game_trade_create to post one.');
      } else {
        for (const o of state.tradeOffers) {
          const offerStr = Object.entries(o.offering)
            .filter(([, v]) => v && v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          const wantStr = Object.entries(o.requesting)
            .filter(([, v]) => v && v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          lines.push(`[${o.status.toUpperCase()}] ${o.id}`);
          lines.push(`  Offering: ${offerStr} | Wants: ${wantStr}`);
          lines.push(`  Created tick ${o.createdAtTick}, expires tick ${o.expiresAtTick}`);
          lines.push('');
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Alliance & Diplomacy Tools ─────────────────────────

  server.tool(
    'game_alliance_create',
    'Create a new alliance. You become the leader.',
    AllianceCreateSchema,
    async ({ name }) => {
      const result = controller.createAlliance(name);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_alliance_join',
    'Join an existing alliance by ID.',
    AllianceJoinSchema,
    async ({ alliance_id, alliance_name, leader_id }) => {
      const result = controller.joinAlliance(alliance_id, alliance_name, leader_id);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_alliance_leave',
    'Leave your current alliance. If you are the leader, the alliance is disbanded.',
    {},
    async () => {
      const result = controller.leaveAlliance();
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_alliance_info',
    'View information about your current alliance.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = ['=== Your Alliance ===', ''];

      if (!state.alliance) {
        lines.push('You are not in an alliance.');
        lines.push('Use game_alliance_create to found one, or game_alliance_join to join an existing one.');
      } else {
        lines.push(`Alliance: ${state.alliance.name}`);
        lines.push(`ID: ${state.alliance.id}`);
        lines.push(`Leader: ${state.alliance.leaderId}`);
        lines.push(`Members: ${state.alliance.memberIds.length}`);
        lines.push(`Founded: tick ${state.alliance.createdAtTick}`);
      }

      // Show known alliances from network
      const nm = controller.getNetworkManager();
      const sm = nm?.getSyncManager();
      if (sm) {
        const shared = sm.getSharedState();
        const networkAlliances = Object.values(shared.alliances);
        if (networkAlliances.length > 0) {
          lines.push('');
          lines.push('=== Known Alliances (Network) ===');
          lines.push('');
          for (const a of networkAlliances) {
            lines.push(`  ${a.name} (ID: ${a.id})`);
            lines.push(`    Leader: ${a.leaderId} | Members: ${a.members.length}`);
          }
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_diplomacy',
    'Set your diplomatic stance with another player: neutral, allied, war, or peace.',
    DiplomacySchema,
    async ({ target_player_id, status }) => {
      const result = controller.setDiplomacy(target_player_id, status);
      return {
        content: [{ type: 'text', text: result.message }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_diplomacy_status',
    'View all your diplomatic relations with other players.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = ['=== Diplomacy ===', ''];

      if (state.diplomacy.length === 0) {
        lines.push('No diplomatic relations established.');
        lines.push('Use game_diplomacy to set your stance with other players.');
      } else {
        for (const d of state.diplomacy) {
          lines.push(`  ${d.targetPlayerId}: ${d.status} (since tick ${d.changedAtTick})`);
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_spy',
    'Send a spy to gather intelligence on another player. Requires a Spy unit and has a 10-tick cooldown.',
    SpySchema,
    async ({ target_player_id, target_name, target_army, target_resources, target_era }) => {
      // Auto-fill from network rankings when parameters are omitted
      const ranking = getNetworkRanking(controller, target_player_id);
      const resolvedName = target_name ?? ranking?.name ?? 'Unknown';
      const resolvedArmy = target_army ?? ranking?.totalArmy ?? 0;
      const resolvedResources = target_resources ?? ranking?.totalResources ?? 0;
      const resolvedEra = target_era ?? ranking?.era ?? 1;

      const result = controller.spy(target_player_id, resolvedName, resolvedArmy, resolvedResources, resolvedEra);
      const lines = [result.message];
      if (result.data?.report) {
        const report = result.data.report as Record<string, unknown>;
        lines.push('');
        lines.push(`  Target: ${report.targetName}`);
        lines.push(`  Est. Army: ~${report.estimatedArmy} units`);
        lines.push(`  Est. Resources: ~${report.estimatedResources}`);
        lines.push(`  Era: ${report.era}`);
        if (ranking?.armyUnits) {
          const unitBreakdown = Object.entries(ranking.armyUnits)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          if (unitBreakdown) lines.push(`  Army composition: ${unitBreakdown}`);
        }
        if (ranking?.strategy) lines.push(`  Strategy: ${ranking.strategy}`);
        if (ranking?.allianceName) lines.push(`  Alliance: ${ranking.allianceName}`);
      }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: !result.success,
      };
    },
  );

  server.tool(
    'game_spy_reports',
    'View your collected spy reports.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const lines: string[] = ['=== Spy Reports ===', ''];

      if (state.spyReports.length === 0) {
        lines.push('No spy reports. Use game_spy to gather intelligence.');
      } else {
        for (const r of state.spyReports) {
          lines.push(`[Tick ${r.tick}] ${r.targetName} (${r.targetPlayerId})`);
          lines.push(`  Est. Army: ~${r.estimatedArmy} | Est. Resources: ~${r.estimatedResources} | Era: ${r.era}`);
          lines.push('');
        }
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── PvP Combat Tools ──────────────────────────────────

  server.tool(
    'game_pvp_attack',
    'Attack another player. Requires army units. 20-tick cooldown per target. Target data comes from spy reports or network.',
    PvpAttackSchema,
    async ({ target_player_id, target_army, target_strategy, target_defense_bonus }) => {
      // Auto-fill target data from network rankings when not provided
      let resolvedArmy = target_army as Record<UnitType, number> | undefined;
      let resolvedStrategy = target_strategy;
      let resolvedDefenseBonus = target_defense_bonus;

      if (!resolvedArmy) {
        const ranking = getNetworkRanking(controller, target_player_id);
        if (ranking?.armyUnits) {
          resolvedArmy = ranking.armyUnits as Record<UnitType, number>;
        } else {
          return {
            content: [{ type: 'text', text: 'Target army data not available. Provide target_army or use game_spy first to gather intelligence.' }],
            isError: true,
          };
        }
        if (ranking?.strategy) resolvedStrategy = ranking.strategy as typeof target_strategy;
        if (ranking?.defenseBonus != null) resolvedDefenseBonus = ranking.defenseBonus;
      }

      const result = controller.pvpAttack(
        target_player_id,
        resolvedArmy,
        resolvedStrategy,
        resolvedDefenseBonus,
      );
      const lines = [result.message];
      if (result.data?.battleReport) {
        const report = result.data.battleReport as Record<string, unknown>;
        lines.push('');
        lines.push(`Winner: ${report.winner}`);
        if (report.attackerLosses) {
          const losses = report.attackerLosses as Record<string, number>;
          const lossStr = Object.entries(losses)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${v} ${k}`)
            .join(', ');
          if (lossStr) lines.push(`Your losses: ${lossStr}`);
        }
        if (report.loot) {
          const loot = report.loot as Record<string, number>;
          if (loot.tokens > 0) lines.push(`Loot: ${loot.tokens} tokens`);
        }
      }
      return {
        content: [{ type: 'text', text: lines.join('\n') }],
        isError: !result.success,
      };
    },
  );

  // ── Blockchain Tools ─────────────────────────────────────

  server.tool(
    'game_chain_status',
    'View your command blockchain status: chain length, head hash, genesis hash.',
    {},
    async () => {
      const status = controller.getChainStatus();
      const lines = [
        '=== Command Chain Status ===',
        '',
        `Chain Length: ${status.length} blocks`,
        `Head Hash: ${status.headHash || '(empty)'}`,
        `Genesis Hash: ${status.genesisHash || '(none)'}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_chain_verify',
    'Verify your command blockchain integrity: checks hash links, signatures, and sequential indices.',
    {},
    async () => {
      const result = controller.verifyChain();
      const lines = ['=== Chain Verification ===', ''];
      if (result.valid) {
        lines.push('Status: VALID');
        lines.push('All block hashes, signatures, and links verified.');
      } else {
        lines.push('Status: INVALID');
        if (result.failedAtIndex !== undefined) {
          lines.push(`Failed at block: #${result.failedAtIndex}`);
        }
        if (result.error) {
          lines.push(`Error: ${result.error}`);
        }
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  server.tool(
    'game_chain_inspect',
    'Inspect recent blocks in your command blockchain.',
    { count: ChainInspectSchema.count },
    async ({ count }) => {
      const blocks = controller.getChainBlocks(count);
      if (blocks.length === 0) {
        return { content: [{ type: 'text', text: 'No blocks in chain.' }] };
      }
      const lines = [`=== Last ${blocks.length} Blocks ===`, ''];
      for (const b of blocks) {
        lines.push(`Block #${b.index} [${b.command.type}]`);
        lines.push(`  Hash: ${b.hash.slice(0, 16)}...`);
        lines.push(`  PrevHash: ${b.prevHash ? b.prevHash.slice(0, 16) + '...' : '(genesis)'}`);
        lines.push(`  Tick: ${b.command.tick}`);
        lines.push(`  StateHash: ${b.stateHash.slice(0, 16)}...`);
        lines.push(`  Args: ${JSON.stringify(b.command.args)}`);
        lines.push('');
      }
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ── Meta Tools ────────────────────────────────────────────

  server.tool(
    'game_node_status',
    'View the status of your NODECOIN game node.',
    {},
    async () => {
      const state = controller.getPlayerState();
      const clock = controller.getClock();
      const now = Date.now();
      const uptimeMs = now - clock.getStartTime();
      const uptimeMin = Math.floor(uptimeMs / 60000);
      const uptimeHrs = Math.floor(uptimeMin / 60);

      const allianceStr = state.alliance ? state.alliance.name : 'None';
      const lines: string[] = [
        '=== Node Status ===',
        '',
        `Player: ${state.name} (${state.id})`,
        `Current Tick: ${state.tick}`,
        `Uptime: ${uptimeHrs}h ${uptimeMin % 60}m`,
        `Tick Duration: ${clock.getTickDuration() / 1000}s`,
        `Biome: ${state.biome}`,
        `Era: ${state.era}`,
        `NODECOIN: ${state.tokens.toFixed(2)}`,
        `Alliance: ${allianceStr}`,
        `Diplomacy Relations: ${state.diplomacy.length}`,
        `Trade Offers: ${state.tradeOffers.filter((o) => o.status === 'open').length} open`,
        '',
      ];

      const nm = controller.getNetworkManager();
      if (nm && nm.isRunning()) {
        const netStatus = nm.getStatus();
        lines.push('=== Network ===');
        lines.push(`Status: Online`);
        lines.push(`Peer ID: ${netStatus.peerId}`);
        lines.push(`Addresses: ${netStatus.multiaddrs.join(', ') || '(none)'}`);
        lines.push(`Connected Peers: ${netStatus.peerCount}`);
        if (netStatus.peers.length > 0) {
          lines.push('');
          lines.push('Peers:');
          for (const peer of netStatus.peers) {
            const name = peer.name || '(unknown)';
            const ago = Math.floor((now - peer.lastSeen) / 1000);
            lines.push(`  ${name} (${peer.peerId.slice(0, 12)}...) - last seen ${ago}s ago`);
          }
        }
      } else {
        lines.push('Network: P2P disabled');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
