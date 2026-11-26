<script setup lang="ts">
import { ArrowUpRight, MoveUpRight, TriangleAlert } from 'lucide-vue-next';
import type { MovePreview } from '../lib/types';
import { failureText } from '../lib/handoff';
import { relayLimbNames } from '../lib/mechanics';

defineProps<{ preview: MovePreview | null; hasTarget: boolean; locked: boolean }>();
defineEmits<{ execute: [] }>();
</script>

<template>
  <section class="console-section action-panel" aria-label="移动预览">
    <h2><MoveUpRight :size="16" /> 移动预览</h2>
    <dl v-if="preview" class="action-data">
      <div><dt>{{ relayLimbNames[preview.limb] }} → {{ preview.target }}</dt><dd>−{{ preview.cost }} 体力</dd></div>
      <div><dt>距离 / 可触及</dt><dd>{{ preview.distance }} / {{ preview.reach }}</dd></div>
      <div><dt>离点 / 落点支撑余量</dt><dd>{{ preview.support }} / {{ preview.landing }}</dd></div>
      <div v-if="preview.carrying"><dt>持包附加</dt><dd>抓点消耗 +1 / 步</dd></div>
    </dl>
    <div v-else class="no-action">{{ hasTarget ? '该岩点与当前肢体不匹配，或持包手被占用' : '在岩壁上选择一个岩点' }}</div>
    <p v-if="preview?.failure" class="action-warning" role="status">
      <TriangleAlert :size="14" /> {{ failureText[preview.failure] }}（仍可执行并记入日志）
    </p>
    <button class="execute" :disabled="!preview || locked" @click="$emit('execute')">
      执行移动 <ArrowUpRight :size="16" />
    </button>
  </section>
</template>
