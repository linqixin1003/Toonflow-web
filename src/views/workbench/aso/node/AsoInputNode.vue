<template>
  <t-card class="asoFlowNode">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ $t("workbench.aso.sectionInput") }}</div>
      <Handle :id="handleIds.source" type="source" :position="Position.Right" style="right: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="content">
      <InputPanel :asset-ids="referencedAssetIds" @generated="onPlansGenerated" />
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import InputPanel from "../InputPanel.vue";
import { ASO_WORKBENCH_KEY } from "../asoContext";

const props = defineProps<{
  id: string;
  data: { handleIds: { source: string } };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const handleIds = computed(() => props.data.handleIds);
const referencedAssetIds = ctx.referencedAssetIds;
const onPlansGenerated = ctx.onPlansGenerated;
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
  }
}
</style>
