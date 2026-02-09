export enum DiplomacyStatus {
  Neutral = 'neutral',
  Allied = 'allied',
  War = 'war',
  Peace = 'peace',
}

export interface AllianceInfo {
  id: string;
  name: string;
  leaderId: string;
  memberIds: string[];
  createdAtTick: number;
}

export interface DiplomacyRelation {
  targetPlayerId: string;
  status: DiplomacyStatus;
  changedAtTick: number;
}

export interface SpyReport {
  targetPlayerId: string;
  targetName: string;
  estimatedArmy: number; // approximate total units (+/-20% noise)
  estimatedResources: number; // approximate total resources
  era: number;
  tick: number;
}
