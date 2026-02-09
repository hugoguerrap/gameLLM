import {
  GameState,
  GameClock,
  TickEngine,
  ResourceSystem,
  PopulationSystem,
  BuildingSystem,
  ResearchSystem,
  EventSystem,
  CombatSystem,
  TradeSystem,
  PrestigeSystem,
  ExplorationSystem,
  MiningSystem,
  BuildCommand,
  UpgradeCommand,
  DemolishCommand,
  RecruitCommand,
  SetStrategyCommand,
  StartResearchCommand,
  ExploreCommand,
  ClaimCommand,
  AttackCommand,
  AscendCommand,
  CreateAllianceCommand,
  JoinAllianceCommand,
  LeaveAllianceCommand,
  SetDiplomacyCommand,
  SpyCommand,
  CreateTradeOfferCommand,
  AcceptTradeCommand,
  CancelTradeOfferCommand,
  PvpAttackCommand,
  BuildingId,
  UnitType,
  CombatStrategy,
  DiplomacyStatus,
  DeterministicRng,
  resolveBattle,
  BUILDING_DEFINITIONS,
  TECH_DEFINITIONS,
  UNIT_DEFINITIONS,
  BiomeType,
  ResourceType,
  type CommandResult,
  type PlayerState,
  type BuildingDefinition,
  type TechDefinition,
  type NpcTargetType,
  type ResourceMap,
} from '@nodecoin/engine';
import {
  GameDatabase,
  GameStore,
  ChainStore,
  Wallet,
  CommandChain,
  ChainValidator,
  CommandSerializer,
  computeStateHash,
  CommandType,
  type ActionBlock,
  type ChainVerificationResult,
  type NetworkManager,
  type RemoteActionHandler,
  updateRanking,
  addZoneDiscovery,
  claimZone,
  addTradeOffer,
  removeTradeOffer,
  addCombatLog,
  upsertAlliance,
  removeAlliance,
  computeDataHash,
  type RankingData,
  type TradeOffer as SharedTradeOffer,
  type AllianceData,
} from '@nodecoin/network';

export interface GameControllerOptions {
  dbPath: string;
  playerId: string;
  playerName: string;
  biome: BiomeType;
  seed: string;
  wallet?: Wallet;
}

export class GameController implements RemoteActionHandler {
  private gameState: GameState;
  private tickEngine: TickEngine;
  private gameClock: GameClock;
  private gameDb: GameDatabase;
  private gameStore: GameStore;
  private playerId: string;
  private wallet: Wallet | null;
  private commandChain: CommandChain | null;
  private chainStore: ChainStore | null;
  private networkManager: NetworkManager | null = null;

  constructor(opts: GameControllerOptions) {
    this.playerId = opts.playerId;

    // Init persistence
    this.gameDb = new GameDatabase(opts.dbPath);
    this.gameDb.migrate();
    this.gameStore = new GameStore(this.gameDb.getDb());

    // Init blockchain (optional — only if wallet provided)
    this.wallet = opts.wallet ?? null;
    if (this.wallet) {
      this.chainStore = new ChainStore(this.gameDb.getDb());
      this.commandChain = new CommandChain(this.wallet, opts.playerId);
    } else {
      this.chainStore = null;
      this.commandChain = null;
    }

    // Load or create game state
    const saved = this.gameStore.loadLatest(opts.playerId);
    const isNewGame = !saved;
    if (saved) {
      this.gameState = new GameState(saved as PlayerState);
    } else {
      this.gameState = GameState.createNew(opts.playerId, opts.playerName, opts.biome);
    }

    // Init tick engine with all systems
    this.tickEngine = new TickEngine(opts.seed);
    this.tickEngine.registerSystem(new ResourceSystem());
    this.tickEngine.registerSystem(new PopulationSystem());
    this.tickEngine.registerSystem(new BuildingSystem());
    this.tickEngine.registerSystem(new ResearchSystem());
    this.tickEngine.registerSystem(new EventSystem());
    this.tickEngine.registerSystem(new CombatSystem());
    this.tickEngine.registerSystem(new TradeSystem());
    this.tickEngine.registerSystem(new PrestigeSystem());
    this.tickEngine.registerSystem(new ExplorationSystem());
    this.tickEngine.registerSystem(new MiningSystem());

    // Init clock from game creation time
    this.gameClock = new GameClock(this.gameState.getState().createdAt);

    // Init blockchain chain
    if (this.commandChain && this.chainStore) {
      const existingBlocks = this.chainStore.loadChain(opts.playerId);
      if (existingBlocks.length > 0) {
        this.commandChain.loadChain(existingBlocks);
      } else if (isNewGame) {
        const stateHash = this.computeStateHash();
        const genesis = this.commandChain.createGenesis(
          opts.playerName,
          opts.biome,
          opts.seed,
          stateHash,
        );
        this.chainStore.saveBlock(genesis);
        this.persist();
      }
    }
  }

