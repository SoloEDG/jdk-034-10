import { computed, ref } from 'vue';
import type {
  BagLocation, ClimberId, ClimberState, HandoffCandidate, RelayEvent, RelayLimb, RelayScenario, Side,
} from '../lib/types';
import { relayScenario } from '../lib/scenario';
import {
  BAG, bagPoint, balanceOf, blockedHolds, climberNames, cloneClimber, freeLimbs, freshClimbers,
  handCanReachHook, handLimb, hookOf, previewMove, relayLimbNames, sideNames,
} from '../lib/mechanics';
import { planHandSwitch, planHandoffs } from '../lib/handoff';

export function useRelay(scenario: RelayScenario = relayScenario) {
  const climbers = ref<Record<ClimberId, ClimberState>>(freshClimbers(scenario));
  const bag = ref<BagLocation>({ kind: 'hook', hook: scenario.initialBagHook });
  const activeId = ref<ClimberId>('A');
  const selected = ref<Record<ClimberId, RelayLimb>>({ A: 'lh', B: 'lh' });
  const target = ref<string | null>(null);
  const events = ref<RelayEvent[]>([]);
  const result = ref<'success' | null>(null);
  let seq = 0;

  const locked = computed(() => result.value !== null);
  const active = computed(() => climbers.value[activeId.value]);
  const carrier = computed<ClimberId | null>(() => (bag.value.kind === 'carried' ? bag.value.climber : null));
  const bagPosition = computed(() => bagPoint(bag.value, scenario, climbers.value));
  const blocked = computed(() => {
    const map: Partial<Record<ClimberId, ReturnType<typeof blockedHolds>>> = {};
    for (const id of ['A', 'B'] as ClimberId[]) {
      map[id] = blockedHolds(climbers.value[id], scenario);
    }
    return map as Record<ClimberId, ReturnType<typeof blockedHolds>>;
  });

  const preview = computed(() => {
    if (!target.value || locked.value) return null;
    return previewMove(active.value, selected.value[activeId.value], target.value, scenario);
  });

  const holdStates = computed(() => {
    const states: Record<string, string> = {};
    const occupied = new Map<string, ClimberId[]>();
    for (const id of ['A', 'B'] as ClimberId[]) {
      for (const hold of Object.values(climbers.value[id].contacts)) {
        if (!hold) continue;
        occupied.set(hold, [...(occupied.get(hold) ?? []), id]);
      }
    }
    for (const hold of scenario.holds) {
      const who = occupied.get(hold.id);
      if (who) states[hold.id] = who.length > 1 ? 'conflict' : 'occupied-' + who[0];
    }
    if (target.value) states[target.value] = 'target';
    return states;
  });

  const candidates = computed<HandoffCandidate[]>(() => planHandoffs(climbers.value, scenario));
  const feasibleCount = computed(() => candidates.value.filter(item => item.feasible).length);
  const bestCandidate = computed(() => candidates.value.find(item => item.feasible) ?? null);

  function snapshot(text: string, kind: RelayEvent['kind'], actor: ClimberId | null) {
    const owner = carrier.value;
    events.value.push({
      seq: ++seq,
      at: Date.now(),
      kind,
      actor,
      text,
      bag: {
        owner,
        point: bagPoint(bag.value, scenario, climbers.value),
        hook: bag.value.kind === 'hook' ? bag.value.hook : null,
      },
      blocked: owner ? blockedHolds(climbers.value[owner], scenario) : null,
      energy: { A: climbers.value.A.energy, B: climbers.value.B.energy },
    });
  }

  function focus(id: ClimberId) {
    if (locked.value) return;
    activeId.value = id;
    target.value = null;
  }

  function chooseLimb(limb: RelayLimb) {
    if (locked.value) return;
    if (!freeLimbs(active.value).includes(limb)) return;
    selected.value[activeId.value] = limb;
    target.value = null;
  }

  function chooseHold(id: string) {
    if (locked.value) return;
    target.value = id;
  }

  function executeMove() {
    const move = preview.value;
    if (!move || locked.value) return;
    const climber = cloneClimber(active.value);
    if (move.failure) {
      snapshot(`${climberNames[climber.id]} 尝试 ${relayLimbNames[move.limb]} → ${move.target} 失败：${move.failure === 'reach' ? '够不到岩点' : move.failure === 'support' ? '剩余肢体站不稳' : '体力不足'}`,
        'move', climber.id);
      return;
    }
    climber.contacts[move.limb] = move.target;
    climber.energy = Math.max(0, climber.energy - move.cost);
    climbers.value[climber.id] = climber;
    const carry = climber.bagHand !== null;
    snapshot(`${climberNames[climber.id]} ${relayLimbNames[move.limb]} 移到 ${move.target}，消耗 ${move.cost} 体力${carry ? '（持包中，抓点消耗 +' + BAG.gripCarryExtra + '）' : ''}`,
      'move', climber.id);
    target.value = null;
  }

  /** 更换持包手（需要给原持包手找一个接替岩点） */
  function switchHand(newHand: Side) {
    if (locked.value) return;
    const id = carrier.value;
    if (id !== activeId.value) return;
    const climber = climbers.value[id];
    const plan = planHandSwitch(climber, newHand, scenario);
    if (!plan) {
      snapshot(`${climberNames[id]} 想把持包手换到${sideNames[newHand]}，但原持包手找不到可抓且能站稳的岩点`, 'switch-fail', id);
      return;
    }
    const next = cloneClimber(climber);
    next.contacts = { ...plan.contacts };
    next.bagHand = newHand;
    next.energy = Math.max(0, next.energy - plan.cost);
    climbers.value[id] = next;
    snapshot(`${climberNames[id]} 换持包手到${sideNames[newHand]}，原持包手抓住 ${plan.target}，消耗 ${plan.cost} 体力`, 'switch', id);
  }

  /** 更换包挂侧（改变重心偏移方向） */
  function switchSide(side: Side) {
    if (locked.value) return;
    const id = carrier.value;
    if (id !== activeId.value || climbers.value[id].bagSide === side) return;
    const climber = cloneClimber(climbers.value[id]);
    if (climber.energy < BAG.switchSideCost) {
      snapshot(`${climberNames[id]} 体力不足，无法把包换到${sideNames[side]}`, 'switch-fail', id);
      return;
    }
    const after: ClimberState = { ...climber, bagSide: side };
    if (balanceOf(after, scenario).margin < 0) {
      snapshot(`${climberNames[id]} 把包换到${sideNames[side]}后重心失衡，动作取消`, 'switch-fail', id);
      return;
    }
    after.energy = Math.max(0, after.energy - BAG.switchSideCost);
    climbers.value[id] = after;
    snapshot(`${climberNames[id]} 把包换到身体${sideNames[side]}，重心偏移方向改变，消耗 ${BAG.switchSideCost} 体力`, 'switch', id);
  }

  /** 在指定挂点放包；非挂点位置一律拒绝 */
  function parkBag(hookId: string) {
    if (locked.value) return;
    const id = carrier.value;
    if (id === null) return;
    const hook = scenario.hooks.find(item => item.id === hookId);
    if (!hook) {
      snapshot('途中放包只允许在指定挂点，包仍由 ' + climberNames[id] + ' 持有', 'park-fail', id);
      return;
    }
    const climber = climbers.value[id];
    const hand = climber.bagHand;
    if (hand === null) return;
    const measure = handCanReachHook(climber, hand, hookId, scenario);
    if (measure.distance > measure.reach || climber.energy < BAG.parkCost) {
      snapshot(`${climberNames[id]} 够不到挂点 ${hook.name} 或体力不足，放包失败，包仍由其持有`, 'park-fail', id);
      return;
    }
    const next = cloneClimber(climber);
    next.bagHand = null;
    next.energy = Math.max(0, next.energy - BAG.parkCost);
    climbers.value[id] = next;
    bag.value = { kind: 'hook', hook: hookId };
    snapshot(`${climberNames[id]} 把训练包挂到 ${hook.name}，消耗 ${BAG.parkCost} 体力`, 'park', id);
  }

  /** 从指定挂点取包 */
  function pickupBag(hookId: string, hand: Side) {
    if (locked.value) return;
    if (bag.value.kind !== 'hook' || bag.value.hook !== hookId) return;
    const id = activeId.value;
    const climber = climbers.value[id];
    const limb = handLimb(hand);
    if (!climber.contacts[limb]) {
      snapshot(`${climberNames[id]} 的${sideNames[hand]}手没有支撑点，无法腾空取包`, 'pickup-fail', id);
      return;
    }
    const measure = handCanReachHook(climber, hand, hookId, scenario);
    if (measure.distance > measure.reach || climber.energy < BAG.pickupCost) {
      snapshot(`${climberNames[id]} 够不到挂点上的包或体力不足，取包失败，包仍挂在 ${hookOf(hookId, scenario).name}`, 'pickup-fail', id);
      return;
    }
    const next = cloneClimber(climber);
    next.contacts[limb] = null;
    next.bagHand = hand;
    next.energy = Math.max(0, next.energy - BAG.pickupCost);
    if (balanceOf(next, scenario).margin < 0) {
      snapshot(`${climberNames[id]} 取包后三肢支撑不足、身体失衡，取包失败，包仍挂在原挂点`, 'pickup-fail', id);
      return;
    }
    climbers.value[id] = next;
    bag.value = { kind: 'carried', climber: id };
    snapshot(`${climberNames[id]} 从 ${hookOf(hookId, scenario).name} 取下训练包，${sideNames[hand]}手占手握柄，消耗 ${BAG.pickupCost} 体力`,
      'pickup', id);
  }

  /** 执行一次交接：两人共握包柄，各自只剩三肢支撑 */
  function handoff(candidate: HandoffCandidate) {
    if (locked.value || !candidate.feasible || carrier.value === null) return;
    const from = carrier.value;
    const to: ClimberId = from === 'A' ? 'B' : 'A';
    const giver = cloneClimber(climbers.value[from]);
    const receiver = cloneClimber(climbers.value[to]);
    let switched = false;
    // 携带者若要换持包手，先执行换手计划
    if (from === 'A' && giver.bagHand !== candidate.handA) {
      const plan = planHandSwitch(giver, candidate.handA, scenario);
      if (!plan) {
        snapshot(`${climberNames[from]} 交接前换手失败，包仍由其持有`, 'handoff-fail', from);
        return;
      }
      giver.contacts = { ...plan.contacts };
      giver.bagHand = candidate.handA;
      switched = true;
    }
    if (from === 'B' && giver.bagHand !== candidate.handB) {
      const plan = planHandSwitch(giver, candidate.handB, scenario);
      if (!plan) {
        snapshot(`${climberNames[from]} 交接前换手失败，包仍由其持有`, 'handoff-fail', from);
        return;
      }
      giver.contacts = { ...plan.contacts };
      giver.bagHand = candidate.handB;
      switched = true;
    }
    const giverHand = from === 'A' ? candidate.handA : candidate.handB;
    const receiverHand = to === 'A' ? candidate.handA : candidate.handB;
    // 接手者腾出对应手，共握后该手离点
    receiver.contacts[handLimb(receiverHand)] = null;
    receiver.bagHand = receiverHand;
    receiver.bagSide = candidate.bagSide;
    giver.bagSide = candidate.bagSide;
    // 换手成本已包含在候选 cost 中：换手时只扣一次候选成本，未换手时只扣交接动作成本
    const giverCost = switched ? (from === 'A' ? candidate.costA : candidate.costB) : BAG.handoffCost;
    giver.energy = Math.max(0, giver.energy - giverCost);
    receiver.energy = Math.max(0, receiver.energy - BAG.handoffCost);
    // 交接完成：原携带者松手，包归属接手者
    giver.bagHand = null;
    climbers.value[from] = giver;
    climbers.value[to] = receiver;
    bag.value = { kind: 'carried', climber: to };
    snapshot(
      `${climberNames[from]} 与 ${climberNames[to]} 在高度 ${candidate.handle.y} 共握包柄完成交接：`
      + (switched ? `${climberNames[from]} 先把持包手换到${sideNames[giverHand]}手、` : '')
      + `${climberNames[from]} ${sideNames[giverHand]}手松开、${climberNames[to]} ${sideNames[receiverHand]}手接包，`
      + `包挂身体${sideNames[candidate.bagSide]}；交接后体力 甲 ${climbers.value.A.energy} / 乙 ${climbers.value.B.energy}`,
      'handoff', null,
    );
    target.value = null;
  }

  /** 尝试执行一个不可行的交接姿态（交接失败，包仍归原携带者） */
  function failHandoff(candidate: HandoffCandidate) {
    if (locked.value || carrier.value === null) return;
    const from = carrier.value;
    snapshot(
      `交接失败：把位(${candidate.handle.x}, ${candidate.handle.y}) 甲${sideNames[candidate.handA]}手 / 乙${sideNames[candidate.handB]}手 / 包挂${sideNames[candidate.bagSide]} —— ${candidate.reasons.join('；')}；包仍由 ${climberNames[from]} 持有`,
      'handoff-fail', null,
    );
  }

  /** 把包送到另一侧终点挂点 */
  function deliver(hookId: string) {
    if (locked.value) return;
    const id = carrier.value;
    if (id === null) return;
    const hook = scenario.hooks.find(item => item.id === hookId);
    if (!hook || !hook.finish) {
      snapshot('终点只接受指定终点挂点，包仍由 ' + climberNames[id] + ' 持有', 'park-fail', id);
      return;
    }
    const climber = climbers.value[id];
    const hand = climber.bagHand;
    if (hand === null) return;
    const measure = handCanReachHook(climber, hand, hookId, scenario);
    if (measure.distance > measure.reach || climber.energy < BAG.parkCost) {
      snapshot(`${climberNames[id]} 够不到终点挂点或体力不足，投递失败，包仍由其持有`, 'park-fail', id);
      return;
    }
    const next = cloneClimber(climber);
    next.bagHand = null;
    next.energy = Math.max(0, next.energy - BAG.parkCost);
    climbers.value[id] = next;
    bag.value = { kind: 'hook', hook: hookId };
    result.value = 'success';
    snapshot(`${climberNames[id]} 把训练包送到另一侧 ${hook.name}，攀壁运包任务完成`, 'deliver', id);
  }

  function reset() {
    climbers.value = freshClimbers(scenario);
    bag.value = { kind: 'hook', hook: scenario.initialBagHook };
    activeId.value = 'A';
    selected.value = { A: 'lh', B: 'lh' };
    target.value = null;
    events.value = [];
    result.value = null;
    seq = 0;
  }

  return {
    scenario, climbers, bag, activeId, active, selected, target, events, result, locked,
    carrier, bagPosition, blocked, preview, holdStates, candidates, feasibleCount, bestCandidate,
    focus, chooseLimb, chooseHold, executeMove, switchHand, switchSide, parkBag, pickupBag,
    handoff, failHandoff, deliver, reset,
  };
}
