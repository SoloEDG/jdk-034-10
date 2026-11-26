import type { Hold, Point } from '../../../shared/types';

export type ClimberId = 'A' | 'B';
export type Side = 'L' | 'R';
export type RelayLimb = 'lh' | 'rh' | 'lf' | 'rf';
export type RelayContacts = Record<RelayLimb, string | null>;

export interface ClimberState {
  id: ClimberId;
  name: string;
  color: string;
  contacts: RelayContacts;
  energy: number;
  /** 持包手：占用后该手不能抓岩点；null 表示未持包 */
  bagHand: Side | null;
  /** 包挂在身体哪一侧，影响重心偏移方向 */
  bagSide: Side;
}

export type BagLocation =
  | { kind: 'carried'; climber: ClimberId }
  | { kind: 'hook'; hook: string };

export interface HookDef extends Point {
  id: string;
  name: string;
  finish: boolean;
}

export interface HandoffBand {
  y: number;
  fromX: number;
  toX: number;
  step: number;
}

export interface RelayScenario {
  wall: { width: number; height: number };
  tilt: number;
  startEnergy: number;
  holds: Hold[];
  hooks: HookDef[];
  handoff: HandoffBand;
  starts: Record<ClimberId, RelayContacts>;
  initialBagHook: string;
}

export type RelayFailure = 'reach' | 'support' | 'energy' | 'occupied' | 'baghand' | 'hook';

export interface MovePreview {
  actor: ClimberId;
  limb: RelayLimb;
  target: string;
  distance: number;
  reach: number;
  travel: number;
  support: number;
  landing: number;
  cost: number;
  carrying: boolean;
  failure: RelayFailure | null;
}

export interface HandoffCandidate {
  id: string;
  handle: Point;
  handA: Side;
  handB: Side;
  bagSide: Side;
  feasible: boolean;
  reasons: string[];
  switchCost: number;
  costA: number;
  costB: number;
  energyA: number;
  energyB: number;
  marginA: number;
  marginB: number;
  /** 最大化目标：两人交接后的最低剩余体力 */
  score: number | null;
}

export interface BlockedInfo {
  climber: ClimberId;
  hand: Side;
  holds: string[];
}

export interface RelayEvent {
  seq: number;
  at: number;
  kind: 'move' | 'switch' | 'park' | 'pickup' | 'handoff' | 'handoff-fail' | 'switch-fail' | 'park-fail' | 'pickup-fail' | 'deliver';
  actor: ClimberId | null;
  text: string;
  bag: { owner: ClimberId | null; point: Point; hook: string | null };
  blocked: BlockedInfo | null;
  energy: { A: number; B: number };
}
