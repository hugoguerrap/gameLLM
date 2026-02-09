export enum CommandType {
  Build = 'build',
  Upgrade = 'upgrade',
  Demolish = 'demolish',
  Recruit = 'recruit',
  SetStrategy = 'set_strategy',
  Research = 'research',
  Attack = 'attack',
  Ascend = 'ascend',
  CreateAlliance = 'create_alliance',
  JoinAlliance = 'join_alliance',
  LeaveAlliance = 'leave_alliance',
  SetDiplomacy = 'set_diplomacy',
  Spy = 'spy',
  CreateTradeOffer = 'create_trade_offer',
  AcceptTrade = 'accept_trade',
  CancelTrade = 'cancel_trade',
  PvpAttack = 'pvp_attack',
  Explore = 'explore',
  Claim = 'claim',
  Genesis = 'genesis',
}

export interface CommandPayload {
  type: CommandType;
  args: Record<string, unknown>;
  tick: number;
}

export interface ActionBlock {
  hash: string;
  prevHash: string;
  index: number;
  playerId: string;
  command: CommandPayload;
  stateHash: string;
  timestamp: number;
  signature: string;
  publicKey: string;
}

export interface ChainVerificationResult {
  valid: boolean;
  failedAtIndex?: number;
  error?: string;
  computedStateHash?: string;
  claimedStateHash?: string;
}

export type ChainReplayFunction = (
  genesis: CommandPayload,
  commands: Array<{ command: CommandPayload; expectedStateHash: string }>,
) => ChainVerificationResult;
