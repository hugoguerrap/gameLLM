import * as Automerge from '@automerge/automerge';
import { sha256 } from '@noble/hashes/sha2';
import { bytesToHex } from '@noble/hashes/utils';

/** Signature fields added to shared state data for authenticity verification. */
export interface Signed {
  /** Hex-encoded Ed25519 signature over the canonical data fields. */
  signature?: string;
  /** Hex-encoded public key of the signer. */
  signedBy?: string;
}

/** A zone on the world map that can be discovered and claimed */
export interface ZoneData {
  claimedBy: string | null;
  discoveredBy: string[];
}

/** Ranking data for a player settlement */
export interface RankingData extends Signed {
  name: string;
  era: number;
  prestige: number;
  tokens: number;
  totalArmy?: number;
  totalResources?: number;
  armyUnits?: Record<string, number>;
  strategy?: string;
  defenseBonus?: number;
  allianceId?: string;
  allianceName?: string;
}

/** A trade offer between players */
export interface TradeOffer extends Signed {
  id: string;
  from: string;
  offer: Record<string, number>;
  want: Record<string, number>;
  createdAt: number;
}

/** A combat log entry */
export interface CombatLogEntry {
  attacker: string;
  defender: string;
  winner: string;
  tick: number;
}

/** Alliance data visible to all players */
export interface AllianceData extends Signed {
  id: string;
  name: string;
  leaderId: string;
  members: string[];
}

/**
 * Compute a canonical hash of a data object (excluding signature fields).
 * Used for signing and verification.
 */
export function computeDataHash(data: Record<string, unknown>): string {
  const { signature: _s, signedBy: _k, ...rest } = data;
  const canonical = JSON.stringify(rest, Object.keys(rest).sort());
  const hash = sha256(new TextEncoder().encode(canonical));
  return bytesToHex(hash);
}

/**
 * Verify that a signed data object has a valid signature.
 * Returns true if signature is present and valid, false otherwise.
 * Pass in a verify function to avoid circular imports.
 */
export function verifySignedData(
  data: Signed & Record<string, unknown>,
  verifyFn?: (message: Uint8Array, signature: string, publicKey: string) => boolean,
): boolean {
  if (!data.signature || !data.signedBy) return false;
  if (!verifyFn) return false;
  try {
    const hash = computeDataHash(data);
    return verifyFn(
      new TextEncoder().encode(hash),
      data.signature,
      data.signedBy,
    );
  } catch {
    return false;
  }
}

/**
 * Shared world state synchronized across all peers via Automerge.
 * This does NOT contain private player state -- only publicly-visible world data.
 *
 * Uses a `type` alias (not `interface`) so it satisfies Automerge's
 * `Record<string, unknown>` constraint.
 */
export type SharedWorldState = {
  zones: Record<string, ZoneData>;
  rankings: Record<string, RankingData>;
  tradeOffers: TradeOffer[];
  combatLogs: CombatLogEntry[];
  alliances: Record<string, AllianceData>;
};

/** Maximum number of combat logs to retain */
const MAX_COMBAT_LOGS = 100;

/** Maximum number of trade offers to retain */
const MAX_TRADE_OFFERS = 50;

/**
 * Create a fresh shared world state Automerge document.
 */
export function createSharedState(): Automerge.Doc<SharedWorldState> {
  return Automerge.from<SharedWorldState>({
    zones: {},
    rankings: {},
    tradeOffers: [],
    combatLogs: [],
    alliances: {},
  });
}

/**
 * Update (or insert) ranking data for a player.
 */
export function updateRanking(
  doc: Automerge.Doc<SharedWorldState>,
  playerId: string,
  data: RankingData,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    d.rankings[playerId] = { ...data };
  });
}

/**
 * Mark a zone as discovered by a player.
 * If the zone doesn't exist it will be created.
 * A player can only appear once in the discoveredBy list.
 */
