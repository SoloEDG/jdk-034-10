<script setup lang="ts">
import { computed } from 'vue';
import type { BagLocation, ClimberId, ClimberState, RelayLimb, RelayScenario, Side } from '../lib/types';
import { bodyCenter, effectiveCenter } from '../lib/mechanics';

const props = defineProps<{
  scenario: RelayScenario;
  climbers: Record<ClimberId, ClimberState>;
  bag: BagLocation;
  bagPoint: { x: number; y: number };
  selected: Record<ClimberId, RelayLimb>;
  activeId: ClimberId;
  states: Record<string, string>;
  locked: boolean;
}>();
defineEmits<{ choose: [id: string] }>();

const shapes = {
  jug: 'M-18 1Q-19-11-6-13L10-11Q23-9 18 4L10 12-9 11Q-18 10-18 1Z',
  edge: 'M-20 3-15-7 9-11 21-4 13 8-15 10Z',
  slope: 'M-21 2Q-10-20 12-10Q25-5 16 8Q2 18-18 9Z',
  step: 'M-15 3-10-8 10-7 15 3 3 10-13 9Z',
};

function pose(id: ClimberId) {
  const c = props.climbers[id];
  const center = bodyCenter(c.contacts, props.scenario);
  const side = (limb: RelayLimb): Side => (limb.startsWith('l') ? 'L' : 'R');
  const hand = (limb: RelayLimb) => limb === 'lh' || limb === 'rh';
  const joints = (['lh', 'rh', 'lf', 'rf'] as RelayLimb[])
    .filter(limb => c.contacts[limb])
    .map(limb => {
      const s = side(limb) === 'L' ? -1 : 1;
      const joint = { x: center.x + s * (hand(limb) ? 14 : 9), y: center.y + (hand(limb) ? -20 : 20) };
      const end = props.scenario.holds.find(h => h.id === c.contacts[limb])!;
      const bend = { x: (joint.x + end.x) / 2 + s * 15, y: (joint.y + end.y) / 2 + (hand(limb) ? 9 : -9) };
      return { limb, path: `M${joint.x} ${joint.y} L${bend.x} ${bend.y} ${end.x} ${end.y}`, end };
    });
  return { center, joints, dim: c.bagHand !== null };
}
const poseA = computed(() => pose('A'));
const poseB = computed(() => pose('B'));

function bagHandEnd(id: ClimberId) {
  const c = props.climbers[id];
  if (c.bagHand === null) return null;
  const center = effectiveCenter(c, props.scenario);
  const s = c.bagSide === 'L' ? -1 : 1;
  const joint = { x: center.x + s * 14, y: center.y - 20 };
  return { joint };
}
const bagLinkA = computed(() => bagHandEnd('A'));
const bagLinkB = computed(() => bagHandEnd('B'));
const handoff = computed(() => props.scenario.handoff);
const viewBox = computed(() => '0 0 ' + props.scenario.wall.width + ' ' + props.scenario.wall.height);
</script>

