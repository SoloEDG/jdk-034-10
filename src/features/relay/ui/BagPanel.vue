<script setup lang="ts">
import { Backpack, Hand, Layers, PackageCheck, PackageOpen } from 'lucide-vue-next';
import type { BagLocation, ClimberState, HookDef, Side } from '../lib/types';
import { BAG, sideNames } from '../lib/mechanics';

defineProps<{
  bag: BagLocation;
  active: ClimberState;
  activeIsCarrier: boolean;
  hooks: HookDef[];
  locked: boolean;
}>();
defineEmits<{
  switchHand: [side: Side];
  switchSide: [side: Side];
  park: [hookId: string];
  pickup: [hookId: string, hand: Side];
  deliver: [hookId: string];
}>();

const sides: Side[] = ['L', 'R'];
</script>

<template>
  <section class="console-section bag-panel" aria-label="训练包操作">
    <h2><Backpack :size="16" /> 训练包操作</h2>

    <div class="bag-state">
      <template v-if="bag.kind === 'carried'">
        <span class="chip chip-bag"><PackageOpen :size="14" /> {{ activeIsCarrier ? active.name + ' 持包中' : '另一人持包中' }}</span>
        <small>持包手不能抓岩点；包挂侧改变重心与抓点消耗（+{{ BAG.gripCarryExtra }}/步）</small>
      </template>
      <template v-else>
        <span class="chip"><PackageCheck :size="14" /> 包挂在「{{ hooks.find(h => h.id === (bag.kind === 'hook' ? bag.hook : ''))?.name ?? (bag.kind === 'hook' ? bag.hook : '') }}」</span>
        <small>放包只允许在指定挂点</small>
      </template>
    </div>

    <template v-if="activeIsCarrier">
      <div class="bag-row">
        <span><Hand :size="14" /> 更换持包手</span>
        <div class="seg">
          <button v-for="s in sides" :key="s" :disabled="locked || active.bagHand === s"
            @click="$emit('switchHand', s)">{{ sideNames[s] }}</button>
        </div>
      </div>
      <div class="bag-row">
        <span><Layers :size="14" /> 更换包挂侧</span>
        <div class="seg">
          <button v-for="s in sides" :key="s" :disabled="locked || active.bagSide === s"
            @click="$emit('switchSide', s)">{{ sideNames[s] }}</button>
        </div>
      </div>
      <div class="bag-row wrap">
        <span>放到指定挂点</span>
        <div class="seg">
          <button v-for="h in hooks.filter(h => !h.finish)" :key="h.id" class="hook-btn"
            :disabled="locked" @click="$emit('park', h.id)">{{ h.name }}</button>
        </div>
      </div>
      <div class="bag-row wrap">
        <span>送到终点</span>
        <div class="seg">
          <button v-for="h in hooks.filter(h => h.finish)" :key="h.id" class="hook-btn finish-btn"
            :disabled="locked" @click="$emit('deliver', h.id)">{{ h.name }}</button>
        </div>
      </div>
    </template>

    <template v-else-if="bag.kind === 'hook'">
      <div class="bag-row wrap">
        <span>取包（腾出该手）</span>
        <div class="seg">
          <button v-for="s in sides" :key="s" :disabled="locked"
            @click="$emit('pickup', bag.hook, s)">{{ active.name }}{{ sideNames[s] }}手</button>
        </div>
      </div>
    </template>
  </section>
</template>
