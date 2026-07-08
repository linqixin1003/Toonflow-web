<template>
  <t-card class="asoFlowNode">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ $t("workbench.aso.sectionPlans") }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
      <Handle :id="handleIds.source" type="source" :position="Position.Right" style="right: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="content">
      <PlanList
        ref="planListEl"
        v-model:selected-plan-id="selectedPlanId"
        :plans="plans"
        :preset-id="outputSizePreset"
        :referenced-asset-ids="referencedAssetIds"
        compact
        @generated="onImageGenerated"
        @select="onSelectPlan"
        @plan-updated="onPlanUpdated" />
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position, useVueFlow } from "@vue-flow/core";
import PlanList from "../PlanList.vue";
import { ASO_WORKBENCH_KEY } from "../asoContext";

const props = defineProps<{
  id: string;
  data: { handleIds: { target: string; source: string } };
}>();

const { updateNodeInternals } = useVueFlow({ id: "asoFlowBox" });
const ctx = inject(ASO_WORKBENCH_KEY)!;
const handleIds = computed(() => props.data.handleIds);
const plans = ctx.plans;
const selectedPlanId = ctx.selectedPlanId;
const outputSizePreset = ctx.outputSizePreset;
const referencedAssetIds = ctx.referencedAssetIds;
const onImageGenerated = ctx.onImageGenerated;
const onSelectPlan = ctx.onSelectPlan;
const onPlanUpdated = ctx.onPlanUpdated;

const planListEl = ref<InstanceType<typeof PlanList> | null>(null);
watch(
  planListEl,
  (el) => {
    ctx.planListRef.value = el;
  },
  { immediate: true },
);
onUnmounted(() => {
  if (ctx.planListRef.value === planListEl.value) ctx.planListRef.value = null;
});

async function remeasureNode() {
  await nextTick();
  updateNodeInternals([props.id]);
}

watch(() => ctx.plans.value.length, remeasureNode);
watch(ctx.plans, remeasureNode, { deep: true });
onMounted(remeasureNode);
</script>

<style scoped lang="scss">
.asoFlowNode {
  width: 340px;
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
    background-color: #0f172a;
    width: fit-content;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 14px;
    font-weight: 600;
  }

  .content {
    margin-top: 10px;
    overflow: visible;
  }

  :deep(.planList.compact .planCard) {
    padding: 10px;
  }

  :deep(.planList.compact .actions .t-button) {
    width: 100%;
  }
}
</style>
