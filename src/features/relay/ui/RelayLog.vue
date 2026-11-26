<script setup lang="ts">
import { ScrollText } from 'lucide-vue-next';
import type { RelayEvent } from '../lib/types';

defineProps<{ events: RelayEvent[] }>();

const kindClass: Record<RelayEvent['kind'], string> = {
  move: 'ev-move',
  switch: 'ev-switch',
  park: 'ev-park',
  pickup: 'ev-pickup',
  handoff: 'ev-handoff',
  deliver: 'ev-deliver',
  'handoff-fail': 'ev-fail',
  'switch-fail': 'ev-fail',
  'park-fail': 'ev-fail',
  'pickup-fail': 'ev-fail',
};
const kindLabel: Record<RelayEvent['kind'], string> = {
  move: '移动', switch: '换手', park: '放包', pickup: '取包',
  handoff: '交接', deliver: '送达', 'handoff-fail': '交接失败',
  'switch-fail': '换手失败', 'park-fail': '放包失败', 'pickup-fail': '取包失败',
};
</script>

<template>
  <section class="relay-log" aria-label="运包过程记录">
    <h2><ScrollText :size="16" /> 过程记录 · 包归属与占手岩点</h2>
    <p v-if="!events.length" class="empty">还没有动作。甲先从起包挂点取包，或先调整起势。</p>
    <ol v-else class="log-list">
      <li v-for="ev in [...events].reverse()" :key="ev.seq" :class="kindClass[ev.kind]">
        <div class="log-head">
          <span class="log-kind">{{ kindLabel[ev.kind] }}</span>
          <b>#{{ ev.seq }}</b>
        </div>
        <p class="log-text">{{ ev.text }}</p>
        <p class="log-bag">
          包位置 ({{ ev.bag.point.x }}, {{ ev.bag.point.y }}) ·
          归属 <b>{{ ev.bag.owner ? (ev.bag.owner === 'A' ? '攀爬者甲' : '攀爬者乙') : (ev.bag.hook ? '挂点 ' + ev.bag.hook : '—') }}</b>
          <template v-if="ev.blocked">
            · {{ ev.blocked.climber === 'A' ? '甲' : '乙' }}{{ ev.blocked.hand === 'L' ? '左' : '右' }}手占手，
            无法使用岩点 <b>{{ ev.blocked.holds.length ? ev.blocked.holds.join('、') : '（可及范围内无空闲手点）' }}</b>
          </template>
        </p>
        <p class="log-energy">体力 甲 {{ ev.energy.A }} / 乙 {{ ev.energy.B }}</p>
      </li>
    </ol>
  </section>
</template>
