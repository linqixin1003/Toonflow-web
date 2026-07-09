<template>
  <t-card class="asoPlanOutputs">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ $t("workbench.aso.sectionOutput") }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="content" @mousedown.stop @pointerdown.stop>
      <PlanOutputGrid
        :outputs="planOutputs"
        :selected-image-id="selectedOutputId"
        :retrying-image-id="retryingImageId"
        @select="onSelectOutput"
        @retry="onRetryOutput"
        @edit="onEditOutput" />
      <div v-if="hasFailed" class="footerActions f ac je">
        <t-button size="small" theme="primary" variant="outline" :loading="retryingImageId != null" @click.stop="onRegenerateFailed">
          {{ $t("workbench.aso.regenerateFailedOutputs") }}
        </t-button>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import PlanOutputGrid from "../components/PlanOutputGrid.vue";
import { ASO_WORKBENCH_KEY } from "../asoContext";
import { resolveOutputPlanId } from "../utils/asoFlowBuilder";
import { sortOutputsBySlot } from "../utils/outputPreview";

const props = defineProps<{
  id: string;
  data: {
    planId: string;
    handleIds: { target: string };
  };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const handleIds = computed(() => props.data.handleIds);
const selectedOutputId = ctx.selectedOutputId;
const retryingImageId = ref<number | null>(null);

const planOutputs = computed(() =>
  ctx.outputs.value.filter((o) => resolveOutputPlanId(o, ctx.plans.value) === props.data.planId),
);

const hasFailed = computed(() => planOutputs.value.some((o) => o.state === "生成失败"));

function onSelectOutput(imageId: number) {
  ctx.selectedOutputId.value = imageId;
  ctx.onSelectPlan(props.data.planId);
}

async function onRetryOutput(output: any) {
  if (retryingImageId.value != null) return;
  const planId = resolveOutputPlanId(output, ctx.plans.value) ?? props.data.planId;
  if (ctx.isSlotGenerating(planId, output.promptSlot)) return;
  retryingImageId.value = output.imageId;
  try {
    await ctx.regenerateOutput(output);
  } finally {
    retryingImageId.value = null;
  }
}

function onEditOutput(output: any) {
  ctx.onEditOutput?.(output);
}

async function onRegenerateFailed() {
  if (retryingImageId.value != null) return;
  const failed = sortOutputsBySlot(planOutputs.value.filter((o) => o.state === "生成失败"));
  if (!failed.length) return;
  retryingImageId.value = failed[0].imageId;
  try {
    for (const out of failed) {
      const planId = props.data.planId;
      if (ctx.isSlotGenerating(planId, out.promptSlot)) {
        await ctx.waitForSlotGenerationEnd(planId, out.promptSlot);
      }
      retryingImageId.value = out.imageId;
      await ctx.regenerateOutput(out);
      await ctx.waitForSlotGenerationEnd(planId, out.promptSlot);
    }
  } finally {
    retryingImageId.value = null;
  }
}
</script>

<style scoped lang="scss">
.asoPlanOutputs {
  width: 420px;
  user-select: text;
  cursor: default;

  .titleBar {
    cursor: grab;
    user-select: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .title {
    background-color: #1e40af;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .content {
    margin-top: 10px;
    max-height: min(72vh, 900px);
    overflow: auto;
  }

  .footerActions {
    margin-top: 8px;
    padding-top: 4px;
  }
}
</style>
