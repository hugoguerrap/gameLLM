import { z } from 'zod';

export const BuildSchema = {
  building_id: z.string().describe('The building ID to construct (e.g. "granja", "aserradero", "mina")'),
};

export const UpgradeSchema = {
  building_id: z.string().describe('The building ID to upgrade'),
};

export const DemolishSchema = {
  building_id: z.string().describe('The building ID to demolish'),
};

export const RecruitSchema = {
  unit_type: z.string().describe('Unit type to recruit (e.g. "soldier", "archer", "cavalry")'),
  count: z.number().int().min(1).max(100).default(1).describe('Number of units to recruit'),
};

export const StrategySchema = {
  strategy: z.enum(['aggressive', 'defensive', 'balanced']).describe('Combat strategy for your army'),
};

export const ResearchSchema = {
  tech_id: z.string().describe('Technology ID to research (e.g. "agriculture", "ironworking")'),
};

export const ExploreSchema = {
  zone_id: z.string().describe('Zone ID to explore (e.g. "zone_1", "zone_2")'),
};

export const ClaimSchema = {
  zone_id: z.string().describe('Zone ID to claim (must be explored first)'),
};

export const AttackSchema = {
  target: z.enum(['bandits', 'raiders', 'dragon']).describe('NPC target to attack: bandits (easy), raiders (medium), dragon (hard)'),
};

export const AscendSchema = {};

// ── Phase 3: Alliance & Diplomacy ──

export const AllianceCreateSchema = {
  name: z.string().min(1).max(50).describe('Name for the new alliance'),
};

export const AllianceJoinSchema = {
  alliance_id: z.string().describe('The alliance ID to join'),
  alliance_name: z.string().describe('Name of the alliance'),
  leader_id: z.string().describe('Player ID of the alliance leader'),
};

export const DiplomacySchema = {
  target_player_id: z.string().describe('The player ID to set diplomacy with'),
  status: z.enum(['neutral', 'allied', 'war', 'peace']).describe('Diplomacy status to set'),
};

export const SpySchema = {
  target_player_id: z.string().describe('The player ID to spy on'),
  target_name: z.string().optional().describe('Name of the target player (auto-filled from network if omitted)'),
  target_army: z.number().int().min(0).optional().describe('Estimated total army units of target (auto-filled from network if omitted)'),
  target_resources: z.number().int().min(0).optional().describe('Estimated total resources of target (auto-filled from network if omitted)'),
  target_era: z.number().int().min(1).optional().describe('Era of the target player (auto-filled from network if omitted)'),
};

// ── Phase 3: Trade ──

const ResourceAmountSchema = z.object({
  wood: z.number().min(0).optional(),
  food: z.number().min(0).optional(),
  stone: z.number().min(0).optional(),
  iron: z.number().min(0).optional(),
  gems: z.number().min(0).optional(),
  mana: z.number().min(0).optional(),
}).describe('Resource amounts');

export const TradeCreateSchema = {
  offering: ResourceAmountSchema.describe('Resources you are offering'),
  requesting: ResourceAmountSchema.describe('Resources you want in return'),
  expires_in_ticks: z.number().int().min(1).max(1000).default(100).describe('How many ticks until the offer expires'),
};

export const TradeAcceptSchema = {
  offer_id: z.string().describe('The trade offer ID to accept'),
};

export const TradeCancelSchema = {
  offer_id: z.string().describe('The trade offer ID to cancel'),
};

// ── Phase 4: Blockchain ──

export const ChainInspectSchema = {
  count: z.number().int().min(1).max(100).default(10).describe('Number of recent blocks to show'),
};

// ── Phase 3: PvP ──

export const PvpAttackSchema = {
  target_player_id: z.string().describe('The player ID to attack'),
  target_army: z.object({
    soldier: z.number().int().min(0).default(0),
    archer: z.number().int().min(0).default(0),
    cavalry: z.number().int().min(0).default(0),
    lancer: z.number().int().min(0).default(0),
    catapult: z.number().int().min(0).default(0),
    spy: z.number().int().min(0).default(0),
    mage: z.number().int().min(0).default(0),
  }).optional().describe('Target army composition (auto-filled from network if omitted)'),
  target_strategy: z.enum(['aggressive', 'defensive', 'balanced', 'guerrilla']).default('balanced').describe('Target combat strategy (auto-filled from network if omitted)'),
  target_defense_bonus: z.number().min(0).default(0).describe('Target defense bonus from buildings (auto-filled from network if omitted)'),
};
