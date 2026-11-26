import type { ClimberId, ClimberState, HandoffCandidate, RelayContacts, RelayLimb, RelayScenario, Side } from './types';
import { relayScenario } from './scenario';
import {
  BAG, balanceOf, handCanReachHandle, handLimb, handoffHandles,
  measureReach, moveCost, reachLength,
} from './mechanics';

export interface SwitchPlan {
  target: string;
  cost: number;
  landing: number;
  contacts: RelayContacts;
}

/** 为携带者规划更换持包手：原持包手抓向新岩点，新持包手离点握包 */
export function planHandSwitch(climber: ClimberState, newHand: Side, scenario: RelayScenario): SwitchPlan | null {
  if (climber.bagHand === null || climber.bagHand === newHand) return null;
  const oldLimb = handLimb(climber.bagHand);
  const newLimb = handLimb(newHand);
  const released = climber.contacts[newLimb];
  if (!released) return null;
  const occupied = new Set(Object.values(climber.contacts).filter((id): id is string => id !== null));
  let best: SwitchPlan | null = null;
  for (const hold of scenario.holds) {
    if (hold.kind === 'step' || occupied.has(hold.id)) continue;
    const measure = measureReach(climber, oldLimb, hold.id, scenario);
    if (measure.distance > reachLength(oldLimb, climber.energy, hold.kind, scenario)) continue;
    const contacts: RelayContacts = { ...climber.contacts, [newLimb]: null, [oldLimb]: hold.id };
    const switched: ClimberState = { ...climber, contacts, bagHand: newHand };
    const landing = balanceOf(switched, scenario);
    if (landing.margin < 0) continue;
    const cost = BAG.switchHandCost + moveCost(measure.travel, hold.kind, scenario.tilt, landing.margin, true);
    if (climber.energy < cost) continue;
    if (!best || landing.margin > best.landing || (landing.margin === best.landing && cost < best.cost)) {
      best = { target: hold.id, cost, landing: landing.margin, contacts };
    }
  }
  return best;
}

function anchorHolds(climber: ClimberState, gripHand: Side | null): Set<string> {
  const blocked = gripHand ? handLimb(gripHand) : null;
  return new Set((Object.keys(climber.contacts) as RelayLimb[])
    .filter(limb => limb !== blocked)
    .map(limb => climber.contacts[limb])
    .filter((id): id is string => id !== null));
}

/**
 * 枚举指定高度把位上所有可执行交接姿态：
 * 两边分别可达 ≠ 两人同时能站稳，因此逐组合校验共握时的三肢支撑、岩点互斥与体力。
 */