  // ── Network Manager ──

  setNetworkManager(nm: NetworkManager): void {
    this.networkManager = nm;
  }

  getNetworkManager(): NetworkManager | null {
    return this.networkManager;
  }

  // ── Shared State Signing ──

  private signData<T extends Record<string, unknown>>(data: T): T & { signature: string; signedBy: string } {
    if (!this.wallet) return data as T & { signature: string; signedBy: string };
    const hash = computeDataHash(data);
    const signature = this.wallet.sign(new TextEncoder().encode(hash));
    return { ...data, signature, signedBy: this.wallet.publicKeyHex };
  }

  // ── Shared State Sync ──

  private syncToSharedState(): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    const state = this.gameState.getState();
    const totalArmy = Object.values(state.army.units).reduce((a, b) => a + b, 0);
    const totalResources = Object.values(state.resources).reduce((a, b) => a + b, 0);
    const defenseBonus = CombatSystem.getDefenseBonus(this.gameState);

    const rankingData: RankingData = {
      name: state.name,
      era: state.era,
      prestige: state.prestige.level,
      tokens: state.tokens,
      totalArmy,
      totalResources,
      armyUnits: { ...state.army.units },
      strategy: state.army.strategy,
      defenseBonus,
    };
    if (state.alliance) {
      rankingData.allianceId = state.alliance.id;
      rankingData.allianceName = state.alliance.name;
    }
    sm.updateLocalPlayerData(this.playerId, this.signData(rankingData as unknown as Record<string, unknown>) as unknown as RankingData);
  }

  private syncZoneToSharedState(zoneId: string, claimed: boolean): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    let doc = sm.getSharedState();
    doc = addZoneDiscovery(doc, zoneId, this.playerId);
    if (claimed) {
      doc = claimZone(doc, zoneId, this.playerId);
    }
    sm.setDoc(doc);
  }

  private syncTradeOfferToSharedState(offerId: string, offering: Record<string, number>, requesting: Record<string, number>): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    const offerData: SharedTradeOffer = {
      id: offerId,
      from: this.playerId,
      offer: offering,
      want: requesting,
      createdAt: Date.now(),
    };
    const signed = this.signData(offerData as unknown as Record<string, unknown>) as unknown as SharedTradeOffer;

    let doc = sm.getSharedState();
    doc = addTradeOffer(doc, signed);
    sm.setDoc(doc);
  }

  private syncAllianceToSharedState(): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    const state = this.gameState.getState();
    let doc = sm.getSharedState();

    if (state.alliance) {
      const allianceData: AllianceData = {
        id: state.alliance.id,
        name: state.alliance.name,
        leaderId: state.alliance.leaderId,
        members: [...state.alliance.memberIds],
      };
      const signed = this.signData(allianceData as unknown as Record<string, unknown>) as unknown as AllianceData;
      doc = upsertAlliance(doc, signed);
    }
    sm.setDoc(doc);
  }

  private removeAllianceFromSharedState(allianceId: string): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    let doc = sm.getSharedState();
    doc = removeAlliance(doc, allianceId);
    sm.setDoc(doc);
  }

  private removeTradeOfferFromSharedState(offerId: string): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    let doc = sm.getSharedState();
    doc = removeTradeOffer(doc, offerId);
    sm.setDoc(doc);
  }

  private syncCombatToSharedState(attacker: string, defender: string, winner: string, tick: number): void {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) return;

    let doc = sm.getSharedState();
    doc = addCombatLog(doc, { attacker, defender, winner, tick });
    sm.setDoc(doc);
  }

  // ── RemoteActionHandler implementation ──

  onRemoteAcceptTrade(block: ActionBlock): void {
    const offerId = block.command.args.offerId as string | undefined;
    if (!offerId) return;

    const state = this.gameState.getState();
    const offer = state.tradeOffers.find(
      (o) => o.id === offerId && o.status === 'open',
    );
    if (!offer) return;

    // Mark offer as accepted and give us the requested resources
    const mutableState = this.gameState.getMutableState();
    const mutableOffer = mutableState.tradeOffers.find((t) => t.id === offerId);
    if (mutableOffer) {
      mutableOffer.status = 'accepted';
      // We get what we requested
      for (const [res, amt] of Object.entries(mutableOffer.requesting)) {
        if (amt && amt > 0) {
          mutableState.resources[res as keyof ResourceMap] =
            (mutableState.resources[res as keyof ResourceMap] ?? 0) + amt;
        }
      }
    }
    this.persist();
    this.removeTradeOfferFromSharedState(offerId);
  }

  onRemotePvpAttack(block: ActionBlock): void {
    const args = block.command.args;

    // We are the defender — use OUR actual local state, not what the attacker reported
    const state = this.gameState.getState();
    const totalOurArmy = Object.values(state.army.units).reduce((a, b) => a + b, 0);
    if (totalOurArmy === 0) return;

    const defenderUnits = {} as Record<UnitType, number>;
    for (const type of Object.values(UnitType)) {
      defenderUnits[type] = state.army.units[type] ?? 0;
    }
    const defenderStrategy = state.army.strategy;
    const defenderDefenseBonus = CombatSystem.getDefenseBonus(this.gameState);

    // Get attacker's army from the block (their committed state)
    const blockAttackerArmy = args.attackerArmy as Record<string, number> | undefined;
    if (!blockAttackerArmy) return;

    const attackerUnits = {} as Record<UnitType, number>;
    for (const type of Object.values(UnitType)) {
      attackerUnits[type] = blockAttackerArmy[type] ?? 0;
    }
    const blockAttackerStrategy = (args.attackerStrategy as string) ?? 'balanced';

    // Re-compute battle deterministically using the same seed the attacker used
    const attackerId = block.playerId;
    const tick = block.command.tick;
    const rng = new DeterministicRng(`pvp-${attackerId}-${this.playerId}-${tick}`);

    const report = resolveBattle(
      { units: attackerUnits, strategy: blockAttackerStrategy as CombatStrategy },
      {
        units: defenderUnits,
        strategy: defenderStrategy as CombatStrategy,
        defenseBonus: defenderDefenseBonus,
      },
      rng,
      attackerId,
      this.playerId,
    );

    // Apply defender losses to our army
    const pvpState = this.gameState.getMutableState();
    for (const [unitType, count] of Object.entries(report.defenderLosses)) {
      if (count && count > 0) {
        pvpState.army.units[unitType as UnitType] = Math.max(
          0,
          pvpState.army.units[unitType as UnitType] - count,
        );
      }
    }

    // If we lost, deduct loot tokens
    if (report.winner === 'attacker' && report.loot.tokens > 0) {
      pvpState.tokens = Math.max(0, pvpState.tokens - report.loot.tokens);
    }

    this.persist();
  }

  onRemoteDiplomacy(block: ActionBlock): void {
    const status = block.command.args.status as string | undefined;
    if (!status) return;

    const fromPlayerId = block.playerId;

    const diploState = this.gameState.getMutableState();
    const existing = diploState.diplomacy.find((d) => d.targetPlayerId === fromPlayerId);
    if (existing) {
      existing.status = status as DiplomacyStatus;
      existing.changedAtTick = diploState.tick;
    } else {
      diploState.diplomacy.push({
        targetPlayerId: fromPlayerId,
        status: status as DiplomacyStatus,
        changedAtTick: diploState.tick,
      });
    }
    this.persist();
  }

  // ── Blockchain helpers ──

  private computeStateHash(): string {
    return computeStateHash(this.gameState.getState());
  }

  private recordCommand(type: CommandType, args: Record<string, unknown>): void {
    if (!this.commandChain || !this.chainStore) return;
    const tick = this.gameState.getState().tick;
    const stateHash = this.computeStateHash();
    const payload = CommandSerializer.serialize(type, args, tick);
    const block = this.commandChain.appendBlock(payload, stateHash);
    this.chainStore.saveBlock(block);
    // Broadcast to network
    this.networkManager?.getChainBroadcaster()?.broadcastBlock(block);
  }

  private executeAndRecord(
    cmdFn: () => CommandResult,
    type: CommandType,
    args: Record<string, unknown>,
  ): CommandResult {
    this.catchUpTicks();
    const result = cmdFn();
    if (result.success) {
      this.persist();
      this.recordCommand(type, args);
      this.syncToSharedState();
    }
    return result;
  }

  // ── Chain query methods ──

  getChainStatus(): { length: number; headHash: string; genesisHash: string } {
    if (!this.commandChain) {
      return { length: 0, headHash: '', genesisHash: '' };
    }
    const blocks = this.commandChain.getBlocks();
    return {
      length: blocks.length,
      headHash: this.commandChain.getHeadHash(),
      genesisHash: blocks.length > 0 ? blocks[0].hash : '',
    };
  }

  verifyChain(): ChainVerificationResult {
    if (!this.chainStore) {
      return { valid: false, error: 'Blockchain not enabled (no wallet)' };
    }
    const blocks = this.chainStore.loadChain(this.playerId);
    if (blocks.length === 0) {
      return { valid: false, error: 'Chain is empty' };
    }
    return ChainValidator.validateStructure(blocks);
  }

  getChainBlocks(count: number = 10): ActionBlock[] {
    if (!this.chainStore) return [];
    const blocks = this.chainStore.loadChain(this.playerId);
    return blocks.slice(-count);
  }

  /** Catch up any pending ticks since last access */
  catchUpTicks(): number {
    const state = this.gameState.getState();
    const currentTick = this.gameClock.getCurrentTick();
    const pendingTicks = currentTick - state.lastTickProcessed;

    if (pendingTicks > 0) {
      this.tickEngine.processTickRange(
        this.gameState,
        state.lastTickProcessed + 1,
        currentTick,
      );
      this.persist();
    }

    return pendingTicks;
  }

  /** Persist current state to SQLite */
  persist(): void {
    const state = this.gameState.getState();
    this.gameStore.save(this.playerId, state.tick, state);
  }

  /** Get current player state (after catch-up) */
  getPlayerState(): Readonly<PlayerState> {
    this.catchUpTicks();
    return this.gameState.getState();
  }

  // ── Build commands ──

  build(buildingId: string): CommandResult {
    return this.executeAndRecord(
      () => new BuildCommand(buildingId as BuildingId).execute(this.gameState),
      CommandType.Build,
      { buildingId },
    );
  }

  upgrade(buildingId: string): CommandResult {
    return this.executeAndRecord(
      () => new UpgradeCommand(buildingId as BuildingId).execute(this.gameState),
      CommandType.Upgrade,
      { buildingId },
    );
  }

  demolish(buildingId: string): CommandResult {
    return this.executeAndRecord(
      () => new DemolishCommand(buildingId as BuildingId).execute(this.gameState),
      CommandType.Demolish,
      { buildingId },
    );
  }

  // ── Military commands ──

  recruit(unitType: string, count: number): CommandResult {
    return this.executeAndRecord(
      () => new RecruitCommand(unitType as UnitType, count).execute(this.gameState),
      CommandType.Recruit,
      { unitType, count },
    );
  }

  setStrategy(strategy: string): CommandResult {
    return this.executeAndRecord(
      () => new SetStrategyCommand(strategy as CombatStrategy).execute(this.gameState),
      CommandType.SetStrategy,
      { strategy },
    );
  }

  // ── Research commands ──

  research(techId: string): CommandResult {
    return this.executeAndRecord(
      () => new StartResearchCommand(techId).execute(this.gameState),
      CommandType.Research,
      { techId },
    );
  }

  // ── Combat commands ──

  attack(target: string): CommandResult {
    return this.executeAndRecord(
      () => new AttackCommand(target as NpcTargetType).execute(this.gameState),
      CommandType.Attack,
      { target },
    );
  }

  // ── Prestige commands ──

  ascend(): CommandResult {
    return this.executeAndRecord(
      () => new AscendCommand().execute(this.gameState),
      CommandType.Ascend,
      {},
    );
  }

  // ── Alliance & Diplomacy commands ──

  createAlliance(name: string): CommandResult {
    const result = this.executeAndRecord(
      () => new CreateAllianceCommand(name).execute(this.gameState),
      CommandType.CreateAlliance,
      { name },
    );
    if (result.success) this.syncAllianceToSharedState();
    return result;
  }

  joinAlliance(allianceId: string, allianceName: string, leaderId: string): CommandResult {
    const result = this.executeAndRecord(
      () => new JoinAllianceCommand(allianceId, allianceName, leaderId).execute(this.gameState),
      CommandType.JoinAlliance,
      { allianceId, allianceName, leaderId },
    );
    if (result.success) this.syncAllianceToSharedState();
    return result;
  }

  leaveAlliance(): CommandResult {
    // Capture alliance before leaving (for cleanup)
    const allianceBefore = this.gameState.getState().alliance;

    const result = this.executeAndRecord(
      () => new LeaveAllianceCommand().execute(this.gameState),
      CommandType.LeaveAlliance,
      {},
    );
    if (result.success && allianceBefore) {
      // If leader left, alliance is disbanded
      if (allianceBefore.leaderId === this.playerId) {
        this.removeAllianceFromSharedState(allianceBefore.id);
      } else {
        this.syncAllianceToSharedState();
      }
    }
    return result;
  }

  setDiplomacy(targetPlayerId: string, status: string): CommandResult {
    const result = this.executeAndRecord(
      () => new SetDiplomacyCommand(targetPlayerId, status as DiplomacyStatus).execute(this.gameState),
      CommandType.SetDiplomacy,
      { targetPlayerId, status },
    );
    return result;
  }

  spy(
    targetPlayerId: string,
    targetName: string,
    targetArmy: number,
    targetResources: number,
    targetEra: number,
  ): CommandResult {
    return this.executeAndRecord(
      () => new SpyCommand(targetPlayerId, targetName, targetArmy, targetResources, targetEra).execute(this.gameState),
      CommandType.Spy,
      { targetPlayerId, targetName, targetArmy, targetResources, targetEra },
    );
  }

  // ── Trade commands ──

  createTradeOffer(
    offering: Partial<ResourceMap>,
    requesting: Partial<ResourceMap>,
    expiresInTicks: number = 100,
  ): CommandResult {
    const result = this.executeAndRecord(
      () => new CreateTradeOfferCommand(offering, requesting, expiresInTicks).execute(this.gameState),
      CommandType.CreateTradeOffer,
      { offering, requesting, expiresInTicks },
    );
    if (result.success) {
      // Sync the new offer to shared state
      const state = this.gameState.getState();
      const latestOffer = state.tradeOffers[state.tradeOffers.length - 1];
      if (latestOffer) {
        this.syncTradeOfferToSharedState(
          latestOffer.id,
          offering as Record<string, number>,
          requesting as Record<string, number>,
        );
      }
    }
    return result;
  }

  acceptTrade(offerId: string): CommandResult {
    this.catchUpTicks();
    const state = this.gameState.getState();

    // Try local trade first
    const localOffer = state.tradeOffers.find(o => o.id === offerId && o.status === 'open');
    if (localOffer) {
      const cmd = new AcceptTradeCommand(offerId, state.resources);
      const result = cmd.execute(this.gameState);
      if (result.success) {
        this.persist();
        this.recordCommand(CommandType.AcceptTrade, { offerId });
        this.syncToSharedState();
        this.removeTradeOfferFromSharedState(offerId);
      }
      return result;
    }

    // Try network trade (offer exists on another player's node)
    return this.acceptNetworkTrade(offerId);
  }

  /**
   * Accept a trade offer from the shared world state (cross-node trade).
   * The offer exists on another player's node. We:
   * 1. Look up the offer in SharedWorldState
   * 2. Verify we have the requested resources
   * 3. Deduct requested resources from us (buyer)
   * 4. Add offered resources to us (buyer)
   * 5. Record & broadcast the AcceptTrade block so the seller's node can process it
   */
  private acceptNetworkTrade(offerId: string): CommandResult {
    const sm = this.networkManager?.getSyncManager();
    if (!sm) {
      return { success: false, message: `Trade offer not found: ${offerId}` };
    }

    const sharedState = sm.getSharedState();
    const networkOffer = sharedState.tradeOffers.find(o => o.id === offerId);
    if (!networkOffer) {
      return { success: false, message: `Trade offer not found: ${offerId}` };
    }

    // Can't accept your own offer
    if (networkOffer.from === this.playerId) {
      return { success: false, message: 'Cannot accept your own trade offer' };
    }

    // Verify we have the requested resources
    for (const [resource, amount] of Object.entries(networkOffer.want)) {
      if (amount && amount > 0) {
        const state = this.gameState.getState();
        const available = state.resources[resource as ResourceType] ?? 0;
        if (available < amount) {
          return {
            success: false,
            message: `Insufficient ${resource} (need ${amount}, have ${available})`,
          };
        }
      }
    }

    // Deduct requested resources from buyer (us)
    const mutable = this.gameState.getMutableState();
    for (const [resource, amount] of Object.entries(networkOffer.want)) {
      if (amount && amount > 0) {
        mutable.resources[resource as keyof ResourceMap] =
          Math.max(0, (mutable.resources[resource as keyof ResourceMap] ?? 0) - amount);
      }
    }

    // Add offered resources to buyer (us)
    for (const [resource, amount] of Object.entries(networkOffer.offer)) {
      if (amount && amount > 0) {
        mutable.resources[resource as keyof ResourceMap] =
          (mutable.resources[resource as keyof ResourceMap] ?? 0) + amount;
      }
    }

    this.persist();
    this.recordCommand(CommandType.AcceptTrade, { offerId });
    this.syncToSharedState();
    this.removeTradeOfferFromSharedState(offerId);

    return {
      success: true,
      message: `Trade accepted: received offered resources from ${networkOffer.from}`,
      data: { offerId },
    };
  }

  cancelTrade(offerId: string): CommandResult {
    const result = this.executeAndRecord(
      () => new CancelTradeOfferCommand(offerId).execute(this.gameState),
      CommandType.CancelTrade,
      { offerId },
    );
    if (result.success) {
      this.removeTradeOfferFromSharedState(offerId);
    }
    return result;
  }

  // ── PvP commands ──

  pvpAttack(
    targetPlayerId: string,
    targetArmy: Record<UnitType, number>,
    targetStrategy: string,
    targetDefenseBonus: number,
  ): CommandResult {
    // Capture attacker's army and strategy before the battle (for the defender to re-run)
    const state = this.gameState.getState();
    const attackerArmy = { ...state.army.units };
    const attackerStrategy = state.army.strategy;

    const result = this.executeAndRecord(
      () =>
        new PvpAttackCommand(
          targetPlayerId,
          targetArmy,
          targetStrategy as CombatStrategy,
          targetDefenseBonus,
        ).execute(this.gameState),
      CommandType.PvpAttack,
      { targetPlayerId, targetArmy, targetStrategy, targetDefenseBonus, attackerArmy, attackerStrategy },
    );
    if (result.success && result.data?.battleReport) {
      const report = result.data.battleReport as Record<string, unknown>;
      this.syncCombatToSharedState(
        this.playerId,
        targetPlayerId,
        report.winner as string,
        this.gameState.getState().tick,
      );
    }
    return result;
  }

  // ── Explore commands ──

  explore(zoneId: string): CommandResult {
    const result = this.executeAndRecord(
      () => new ExploreCommand(zoneId).execute(this.gameState),
      CommandType.Explore,
      { zoneId },
    );
    if (result.success) {
      this.syncZoneToSharedState(zoneId, false);
    }
    return result;
  }

  claim(zoneId: string): CommandResult {
    const result = this.executeAndRecord(
      () => new ClaimCommand(zoneId).execute(this.gameState),
      CommandType.Claim,
      { zoneId },
    );
    if (result.success) {
      this.syncZoneToSharedState(zoneId, true);
    }
    return result;
  }

  // ── Query helpers ──

  getAvailableBuildings(): BuildingDefinition[] {
    const state = this.gameState.getState();
    return Object.values(BUILDING_DEFINITIONS).filter((def) => {
      if (def.era > state.era) return false;
      if (def.techRequired && !state.research.completed.includes(def.techRequired)) return false;
      const existing = state.buildings.find((b) => b.id === def.id);
      if (existing) return false;
      return true;
    });
  }

  getUpgradeableBuildings(): Array<{ def: BuildingDefinition; currentLevel: number }> {
    const state = this.gameState.getState();
    return state.buildings
      .filter((b) => b.constructionTicksRemaining <= 0)
      .map((b) => {
        const def = BUILDING_DEFINITIONS[b.id];
        return { def, currentLevel: b.level };
      })
      .filter(({ def, currentLevel }) => currentLevel < def.maxLevel);
  }

  getAvailableResearch(): TechDefinition[] {
    const state = this.gameState.getState();
    return TECH_DEFINITIONS.filter((tech) => {
      if (state.research.completed.includes(tech.id)) return false;
      if (state.research.current === tech.id) return false;
      for (const prereq of tech.prerequisites) {
        if (!state.research.completed.includes(prereq)) return false;
      }
      return true;
    });
  }

  getAvailableUnits(): Array<{ type: UnitType; name: string; cost: string }> {
    const state = this.gameState.getState();
    const hasCuartel = state.buildings.some((b) => b.id === BuildingId.Cuartel);
    if (!hasCuartel) return [];

    return Object.values(UNIT_DEFINITIONS)
      .filter((def) => def.era <= state.era)
      .map((def) => ({
        type: def.type,
        name: def.name,
        cost: Object.entries(def.trainingCost)
          .map(([res, amt]) => `${amt} ${res}`)
          .join(', '),
      }));
  }

  /** Get the game clock for external use */
  getClock(): GameClock {
    return this.gameClock;
  }

  /** Process a single tick (for tick loop) */
  processSingleTick(): void {
    const state = this.gameState.getState();
    const nextTick = state.lastTickProcessed + 1;
    this.tickEngine.processTick(this.gameState, nextTick);
    this.persist();
  }

  /** Shutdown cleanly */
  shutdown(): void {
    this.persist();
    this.gameDb.close();
  }
}
