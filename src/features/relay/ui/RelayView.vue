<script setup lang="ts">
import { computed } from 'vue';
import { RotateCcw, Trophy } from 'lucide-vue-next';
import { useRelay } from '../model/useRelay';
import RelayBoard from './RelayBoard.vue';
import ClimberPanel from './ClimberPanel.vue';
import MovePanel from './MovePanel.vue';
import HandoffPanel from './HandoffPanel.vue';
import BagPanel from './BagPanel.vue';
import RelayLog from './RelayLog.vue';

const relay = useRelay();
const { scenario, climbers, activeId, selected, target, locked } = relay;

const blockedA = computed(() => relay.blocked.value.A?.holds ?? []);
const blockedB = computed(() => relay.blocked.value.B?.holds ?? []);
const canHandoff = computed(() => relay.carrier.value !== null && !locked.value);
</script>

<template>
  <main class="relay-workspace">
    <div class="relay-toolbar">
      <div>
        <h1>攀壁运包 · 双人交接</h1>
        <p>两人各有起势，把训练包在指定高度（{{ scenario.handoff.y }}）共握交接后送到另一侧终点挂点。</p>
      </div>
      <button class="reset-button" @click="relay.reset()"><RotateCcw :size="16" /> 重新开始</button>
    </div>

    <div v-if="relay.result.value === 'success'" class="success-banner" role="status">
      <Trophy :size="18" /> 运包任务完成！最终体力 甲 {{ climbers.A.energy }} / 乙 {{ climbers.B.energy }}，
      最低剩余体力 {{ Math.min(climbers.A.energy, climbers.B.energy) }}
    </div>

    <div class="relay-grid">
      <div class="relay-main">
        <RelayBoard :scenario="scenario" :climbers="climbers" :bag="relay.bag.value"
          :bag-point="relay.bagPosition.value" :selected="selected" :active-id="activeId"
          :states="relay.holdStates.value" :locked="locked" @choose="relay.chooseHold" />

        <div class="climber-row">
          <ClimberPanel :scenario="scenario" :climber="climbers.A" :selected="selected.A"
            :active="activeId === 'A'" :carrier="relay.carrier.value === 'A'" :blocked-holds="blockedA"
            :locked="locked" @focus="relay.focus('A')" @choose-limb="relay.chooseLimb" />
          <ClimberPanel :scenario="scenario" :climber="climbers.B" :selected="selected.B"
            :active="activeId === 'B'" :carrier="relay.carrier.value === 'B'" :blocked-holds="blockedB"
            :locked="locked" @focus="relay.focus('B')" @choose-limb="relay.chooseLimb" />
        </div>

        <RelayLog :events="relay.events.value" />
      </div>

      <aside class="relay-console">
        <div class="console-head">
          <b>{{ relay.active.value.name }} 控制台</b>
          <div class="focus-seg">
            <button :class="{ on: activeId === 'A' }" :disabled="locked" @click="relay.focus('A')">甲</button>
            <button :class="{ on: activeId === 'B' }" :disabled="locked" @click="relay.focus('B')">乙</button>
          </div>
        </div>
        <MovePanel :preview="relay.preview.value" :has-target="Boolean(target)" :locked="locked"
          @execute="relay.executeMove" />
        <BagPanel :bag="relay.bag.value" :active="relay.active.value"
          :active-is-carrier="relay.carrier.value === activeId" :hooks="scenario.hooks" :locked="locked"
          @switch-hand="relay.switchHand" @switch-side="relay.switchSide" @park="relay.parkBag"
          @pickup="relay.pickupBag" @deliver="relay.deliver" />
        <HandoffPanel :candidates="relay.candidates.value" :feasible-count="relay.feasibleCount.value"
          :best="relay.bestCandidate.value" :can-handoff="canHandoff" :locked="locked"
          @execute="relay.handoff" @attempt="relay.failHandoff" />
      </aside>
    </div>
  </main>
</template>
