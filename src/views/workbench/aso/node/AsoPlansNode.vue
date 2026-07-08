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
        @select="onSelectPlan" />
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import PlanList from "../PlanList.vue";
import { ASO_WORKBENCH_KEY } from "../asoContext";

const props = defineProps<{
  id: string;
  data: { handleIds: { target: string; source: string } };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const handleIds = computed(() => props.data.handleIds);
const plans = ctx.plans;
const selectedPlanId = ctx.selectedPlanId;
const outputSizePreset = ctx.outputSizePreset;
const referencedAssetIds = ctx.referencedAssetIds;
const onImageGenerated = ctx.onImageGenerated;
const onSelectPlan = ctx.onSelectPlan;

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
    max-height: 520px;
    overflow: auto;
  }

  :deep(.planList.compact .planCard) {
    padding: 10px;
  }

  :deep(.planList.compact .actions .t-button) {
    width: 100%;
  }
}
</style>
