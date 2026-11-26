<script setup lang="ts">
import { ArrowLeftRight, BadgeCheck, TriangleAlert } from 'lucide-vue-next';
import type { HandoffCandidate } from '../lib/types';
import { sideNames } from '../lib/mechanics';

defineProps<{
  candidates: HandoffCandidate[];
  feasibleCount: number;
  best: HandoffCandidate | null;
  canHandoff: boolean;
  locked: boolean;
}>();
defineEmits<{ execute: [candidate: HandoffCandidate]; attempt: [candidate: HandoffCandidate] }>();

function scoreLabel(c: HandoffCandidate) {
  return c.score === null ? '—' : String(c.score);
}
</script>

<template>
  <section class="console-section handoff-panel" aria-label="交接姿态比较">
    <h2><ArrowLeftRight :size="16" /> 交接姿态比较 <span class="handoff-count">{{ feasibleCount }} 个可执行</span></h2>
    <p class="panel-hint">同一次交接两人共握包柄、各自只剩三肢支撑；按两人交接后的最低剩余体力（maximin）排序。</p>
    <div v-if="best" class="best-line">
      <BadgeCheck :size="15" />
      最优姿态：把位 ({{ best.handle.x }}, {{ best.handle.y }})，甲{{ sideNames[best.handA] }}手 / 乙{{ sideNames[best.handB] }}手，
      包挂{{ sideNames[best.bagSide] }}，最低剩余体力 <b>{{ best.score }}</b>
    </div>
    <div class="candidate-scroll">
      <table class="candidate-table">
        <thead>
          <tr><th>把位</th><th>甲手</th><th>乙手</th><th>包侧</th><th>余量A/B</th><th>最低</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="c in candidates" :key="c.id" :class="{ infeasible: !c.feasible, top: c === best }">
            <td>{{ c.handle.x }},{{ c.handle.y }}</td>
            <td>{{ sideNames[c.handA] }}</td>
            <td>{{ sideNames[c.handB] }}</td>
            <td>{{ sideNames[c.bagSide] }}</td>
            <td>{{ c.energyA }} / {{ c.energyB }}</td>
            <td><b>{{ scoreLabel(c) }}</b></td>
            <td>
              <button v-if="c.feasible" class="mini-action ok" :disabled="locked || !canHandoff"
                title="执行该交接姿态" @click="$emit('execute', c)">交接</button>
              <button v-else class="mini-action bad" :disabled="locked || !canHandoff"
                :title="c.reasons.join('；')" @click="$emit('attempt', c)">试交接</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <details v-if="candidates.some(c => !c.feasible)" class="reason-box">
      <summary><TriangleAlert :size="14" /> 不可行姿态原因（前 6 条）</summary>
      <ul>
        <li v-for="c in candidates.filter(x => !x.feasible).slice(0, 6)" :key="c.id">
          ({{ c.handle.x }},{{ c.handle.y }}) 甲{{ sideNames[c.handA] }}/乙{{ sideNames[c.handB] }}/包{{ sideNames[c.bagSide] }}：{{ c.reasons.join('；') }}
        </li>
      </ul>
    </details>
  </section>
</template>
