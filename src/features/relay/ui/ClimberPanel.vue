<script setup lang="ts">
import { computed } from 'vue';
import { Zap } from 'lucide-vue-next';
import type { ClimberState, RelayLimb, RelayScenario } from '../lib/types';
import { balanceOf, freeLimbs, handLimb, relayLimbNames, sideNames } from '../lib/mechanics';

const props = defineProps<{
  scenario: RelayScenario;
  climber: ClimberState;
  selected: RelayLimb;
  active: boolean;
  carrier: boolean;
  blockedHolds: string[];
  locked: boolean;
}>();
defineEmits<{ focus: []; chooseLimb: [limb: RelayLimb] }>();

const limbs: RelayLimb[] = ['lh', 'rh', 'lf', 'rf'];
const margin = computed(() => balanceOf(props.climber, props.scenario).margin);
const usable = computed(() => new Set(freeLimbs(props.climber)));
const percent = computed(() => Math.max(0, props.climber.energy) / props.scenario.startEnergy * 100);
const band = computed(() => (percent.value <= 20 ? 'low' : percent.value <= 45 ? 'medium' : 'high'));
const bagHandLabel = computed(() =>
  props.climber.bagHand ? relayLimbNames[handLimb(props.climber.bagHand)] : '');
</script>

<template>
  <section class="climber-card" :class="{ active, carrier }" :style="{ '--team': climber.color }">
    <header class="climber-head" @click="$emit('focus')">
      <b>{{ climber.name }}</b>
      <span v-if="carrier" class="chip chip-bag">持包 · {{ sideNames[climber.bagSide] }} · {{ bagHandLabel }}占用</span>
      <span v-else class="chip">空手</span>
    </header>
    <div class="climber-energy" :class="band">
      <span><Zap :size="14" /> 体力 <b>{{ climber.energy }}</b><small> / {{ scenario.startEnergy }}</small></span>
      <div class="mini-meter"><i :style="{ width: percent + '%' }" /></div>
    </div>
    <div class="climber-margin">
      当前支撑余量 <b :class="{ weak: margin < 0 }">{{ margin }}</b>
      <small>（{{ carrier ? '三肢支撑 + 包重' : '四肢支撑' }}）</small>
    </div>
    <div class="climber-limbs">
      <button v-for="limb in limbs" :key="limb" class="climber-limb"
        :class="{ selected: active && selected === limb, blocked: !usable.has(limb) }"
        :disabled="locked || !usable.has(limb)" :title="!usable.has(limb) ? '持包手被占用' : ''"
        @click="$emit('chooseLimb', limb)">
        <small>{{ limb.toUpperCase() }}</small>
        <b>{{ relayLimbNames[limb] }}</b>
        <span>{{ climber.contacts[limb] ?? '腾空' }}</span>
      </button>
    </div>
    <p v-if="carrier && blockedHolds.length" class="blocked-line">
      因持包占手无法使用的岩点：<b>{{ blockedHolds.join('、') }}</b>
    </p>
    <p v-else-if="carrier" class="blocked-line muted">持包手可及范围内暂无额外可用手点</p>
  </section>
</template>
