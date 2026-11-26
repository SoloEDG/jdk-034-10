<script setup lang="ts">
import { computed, ref } from 'vue';
import { Activity, ChevronRight, Mountain, Target } from 'lucide-vue-next';
import { RouteList, WallBoard } from '../features/wall';
import { ClimberPose, LimbControls, limbNames } from '../features/limbs';
import { StaminaGauge } from '../features/stamina';
import { ActionPanel } from '../features/actions';
import { AttemptList, AttemptReview } from '../features/records';
import { RelayView } from '../features/relay';
import { useChallenge } from './useChallenge';

type Mode = 'boulder' | 'relay';
const mode = ref<Mode>('boulder');

const {
  routeId, shownRoute, shownContacts, selected, shownStates, shownBalance, targetMark, locked,
  remaining, max, preview, result, target, moves, attempts, active, frame, step, stored,
  start, chooseLimb, chooseHold, execute, open, close, jump,
} = useChallenge();
const caption = computed(() => active.value ? '历史记录 · 第 ' + (step.value + 1) + ' 步'
  : result.value === 'success' ? '完攀 · ' + moves.value.length + ' 步'
    : result.value === 'fall' ? '坠落 · 可从挑战记录回看'
      : limbNames[selected.value] + ' · ' + moves.value.length + ' 步');
</script>

<template>
  <header class="masthead">
    <div class="brand"><span class="brand-icon"><Mountain :size="24" /></span><strong>CRUX</strong><span>攀岩训练台</span></div>
    <nav class="mode-switch" aria-label="训练模式">
      <button :class="{ on: mode === 'boulder' }" @click="mode = 'boulder'">抱石挑战</button>
      <button :class="{ on: mode === 'relay' }" @click="mode = 'relay'">攀壁运包</button>
    </nav>
    <div v-if="mode === 'boulder'" class="top-status"><i></i> {{ active ? '历史回看' : result === 'success' ? '已完攀' : result === 'fall' ? '已结束' : '抱石挑战' }}</div>
  </header>

  <RelayView v-if="mode === 'relay'" />

  <main v-else class="workspace">
    <div class="dashboard">
      <RouteList :active="routeId" :reviewing="Boolean(active)" @choose="start" />
      <WallBoard :route="shownRoute" :states="shownStates" :locked="locked" :caption="caption" @choose="chooseHold" @reset="start(routeId)">
        <template #climber>
          <ClimberPose :route="shownRoute" :contacts="shownContacts" :selected="frame?.move.limb ?? selected"
            :attempted="frame?.failure ? frame.move.target : targetMark?.id" />
        </template>
      </WallBoard>
      <aside class="console" aria-label="攀岩控制台">
        <div class="console-head"><Target :size="18" /><b>攀岩控制台</b></div>
        <div v-if="frame && active">
          <StaminaGauge :remaining="frame.energyAfter" :max="shownRoute.energy" :pending="0" />
          <AttemptReview :attempt="active" :frame="frame" :step="step" @jump="jump" @close="close" />
        </div>
        <template v-else>
          <StaminaGauge :remaining="remaining" :max="max" :pending="preview?.cost ?? 0" />
          <div class="balance-line"><span><Activity :size="15" /> 当前支撑</span><b>{{ shownBalance.margin }} 余量</b></div>
          <LimbControls :contacts="shownContacts" :selected="selected" :locked="locked" @choose="chooseLimb" />
          <ActionPanel :preview="preview" :invalid-target="Boolean(target && !preview)" :locked="locked" @execute="execute" />
          <button v-if="result" class="review-button" @click="attempts[0] && open(attempts[0])">回看本次挑战 <ChevronRight :size="16" /></button>
        </template>
      </aside>
    </div>
    <AttemptList :attempts="attempts" :stored="stored" @open="open" />
  </main>
</template>
