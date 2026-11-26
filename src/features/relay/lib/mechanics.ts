import { centroid, distance, clamp } from '../../../shared/geometry';
import type { Hold, Point } from '../../../shared/types';
import { grip } from '../../wall';
import type {
  BagLocation, BlockedInfo, ClimberId, ClimberState, HandoffBand, MovePreview,
  RelayContacts, RelayLimb, RelayScenario, Side,
} from './types';
import { relayScenario as defaultScenario } from './scenario';

export const BAG = {
  weightDemand: 1.0,       // 包重增加的支撑需求
  comSideOffset: 26,       // 包挂侧造成的重心横移
  gripCarryExtra: 1,       // 携带者抓点消耗附加
  handoffCost: 4,          // 共握交接的固定动作消耗
  switchHandCost: 5,       // 更换持包手的换手消耗
  switchSideCost: 2,       // 更换包挂侧的消耗
  parkCost: 2,             // 把包挂到指定挂点的消耗
  pickupCost: 2,           // 从挂点取包的消耗
  releaseTolerance: .9,    // 移肢瞬间短暂释放的支撑容差（过渡动作）
  handReach: 168,
  footReach: 128,
} as const;

export const relayLimbNames: Record<RelayLimb, string> = {
  lh: '左手', rh: '右手', lf: '左脚', rf: '右脚',
};
export const sideNames: Record<Side, string> = { L: '左侧', R: '右侧' };
export const climberNames: Record<ClimberId, string> = { A: '攀爬者甲', B: '攀爬者乙' };

export function holdOf(id: string, scenario: RelayScenario = defaultScenario) {
  const hold = scenario.holds.find(item => item.id === id);
  if (!hold) throw new Error('未知岩点 ' + id);
  return hold;
}

export function hookOf(id: string, scenario: RelayScenario = defaultScenario) {
  const hook = scenario.hooks.find(item => item.id === id);
  if (!hook) throw new Error('未知挂点 ' + id);
  return hook;
}

function nonNull<T>(value: T | null): value is T {
  return value !== null;
}

export function isHand(limb: RelayLimb) {
  return limb === 'lh' || limb === 'rh';
}

export function limbSide(limb: RelayLimb): Side {
  return limb.startsWith('l') ? 'L' : 'R';
}

export function handLimb(side: Side): RelayLimb {
  return side === 'L' ? 'lh' : 'rh';
}

export function freeLimbs(climber: ClimberState): RelayLimb[] {
  const blocked = climber.bagHand ? handLimb(climber.bagHand) : null;
  return (['lh', 'rh', 'lf', 'rf'] as RelayLimb[]).filter(limb => limb !== blocked);
}

export function carriedBy(bag: BagLocation): ClimberId | null {
  return bag.kind === 'carried' ? bag.climber : null;
}

/** 无包时的人体重心 */
export function bodyCenter(contacts: RelayContacts, scenario: RelayScenario): Point {
  const lh = contacts.lh ? holdOf(contacts.lh, scenario) : null;
  const rh = contacts.rh ? holdOf(contacts.rh, scenario) : null;
  const lf = contacts.lf ? holdOf(contacts.lf, scenario) : null;
  const rf = contacts.rf ? holdOf(contacts.rf, scenario) : null;
  const hands = [lh, rh].filter(nonNull);
  const feet = [lf, rf].filter(nonNull);
  const handCenter = hands.length ? centroid(hands) : centroid(feet);
  const footCenter = feet.length ? centroid(feet) : centroid(hands);
  return { x: handCenter.x * .52 + footCenter.x * .48, y: handCenter.y * .53 + footCenter.y * .47 };
}

/** 计入包挂侧偏移后的有效重心 */
export function effectiveCenter(climber: ClimberState, scenario: RelayScenario): Point {
  const center = bodyCenter(climber.contacts, scenario);
  if (climber.bagHand === null) return center;
  return { x: center.x + (climber.bagSide === 'L' ? -BAG.comSideOffset : BAG.comSideOffset), y: center.y };
}

function anchors(climber: ClimberState, scenario: RelayScenario, released?: RelayLimb): Hold[] {
  return freeLimbs(climber)
    .filter(limb => limb !== released)
    .map(limb => climber.contacts[limb])
    .filter((id): id is string => id !== null)
    .map(id => holdOf(id, scenario));
}

/**
 * 支撑余量：持包时可用锚点减少、包重加压，且包挂侧偏移重心。
 * released 给定时计算移肢瞬间的过渡支撑，计入短暂释放容差；
 * 落点（无 released）仍按严格余量计算，保证“能站稳”不被放宽。
 */
export function balanceOf(
  climber: ClimberState, scenario: RelayScenario, released?: RelayLimb,
): { margin: number; span: number } {
  const points = anchors(climber, scenario, released);
  if (!points.length) return { margin: -99, span: 0 };
  const center = effectiveCenter(climber, scenario);
  const span = Math.max(...points.map(anchor => distance(center, anchor)));
  const leverage = Math.abs(center.x - centroid(points).x) / 34;
  const strength = points.reduce((sum, anchor) => sum + grip[anchor.kind].support, 0);
  const carrying = climber.bagHand !== null;
  const demand = 4.1 + scenario.tilt / 36 + leverage + Math.max(0, span - 106) / 62
    + (carrying ? BAG.weightDemand : 0);
  const tolerance = released ? BAG.releaseTolerance : 0;
  return { margin: Math.round((strength + tolerance - demand) * 10) / 10, span: Math.round(span) };
}

