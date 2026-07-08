<template>
  <t-card class="asoOutputItem" :class="{ active: output.imageId === selectedOutputId }" @click="onSelect">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ $t("workbench.aso.sectionOutput") }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="body" @mousedown.stop @pointerdown.stop>
      <div class="meta f ac jb">
        <t-tag size="small" variant="light">{{ output.presetId }}</t-tag>
        <t-tag size="small" :theme="stateTheme(output.state)" variant="light">{{ output.state }}</t-tag>
      </div>
      <t-tag v-if="planLinkOrphaned" size="small" theme="warning" variant="light" class="orphanTag">
        {{ $t("workbench.aso.outputPlanRelinked") }}
      </t-tag>
      <div v-if="output.state === '生成中'" class="loading f ac jc">
        <t-loading size="small" />
      </div>
      <img v-else-if="output.filePath" :src="output.filePath" class="preview" />
      <div v-else-if="output.errorReason" class="error">{{ output.errorReason }}</div>
      <div v-if="output.state === '生成失败'" class="actions f ac je">
        <t-button size="small" theme="primary" variant="outline" :loading="regenerating" @click.stop="onRegenerate">
          {{ $t("workbench.aso.regenerateOutput") }}
        </t-button>
        <t-button size="small" theme="danger" variant="text" :disabled="regenerating" @click.stop="onDelete">
          {{ $t("workbench.aso.delete") }}
        </t-button>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { ASO_WORKBENCH_KEY } from "../asoContext";
import { resolveOutputPlanId } from "../utils/asoFlowBuilder";

const props = defineProps<{
  id: string;
  data: {
    output: any;
    handleIds: { target: string };
  };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const output = computed(() => props.data.output);
const handleIds = computed(() => props.data.handleIds);
const selectedOutputId = ctx.selectedOutputId;
const regenerating = ref(false);
const planLinkOrphaned = computed(() => {
  const out = output.value;
  if (!out?.planId) return false;
  const linked = resolveOutputPlanId(out, ctx.plans.value);
  return Boolean(linked && linked !== out.planId);
});

function stateTheme(state: string) {
  if (state === "已完成") return "success";
  if (state === "生成失败") return "danger";
  return "primary";
}

function onSelect() {
  ctx.selectedOutputId.value = output.value.imageId;
  const linked = resolveOutputPlanId(output.value, ctx.plans.value);
  if (linked) ctx.onSelectPlan(linked);
}

async function onRegenerate() {
  if (regenerating.value || ctx.generatingPlanId.value) return;
  regenerating.value = true;
  try {
    await ctx.regenerateOutput(output.value);
  } finally {
    regenerating.value = false;
  }
}

async function onDelete() {
  if (regenerating.value) return;
  await ctx.deleteOutputItem(output.value.imageId);
}
</script>

<style scoped lang="scss">
.asoOutputItem {
  width: 280px;
  cursor: pointer;
  user-select: text;

  &.active {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 2px var(--td-brand-color-light);
  }

  .titleBar {
    cursor: grab;
    user-select: none;
  }

  .title {
    background-color: #1e40af;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 13px;
    font-weight: 600;
  }

  .body {
    margin-top: 10px;
  }

  .meta {
    margin-bottom: 8px;
    gap: 8px;
  }

  .orphanTag {
    margin-bottom: 8px;
  }

  .preview {
    width: 100%;
    border-radius: 6px;
    display: block;
  }

  .loading {
    min-height: 160px;
  }

  .error {
    font-size: 12px;
    color: var(--td-error-color);
    word-break: break-word;
    margin-bottom: 8px;
  }

  .actions {
    margin-top: 8px;
    gap: 8px;
  }
}
</style>
