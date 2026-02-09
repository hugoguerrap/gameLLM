import { describe, it, expect } from 'vitest';
import * as Automerge from '@automerge/automerge';
import {
  createSharedState,
  updateRanking,
  addZoneDiscovery,
  claimZone,
  addCombatLog,
  addTradeOffer,
  removeTradeOffer,
  getChanges,
  saveState,
  loadState,
  applyChanges,
  mergeStates,
  type SharedWorldState,
  type RankingData,
  type CombatLogEntry,
  type TradeOffer,
} from '../../../src/sync/state-sync.js';

describe('state-sync', () => {
  describe('createSharedState', () => {
    it('creates a valid Automerge document with empty collections', () => {
      const doc = createSharedState();
      expect(doc.zones).toEqual({});
      expect(doc.rankings).toEqual({});
      expect(doc.tradeOffers).toEqual([]);
      expect(doc.combatLogs).toEqual([]);
    });
  });

  describe('updateRanking', () => {
    it('adds a new player ranking', () => {
      let doc = createSharedState();
      const data: RankingData = {
        name: 'Ironforge',
        era: 2,
        prestige: 150,
        tokens: 500,
      };

      doc = updateRanking(doc, 'player-1', data);

      expect(doc.rankings['player-1']).toBeDefined();
      expect(doc.rankings['player-1'].name).toBe('Ironforge');
      expect(doc.rankings['player-1'].era).toBe(2);
      expect(doc.rankings['player-1'].prestige).toBe(150);
      expect(doc.rankings['player-1'].tokens).toBe(500);
    });

    it('updates an existing player ranking', () => {
      let doc = createSharedState();
      doc = updateRanking(doc, 'player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      doc = updateRanking(doc, 'player-1', {
        name: 'Ironforge',
        era: 2,
        prestige: 50,
        tokens: 300,
      });

      expect(doc.rankings['player-1'].era).toBe(2);
      expect(doc.rankings['player-1'].prestige).toBe(50);
      expect(doc.rankings['player-1'].tokens).toBe(300);
    });

    it('supports multiple players', () => {
      let doc = createSharedState();
      doc = updateRanking(doc, 'player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });
      doc = updateRanking(doc, 'player-2', {
        name: 'Verdantia',
        era: 1,
        prestige: 10,
        tokens: 200,
      });

      expect(Object.keys(doc.rankings)).toHaveLength(2);
      expect(doc.rankings['player-1'].name).toBe('Ironforge');
      expect(doc.rankings['player-2'].name).toBe('Verdantia');
    });
  });

  describe('addZoneDiscovery', () => {
    it('creates a new zone when discovering an unknown zone', () => {
      let doc = createSharedState();
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-1');

      expect(doc.zones['zone-A1']).toBeDefined();
      expect(doc.zones['zone-A1'].claimedBy).toBeNull();
      expect(doc.zones['zone-A1'].discoveredBy).toContain('player-1');
    });

    it('adds a second discoverer to an existing zone', () => {
      let doc = createSharedState();
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-1');
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-2');

      expect(doc.zones['zone-A1'].discoveredBy).toHaveLength(2);
      expect(doc.zones['zone-A1'].discoveredBy).toContain('player-1');
      expect(doc.zones['zone-A1'].discoveredBy).toContain('player-2');
    });

    it('does not duplicate a discoverer', () => {
      let doc = createSharedState();
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-1');
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-1');

      expect(doc.zones['zone-A1'].discoveredBy).toHaveLength(1);
    });
  });

  describe('claimZone', () => {
    it('creates and claims a new zone', () => {
      let doc = createSharedState();
      doc = claimZone(doc, 'zone-B2', 'player-1');

      expect(doc.zones['zone-B2'].claimedBy).toBe('player-1');
      expect(doc.zones['zone-B2'].discoveredBy).toContain('player-1');
    });

    it('claims an existing zone', () => {
      let doc = createSharedState();
      doc = addZoneDiscovery(doc, 'zone-B2', 'player-1');
      doc = claimZone(doc, 'zone-B2', 'player-2');

      expect(doc.zones['zone-B2'].claimedBy).toBe('player-2');
      expect(doc.zones['zone-B2'].discoveredBy).toContain('player-1');
      expect(doc.zones['zone-B2'].discoveredBy).toContain('player-2');
    });

    it('can reassign a zone to a different player', () => {
      let doc = createSharedState();
      doc = claimZone(doc, 'zone-B2', 'player-1');
      doc = claimZone(doc, 'zone-B2', 'player-2');

      expect(doc.zones['zone-B2'].claimedBy).toBe('player-2');
    });
  });

  describe('addCombatLog', () => {
    it('adds a combat log entry', () => {
      let doc = createSharedState();
      const log: CombatLogEntry = {
        attacker: 'player-1',
        defender: 'player-2',
        winner: 'player-1',
        tick: 42,
      };

      doc = addCombatLog(doc, log);

      expect(doc.combatLogs).toHaveLength(1);
      expect(doc.combatLogs[0].attacker).toBe('player-1');
      expect(doc.combatLogs[0].winner).toBe('player-1');
      expect(doc.combatLogs[0].tick).toBe(42);
    });

    it('trims to 100 entries when exceeding limit', () => {
      let doc = createSharedState();

      for (let i = 0; i < 105; i++) {
        doc = addCombatLog(doc, {
          attacker: 'player-1',
          defender: 'player-2',
          winner: 'player-1',
          tick: i,
        });
      }

      expect(doc.combatLogs.length).toBe(100);
      // Oldest entries should have been trimmed; first remaining is tick 5
      expect(doc.combatLogs[0].tick).toBe(5);
      expect(doc.combatLogs[99].tick).toBe(104);
    });
  });

  describe('addTradeOffer', () => {
    it('adds a trade offer', () => {
      let doc = createSharedState();
      const offer: TradeOffer = {
        id: 'trade-1',
        from: 'player-1',
        offer: { wood: 100 },
        want: { stone: 50 },
        createdAt: Date.now(),
      };

      doc = addTradeOffer(doc, offer);

      expect(doc.tradeOffers).toHaveLength(1);
      expect(doc.tradeOffers[0].id).toBe('trade-1');
      expect(doc.tradeOffers[0].offer).toEqual({ wood: 100 });
    });

    it('trims to 50 entries when exceeding limit', () => {
      let doc = createSharedState();

      for (let i = 0; i < 55; i++) {
        doc = addTradeOffer(doc, {
          id: `trade-${i}`,
          from: 'player-1',
          offer: { wood: i },
          want: { stone: i },
          createdAt: i,
        });
      }

      expect(doc.tradeOffers.length).toBe(50);
      expect(doc.tradeOffers[0].id).toBe('trade-5');
    });
  });

  describe('removeTradeOffer', () => {
    it('removes an existing trade offer by id', () => {
      let doc = createSharedState();
      doc = addTradeOffer(doc, {
        id: 'trade-1',
        from: 'player-1',
        offer: { wood: 100 },
        want: { stone: 50 },
        createdAt: Date.now(),
      });
      doc = addTradeOffer(doc, {
        id: 'trade-2',
        from: 'player-2',
        offer: { food: 200 },
        want: { gold: 10 },
        createdAt: Date.now(),
      });

      doc = removeTradeOffer(doc, 'trade-1');

      expect(doc.tradeOffers).toHaveLength(1);
      expect(doc.tradeOffers[0].id).toBe('trade-2');
    });

    it('does nothing when removing a non-existent offer', () => {
      let doc = createSharedState();
      doc = addTradeOffer(doc, {
        id: 'trade-1',
        from: 'player-1',
        offer: { wood: 100 },
        want: { stone: 50 },
        createdAt: Date.now(),
      });

      doc = removeTradeOffer(doc, 'nonexistent');
      expect(doc.tradeOffers).toHaveLength(1);
    });
  });

  describe('getChanges', () => {
    it('returns changes for a non-empty document', () => {
      let doc = createSharedState();
      doc = updateRanking(doc, 'player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      const changes = getChanges(doc);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0]).toBeInstanceOf(Uint8Array);
    });
  });

  describe('saveState / loadState', () => {
    it('round-trips a document through save and load', () => {
      let doc = createSharedState();
      doc = updateRanking(doc, 'player-1', {
        name: 'Ironforge',
        era: 2,
        prestige: 100,
        tokens: 500,
      });
      doc = addZoneDiscovery(doc, 'zone-A1', 'player-1');
      doc = claimZone(doc, 'zone-A1', 'player-1');
      doc = addCombatLog(doc, {
        attacker: 'player-1',
        defender: 'npc',
        winner: 'player-1',
        tick: 10,
      });

      const binary = saveState(doc);
      expect(binary).toBeInstanceOf(Uint8Array);

      const loaded = loadState(binary);
      expect(loaded.rankings['player-1'].name).toBe('Ironforge');
      expect(loaded.zones['zone-A1'].claimedBy).toBe('player-1');
      expect(loaded.combatLogs).toHaveLength(1);
    });
  });

  describe('applyChanges', () => {
    it('applies changes from one doc to another', () => {
      const base = createSharedState();
      let doc1 = Automerge.clone(base);
      doc1 = updateRanking(doc1, 'player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      // Get the changes that happened since the base
      const changes = Automerge.getChanges(base, doc1);

      // Apply them to a clone of the same base
      let doc2 = Automerge.clone(base);
      doc2 = applyChanges(doc2, changes);

      expect(doc2.rankings['player-1']).toBeDefined();
      expect(doc2.rankings['player-1'].name).toBe('Ironforge');
    });
  });

  describe('mergeStates', () => {
    it('merges two documents with non-conflicting changes (from common ancestor)', () => {
      const base = createSharedState();

      let doc1 = Automerge.clone(base);
      doc1 = updateRanking(doc1, 'player-1', {
        name: 'Ironforge',
        era: 1,
        prestige: 0,
        tokens: 100,
      });

      let doc2 = Automerge.clone(base);
      doc2 = updateRanking(doc2, 'player-2', {
        name: 'Verdantia',
        era: 1,
        prestige: 10,
        tokens: 200,
      });

      const merged = mergeStates(doc1, doc2);

      expect(merged.rankings['player-1']).toBeDefined();
      expect(merged.rankings['player-2']).toBeDefined();
      expect(merged.rankings['player-1'].name).toBe('Ironforge');
      expect(merged.rankings['player-2'].name).toBe('Verdantia');
    });

    it('merges documents with zone data from different peers', () => {
      const base = createSharedState();

      let doc1 = Automerge.clone(base);
      doc1 = addZoneDiscovery(doc1, 'zone-A1', 'player-1');
      doc1 = claimZone(doc1, 'zone-A1', 'player-1');

      let doc2 = Automerge.clone(base);
      doc2 = addZoneDiscovery(doc2, 'zone-B2', 'player-2');
      doc2 = claimZone(doc2, 'zone-B2', 'player-2');

      const merged = mergeStates(doc1, doc2);

      expect(merged.zones['zone-A1']).toBeDefined();
      expect(merged.zones['zone-B2']).toBeDefined();
      expect(merged.zones['zone-A1'].claimedBy).toBe('player-1');
      expect(merged.zones['zone-B2'].claimedBy).toBe('player-2');
    });

    it('merges combat logs from both peers', () => {
      const base = createSharedState();

      let doc1 = Automerge.clone(base);
      doc1 = addCombatLog(doc1, {
        attacker: 'player-1',
        defender: 'npc',
        winner: 'player-1',
        tick: 1,
      });

      let doc2 = Automerge.clone(base);
      doc2 = addCombatLog(doc2, {
        attacker: 'player-2',
        defender: 'npc',
        winner: 'player-2',
        tick: 2,
      });

      const merged = mergeStates(doc1, doc2);

      // Both combat logs should exist after merge
      expect(merged.combatLogs.length).toBe(2);
    });
  });
});