export function planHandoffs(
  climbers: Record<ClimberId, ClimberState>, scenario: RelayScenario = relayScenario,
): HandoffCandidate[] {
  const carrier = climbers.A.bagHand !== null ? 'A' : climbers.B.bagHand !== null ? 'B' : null;
  const candidates: HandoffCandidate[] = [];
  if (!carrier) return candidates;
  const sides: Side[] = ['L', 'R'];

  for (const handle of handoffHandles(scenario.handoff)) {
    for (const handA of sides) {
      for (const handB of sides) {
        for (const bagSide of sides) {
          const reasons: string[] = [];
          const A = climbers.A;
          const B = climbers.B;
          const carrierHand: Side = carrier === 'A' ? handA : handB;
          const otherId: ClimberId = carrier === 'A' ? 'B' : 'A';
          const otherHand: Side = carrier === 'A' ? handB : handA;
          const carrierState = climbers[carrier];

          // 携带者若要更换持包手，需先给原持包手找到可抓且能站稳的接替岩点
          const switchPlan = carrierState.bagHand !== carrierHand
            ? planHandSwitch(carrierState, carrierHand, scenario) : null;
          if (carrierState.bagHand !== carrierHand && !switchPlan) {
            reasons.push(`${carrier === 'A' ? '甲' : '乙'}更换持包手找不到可抓的接替岩点`);
          }
          const carrierContacts: RelayContacts = switchPlan ? switchPlan.contacts : carrierState.contacts;
          const carrierPose: ClimberState = {
            ...carrierState, contacts: carrierContacts, bagHand: carrierHand, bagSide,
          };
          const otherPose: ClimberState = {
            ...climbers[otherId], bagHand: otherHand, bagSide,
          };
          const poseA = carrier === 'A' ? carrierPose : otherPose;
          const poseB = carrier === 'A' ? otherPose : carrierPose;

          const reachA = handCanReachHandle(poseA, handA, handle, scenario);
          const reachB = handCanReachHandle(poseB, handB, handle, scenario);
          if (reachA.distance > reachA.reach) reasons.push(`甲的${handA === 'L' ? '左' : '右'}手够不到把位`);
          if (reachB.distance > reachB.reach) reasons.push(`乙的${handB === 'L' ? '左' : '右'}手够不到把位`);

          const anchorsA = anchorHolds(poseA, handA);
          const anchorsB = anchorHolds(poseB, handB);
          const shared = [...anchorsA].filter(id => anchorsB.has(id));
          if (shared.length) reasons.push('两人支撑岩点冲突：' + shared.join('、'));

          const marginA = balanceOf(poseA, scenario).margin;
          const marginB = balanceOf(poseB, scenario).margin;
          if (marginA < 0) reasons.push(`甲共握时三肢支撑余量 ${marginA}，站不稳`);
          if (marginB < 0) reasons.push(`乙共握时三肢支撑余量 ${marginB}，站不稳`);

          const sideSwitch = carrierState.bagSide !== bagSide;
          const carrierCost = (switchPlan?.cost ?? 0) + (sideSwitch ? BAG.switchSideCost : 0) + BAG.handoffCost;
          const otherCost = BAG.handoffCost;
          if (carrierState.energy < carrierCost) reasons.push('携带者体力不足');
          if (climbers[otherId].energy < otherCost) reasons.push('接手者体力不足');

          const energyA = A.energy - (carrier === 'A' ? carrierCost : otherCost);
          const energyB = B.energy - (carrier === 'B' ? carrierCost : otherCost);
          const feasible = reasons.length === 0;
          candidates.push({
            id: `${handle.x}-${handA}${handB}-${bagSide}`,
            handle, handA, handB, bagSide, feasible, reasons,
            switchCost: (switchPlan?.cost ?? 0) + (sideSwitch ? BAG.switchSideCost : 0),
            costA: carrier === 'A' ? carrierCost : otherCost,
            costB: carrier === 'B' ? carrierCost : otherCost,
            energyA: feasible ? energyA : Math.max(0, energyA),
            energyB: feasible ? energyB : Math.max(0, energyB),
            marginA, marginB,
            score: feasible ? Math.min(energyA, energyB) : null,
          });
        }
      }
    }
  }

  return candidates.sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (a.feasible && b.feasible && a.score !== b.score) return (b.score ?? 0) - (a.score ?? 0);
    if (a.feasible && b.feasible) {
      const otherA = Math.min(a.energyA, a.energyB) === a.score ? Math.max(a.energyA, a.energyB) : a.score;
      const otherB = Math.min(b.energyA, b.energyB) === b.score ? Math.max(b.energyA, b.energyB) : b.score;
      if (otherA !== otherB) return (otherB ?? 0) - (otherA ?? 0);
    }
    if (a.handle.x !== b.handle.x) return a.handle.x - b.handle.x;
    return a.id.localeCompare(b.id);
  });
}

export const failureText: Record<string, string> = {
  reach: '超出可触及范围',
  support: '剩余肢体支撑不足，发生失衡',
  energy: '剩余体力不足',
  occupied: '岩点已被占用',
  baghand: '持包手被占用，不能抓岩点',
  hook: '只能在指定挂点放包',
};