export function addZoneDiscovery(
  doc: Automerge.Doc<SharedWorldState>,
  zoneId: string,
  playerId: string,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    if (!d.zones[zoneId]) {
      d.zones[zoneId] = { claimedBy: null, discoveredBy: [playerId] };
    } else if (!d.zones[zoneId].discoveredBy.includes(playerId)) {
      d.zones[zoneId].discoveredBy.push(playerId);
    }
  });
}

/**
 * Claim a zone for a player.
 * The zone is automatically created (and discovered) if it doesn't exist yet.
 */
export function claimZone(
  doc: Automerge.Doc<SharedWorldState>,
  zoneId: string,
  playerId: string,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    if (!d.zones[zoneId]) {
      d.zones[zoneId] = { claimedBy: playerId, discoveredBy: [playerId] };
    } else {
      d.zones[zoneId].claimedBy = playerId;
      if (!d.zones[zoneId].discoveredBy.includes(playerId)) {
        d.zones[zoneId].discoveredBy.push(playerId);
      }
    }
  });
}

/**
 * Add a combat log entry.
 * Trims logs to keep at most MAX_COMBAT_LOGS entries (oldest first).
 */
export function addCombatLog(
  doc: Automerge.Doc<SharedWorldState>,
  log: CombatLogEntry,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    d.combatLogs.push({ ...log });
    while (d.combatLogs.length > MAX_COMBAT_LOGS) {
      d.combatLogs.splice(0, 1);
    }
  });
}

/**
 * Add a trade offer.
 * Trims offers to keep at most MAX_TRADE_OFFERS (oldest first).
 */
export function addTradeOffer(
  doc: Automerge.Doc<SharedWorldState>,
  offer: TradeOffer,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    d.tradeOffers.push({ ...offer });
    while (d.tradeOffers.length > MAX_TRADE_OFFERS) {
      d.tradeOffers.splice(0, 1);
    }
  });
}

/**
 * Remove a trade offer by id.
 */
export function removeTradeOffer(
  doc: Automerge.Doc<SharedWorldState>,
  offerId: string,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    const idx = d.tradeOffers.findIndex(
      (o: TradeOffer) => o.id === offerId,
    );
    if (idx !== -1) {
      d.tradeOffers.splice(idx, 1);
    }
  });
}

/**
 * Add or update an alliance in the shared state.
 */
export function upsertAlliance(
  doc: Automerge.Doc<SharedWorldState>,
  alliance: AllianceData,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    d.alliances[alliance.id] = { ...alliance };
  });
}

/**
 * Remove an alliance from the shared state (when disbanded).
 */
export function removeAlliance(
  doc: Automerge.Doc<SharedWorldState>,
  allianceId: string,
): Automerge.Doc<SharedWorldState> {
  return Automerge.change(doc, (d) => {
    delete d.alliances[allianceId];
  });
}

/**
 * Get all Automerge changes from a document (binary).
 */
export function getChanges(
  doc: Automerge.Doc<SharedWorldState>,
): Uint8Array[] {
  return Automerge.getAllChanges(doc);
}

/**
 * Save a document to a single binary blob for persistence / full-state transfer.
 */
export function saveState(
  doc: Automerge.Doc<SharedWorldState>,
): Uint8Array {
  return Automerge.save(doc);
}

/**
 * Load a document from a previously saved binary blob.
 */
export function loadState(
  data: Uint8Array,
): Automerge.Doc<SharedWorldState> {
  return Automerge.load<SharedWorldState>(data);
}

/**
 * Apply binary changes from a remote peer to a local document.
 * Returns the updated document.
 */
export function applyChanges(
  doc: Automerge.Doc<SharedWorldState>,
  changes: Uint8Array[],
): Automerge.Doc<SharedWorldState> {
  const [newDoc] = Automerge.applyChanges(doc, changes);
  return newDoc;
}

/**
 * Merge two independent Automerge documents.
 * Returns a new document containing the union of both histories.
 */
export function mergeStates(
  doc1: Automerge.Doc<SharedWorldState>,
  doc2: Automerge.Doc<SharedWorldState>,
): Automerge.Doc<SharedWorldState> {
  return Automerge.merge(doc1, doc2);
}
