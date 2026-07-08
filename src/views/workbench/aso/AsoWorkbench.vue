<template>
  <div class="asoCanvasWorkbench f">
    <div class="canvasArea">
      <div class="canvasScroll">
        <div class="canvasTrack">
          <section class="canvasColumn">
            <header class="columnHeader">{{ $t("workbench.aso.sectionInput") }}</header>
            <div class="columnBody">
              <InputPanel :asset-ids="referencedAssetIds" @generated="onPlansGenerated" />
            </div>
          </section>

          <section class="canvasColumn">
            <header class="columnHeader">{{ $t("workbench.aso.sectionMaterials") }}</header>
            <div class="columnBody">
              <MaterialGrid v-model:referenced-asset-ids="referencedAssetIds" @changed="loadWorkspace" />
            </div>
          </section>

          <section class="canvasColumn">
            <header class="columnHeader">{{ $t("workbench.aso.sectionPlans") }}</header>
            <div class="columnBody">
              <PlanList
                ref="planListRef"
                v-model:selected-plan-id="selectedPlanId"
                :plans="plans"
                :preset-id="outputSizePreset"
                :referenced-asset-ids="referencedAssetIds"
                compact
                @generated="onImageGenerated"
                @select="onSelectPlan" />
            </div>
          </section>

          <section class="canvasColumn canvasColumnWide">
            <header class="columnHeader">{{ $t("workbench.aso.sectionOutput") }}</header>
            <div class="columnBody">
              <OutputGallery
                ref="galleryRef"
                :outputs="outputs"
                vertical
                :selected-image-id="selectedOutputId"
                @select="selectedOutputId = $event" />
            </div>
          </section>
        </div>
      </div>
    </div>

    <aside class="inspectorPane">
      <AsoInspector
        :plans="plans"
        :outputs="outputs"
        :selected-plan-id="selectedPlanId"
        :selected-output-id="selectedOutputId"
        :referenced-count="referencedAssetIds.length"
        :preset-id="outputSizePreset"
        :generating="planListRef?.generatingPlanId === selectedPlanId"
        @update:preset-id="outputSizePreset = $event"
        @generate-image="onGenerateFromInspector"
        @select-output="selectedOutputId = $event"
        @plan-updated="onPlanUpdated" />
    </aside>
  </div>
</template>

<script setup lang="ts">
import InputPanel from "./InputPanel.vue";
import PlanList from "./PlanList.vue";
import MaterialGrid from "./MaterialGrid.vue";
import OutputGallery from "./OutputGallery.vue";
import AsoInspector from "./AsoInspector.vue";
import { getWorkspace, pollingOutputs } from "@/api/aso";
import projectStore from "@/stores/project";

const { project } = storeToRefs(projectStore());

const plans = ref<any[]>([]);
const outputs = ref<any[]>([]);
const selectedPlanId = ref<string | null>(null);
const selectedOutputId = ref<number | null>(null);
const referencedAssetIds = ref<number[]>([]);
const outputSizePreset = ref("general_vertical_1080x1920");
const galleryRef = ref<InstanceType<typeof OutputGallery>>();
const planListRef = ref<InstanceType<typeof PlanList>>();

async function enrichOutputs(raw: any[]) {
  if (!raw.length || !project.value?.id) return raw;
  const { data } = await pollingOutputs(Number(project.value.id), raw.map((o) => o.imageId));
  return raw.map((o) => {
    const polled = data?.find((d: any) => d.imageId === o.imageId);
    return polled ? { ...o, ...polled } : o;
  });
}

function onGenerateFromInspector(planId: string) {
  planListRef.value?.generateImage(planId);
}

async function loadWorkspace() {
  if (!project.value?.id) return;
  const { data } = await getWorkspace(Number(project.value.id));
  plans.value = data.workspace?.plans ?? [];
  outputs.value = await enrichOutputs(data.workspace?.outputs ?? []);
  selectedPlanId.value = data.workspace?.selectedPlanId ?? null;
  referencedAssetIds.value = data.workspace?.referencedAssetIds ?? [];
  outputSizePreset.value = data.workspace?.outputSizePreset ?? "general_vertical_1080x1920";
}

async function onPlansGenerated(payload: { plans: any[]; workspace?: any }) {
  plans.value = payload.plans ?? payload.workspace?.plans ?? [];
  if (payload.workspace) {
    selectedPlanId.value = payload.workspace.selectedPlanId;
    outputs.value = await enrichOutputs(payload.workspace.outputs ?? outputs.value);
  }
}

function onImageGenerated() {
  loadWorkspace();
  galleryRef.value?.refresh();
}

function onSelectPlan(planId: string) {
  selectedPlanId.value = planId;
  selectedOutputId.value = null;
}

function onPlanUpdated(payload: { id: string; title: string; copy: string; edited?: boolean }) {
  const idx = plans.value.findIndex((p) => p.id === payload.id);
  if (idx === -1) return;
  plans.value[idx] = {
    ...plans.value[idx],
    title: payload.title,
    copy: payload.copy,
    edited: payload.edited ?? true,
  };
}

onMounted(loadWorkspace);
</script>

<style scoped lang="scss">
.asoCanvasWorkbench {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--td-bg-color-page);
}

.canvasArea {
  flex: 1;
  min-width: 0;
  background-color: #eef0f4;
  background-image: radial-gradient(circle, rgba(120, 130, 150, 0.28) 1px, transparent 1px);
  background-size: 18px 18px;
}

.canvasScroll {
  height: 100%;
  overflow: auto;
  padding: 20px 24px 24px;
  box-sizing: border-box;
}

.canvasTrack {
  display: flex;
  align-items: flex-start;
  gap: 20px;
  min-height: calc(100% - 8px);
}

.canvasColumn {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-height: 520px;
}

.canvasColumnWide {
  width: 280px;
}

.columnHeader {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  margin-bottom: 10px;
  padding: 0 4px;
}

.columnBody {
  flex: 1;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  padding: 14px;
  min-height: 480px;
  overflow: auto;
}

.inspectorPane {
  width: 380px;
  flex-shrink: 0;
  border-left: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
}

.canvasColumn :deep(.materialGrid .grid) {
  grid-template-columns: 1fr;
}

.canvasColumn :deep(.planList.compact .planCard) {
  padding: 10px;
}

.canvasColumn :deep(.planList.compact .actions .t-button) {
  width: 100%;
}

@media (max-width: 1100px) {
  .asoCanvasWorkbench {
    flex-direction: column;
  }
  .inspectorPane {
    width: 100%;
    max-height: 42vh;
    border-left: none;
    border-top: 1px solid var(--td-border-level-1-color);
  }
  .canvasTrack {
    flex-direction: column;
  }
  .canvasColumn,
  .canvasColumnWide {
    width: 100%;
    min-height: auto;
  }
}
</style>