<template>
  <section class="relay-wall" aria-label="攀壁运包岩壁">
    <svg :viewBox="viewBox" class="relay-graphics">
      <defs>
        <pattern id="relay-bolts" width="36" height="36" patternUnits="userSpaceOnUse">
          <circle cx="7" cy="6" r="1.4" fill="#152b28" opacity=".5" />
        </pattern>
      </defs>
      <rect :width="scenario.wall.width" :height="scenario.wall.height" fill="#304b42" />
      <path d="M0 0H173L203 218 82 432 0 386ZM173 0H512L456 195 203 218ZM512 0H720V276L592 312 456 195Z" fill="#3b5a4c" />
      <path d="M0 386 82 432 203 218 456 195 407 422 263 555H0ZM592 312 720 276V555H523L407 422 456 195Z" fill="#456253" />
      <rect :width="scenario.wall.width" :height="scenario.wall.height" fill="url(#relay-bolts)" />

      <!-- 交接高度带 -->
      <rect :x="handoff.fromX - 26" :y="handoff.y - 34" :width="handoff.toX - handoff.fromX + 52" height="68"
        rx="10" fill="#fdd264" opacity=".1" stroke="#fdd264" stroke-dasharray="6 6" stroke-width="1.5" />
      <text :x="handoff.fromX - 20" :y="handoff.y - 40" class="band-label">指定交接高度 {{ handoff.y }}</text>

      <!-- 挂点 -->
      <g v-for="hook in scenario.hooks" :key="hook.id" class="hook" :class="{ finish: hook.finish }">
        <circle :cx="hook.x" :cy="hook.y" r="11" fill="#20362b" stroke="#f4be60" stroke-width="2.5" />
        <path :d="`M${hook.x - 5} ${hook.y - 2} a5 7 0 1 0 10 0`" fill="none" stroke="#f4be60" stroke-width="2" />
        <text :x="hook.x" :y="hook.y + 27" class="hook-label">{{ hook.name }}</text>
      </g>

      <!-- 岩点 -->
      <g v-for="hold in scenario.holds" :key="hold.id" class="relay-hold" :class="states[hold.id] ?? 'idle'"
        :role="locked ? undefined : 'button'" :tabindex="locked ? undefined : 0"
        :aria-label="'岩点 ' + hold.id" @click="!locked && $emit('choose', hold.id)"
        @keydown.enter.prevent="!locked && $emit('choose', hold.id)">
        <circle :cx="hold.x" :cy="hold.y" r="24" fill="transparent" />
        <circle v-if="states[hold.id] === 'target'" :cx="hold.x" :cy="hold.y" r="22" class="hold-ring" />
        <path :transform="`translate(${hold.x} ${hold.y}) rotate(${hold.angle})`" :d="shapes[hold.kind]" class="hold-shape" />
        <text :x="hold.x" :y="hold.y + 4" class="hold-number">{{ hold.id }}</text>
      </g>

      <!-- 攀爬者甲 -->
      <g class="relay-pose" :class="{ active: activeId === 'A' }">
        <path v-for="line in poseA.joints" :key="line.limb" :d="line.path"
          class="limb-line" :class="{ picked: selected.A === line.limb && activeId === 'A' }" :stroke="climbers.A.color" />
        <g :transform="`translate(${poseA.center.x} ${poseA.center.y})`">
          <path d="M-15-21Q0-26 15-21L11 16Q0 25-11 16Z" :fill="climbers.A.color" stroke="#182d28" stroke-width="2.5" />
          <circle cy="-33" r="11" fill="#e8b494" stroke="#182d28" stroke-width="2.5" />
          <text y="-48" text-anchor="middle" class="pose-tag" :fill="climbers.A.color">甲</text>
        </g>
      </g>

      <!-- 攀爬者乙 -->
      <g class="relay-pose" :class="{ active: activeId === 'B' }">
        <path v-for="line in poseB.joints" :key="line.limb" :d="line.path"
          class="limb-line" :class="{ picked: selected.B === line.limb && activeId === 'B' }" :stroke="climbers.B.color" />
        <g :transform="`translate(${poseB.center.x} ${poseB.center.y})`">
          <path d="M-15-21Q0-26 15-21L11 16Q0 25-11 16Z" :fill="climbers.B.color" stroke="#182d28" stroke-width="2.5" />
          <circle cy="-33" r="11" fill="#e8b494" stroke="#182d28" stroke-width="2.5" />
          <text y="-48" text-anchor="middle" class="pose-tag" :fill="climbers.B.color">乙</text>
        </g>
      </g>

      <!-- 包柄连线（共握时两条） -->
      <g v-if="bagLinkA && climbers.A.bagHand !== null" class="bag-link">
        <path :d="`M${bagLinkA.joint.x} ${bagLinkA.joint.y} L${bagPoint.x} ${bagPoint.y}`" />
      </g>
      <g v-if="bagLinkB && climbers.B.bagHand !== null" class="bag-link">
        <path :d="`M${bagLinkB.joint.x} ${bagLinkB.joint.y} L${bagPoint.x} ${bagPoint.y}`" />
      </g>

      <!-- 训练包 -->
      <g :transform="`translate(${bagPoint.x} ${bagPoint.y})`" class="training-bag">
        <rect x="-13" y="-9" width="26" height="24" rx="5" fill="#c7764a" stroke="#2a1c12" stroke-width="2" />
        <path d="M-7-9 a7 7 0 0 1 14 0" fill="none" stroke="#2a1c12" stroke-width="2.5" />
        <text y="7" text-anchor="middle" class="bag-text">包</text>
      </g>
    </svg>
  </section>
</template>