function originOf(center: Point, limb: RelayLimb): Point {
  const hand = isHand(limb);
  return {
    x: center.x + (limbSide(limb) === 'L' ? -18 : 18),
    y: center.y + (hand ? -33 : 26),
  };
}

export function reachLength(limb: RelayLimb, energy: number, targetKind: Hold['kind'], scenario: RelayScenario) {
  const hand = isHand(limb);
  return Math.round((hand ? BAG.handReach : BAG.footReach) + grip[targetKind].reach
    - scenario.tilt * .45 - clamp(28 - energy, 0, 28) * .45);
}

export function measureReach(climber: ClimberState, limb: RelayLimb, targetId: string, scenario: RelayScenario) {
  const hold = holdOf(targetId, scenario);
  const center = bodyCenter(climber.contacts, scenario);
  const origin = originOf(center, limb);
  const current = climber.contacts[limb] ? holdOf(climber.contacts[limb] as string, scenario) : origin;
  return {
    distance: Math.round(distance(origin, hold)),
    travel: Math.round(distance(current, hold)),
    reach: reachLength(limb, climber.energy, hold.kind, scenario),
  };
}

export function moveCost(travel: number, kind: Hold['kind'], tilt: number, supportMargin: number, carrying: boolean) {
  const reachCost = Math.max(1, Math.ceil(travel / 44));
  const leverageCost = Math.max(0, Math.ceil(2 - supportMargin));
  return 1 + reachCost + grip[kind].cost + Math.floor(tilt / 9) + leverageCost
    + (carrying ? BAG.gripCarryExtra : 0);
}

export function previewMove(
  actor: ClimberState, limb: RelayLimb, targetId: string, scenario: RelayScenario,
): MovePreview | null {
  const target = holdOf(targetId, scenario);
  const carrying = actor.bagHand !== null;
  // 持包手被占用，不能抓岩点；脚点只允许脚、手点只允许手
  if (carrying && actor.bagHand === limbSide(limb) && isHand(limb)) return null;
  if (isHand(limb) === (target.kind === 'step')) return null;
  if (Object.values(actor.contacts).includes(target.id)) return null;

  const measure = measureReach(actor, limb, targetId, scenario);
  const support = balanceOf(actor, scenario, limb);
  const landed: ClimberState = {
    ...actor,
    contacts: { ...actor.contacts, [limb]: target.id },
  };
  const landing = balanceOf(landed, scenario);
  const cost = moveCost(measure.travel, target.kind, scenario.tilt, support.margin, carrying);
  const failure = measure.distance > measure.reach ? 'reach'
    : support.margin < 0 || landing.margin < 0 ? 'support'
      : actor.energy < cost ? 'energy' : null;
  return {
    actor: actor.id, limb, target: target.id, distance: measure.distance, reach: measure.reach,
    travel: measure.travel, support: support.margin, landing: landing.margin, cost, carrying, failure,
  };
}

/** 因占手而无法使用的岩点（手点、空闲、在持包手可及范围内） */
export function blockedHolds(climber: ClimberState, scenario: RelayScenario): BlockedInfo | null {
  if (climber.bagHand === null) return null;
  const limb = handLimb(climber.bagHand);
  const occupied = new Set(Object.values(climber.contacts).filter((id): id is string => id !== null));
  const holds = scenario.holds
    .filter(hold => hold.kind !== 'step' && !occupied.has(hold.id))
    .filter(hold => measureReach(climber, limb, hold.id, scenario).distance
      <= reachLength(limb, climber.energy, hold.kind, scenario))
    .map(hold => hold.id);
  return { climber: climber.id, hand: climber.bagHand, holds };
}

export function bagPoint(bag: BagLocation, scenario: RelayScenario, climbers: Record<ClimberId, ClimberState>): Point {
  if (bag.kind === 'hook') return hookOf(bag.hook, scenario);
  const climber = climbers[bag.climber];
  const center = effectiveCenter(climber, scenario);
  return { x: center.x + (climber.bagSide === 'L' ? -30 : 30), y: center.y + 18 };
}

export function handoffHandles(band: HandoffBand): Point[] {
  const points: Point[] = [];
  for (let x = band.fromX; x <= band.toX + .001; x += band.step) {
    points.push({ x: Math.round(x), y: band.y });
  }
  return points;
}

export function handCanReachHandle(climber: ClimberState, side: Side, handle: Point, scenario: RelayScenario) {
  const center = bodyCenter(climber.contacts, scenario);
  const origin = originOf(center, handLimb(side));
  // 交接把位的“岩点”按把手点计算可及
  const reach = Math.round(BAG.handReach + grip.jug.reach - scenario.tilt * .45
    - clamp(28 - climber.energy, 0, 28) * .45);
  return { distance: Math.round(distance(origin, handle)), reach };
}

/** 持包手可及某挂点（放包 / 取包前的距离校验） */
export function handCanReachHook(climber: ClimberState, side: Side, hookId: string, scenario: RelayScenario) {
  return handCanReachHandle(climber, side, hookOf(hookId, scenario), scenario);
}

export function cloneClimber(climber: ClimberState): ClimberState {
  return { ...climber, contacts: { ...climber.contacts } };
}

export function freshClimbers(scenario: RelayScenario = defaultScenario): Record<ClimberId, ClimberState> {
  return {
    A: {
      id: 'A', name: '攀爬者甲', color: '#fdd264',
      contacts: { ...scenario.starts.A }, energy: scenario.startEnergy, bagHand: null, bagSide: 'R',
    },
    B: {
      id: 'B', name: '攀爬者乙', color: '#78dfc6',
      contacts: { ...scenario.starts.B }, energy: scenario.startEnergy, bagHand: null, bagSide: 'L',
    },
  };
}
