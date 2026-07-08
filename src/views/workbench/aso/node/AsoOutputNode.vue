<template>
  <t-card class="asoFlowNode">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ $t("workbench.aso.sectionOutput") }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="content">
      <OutputGallery
        ref="galleryEl"
        :outputs="outputs"
        vertical
        :selected-image-id="selectedOutputId"
        @select="onSelectOutput" />
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import OutputGallery from "../OutputGallery.vue";
import { ASO_WORKBENCH_KEY } from "../asoContext";

const props = defineProps<{
  id: string;
  data: { handleIds: { target: string } };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const handleIds = computed(() => props.data.handleIds);
const outputs = ctx.outputs;
const selectedOutputId = ctx.selectedOutputId;

function onSelectOutput(imageId: number) {
  ctx.selectedOutputId.value = imageId;
}

const galleryEl = ref<InstanceType<typeof OutputGallery> | null>(null);
watch(
  galleryEl,
  (el) => {
    ctx.galleryRef.value = el;
  },
  { immediate: true },
);
onUnmounted(() => {
  if (ctx.galleryRef.value === galleryEl.value) ctx.galleryRef.value = null;
});
</script>

<style scoped lang="scss">
.asoFlowNode {
  width: 300px;
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
}
</style>
