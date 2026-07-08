<template>
  <div class="asoWorkbench">
    <div class="layout">
      <section class="column left">
        <t-card :title="$t('workbench.aso.sectionInput')" bordered>
          <InputPanel :asset-ids="referencedAssetIds" @generated="onPlansGenerated" />
        </t-card>
        <t-card :title="$t('workbench.aso.sectionMaterials')" bordered>
          <MaterialGrid v-model:referenced-asset-ids="referencedAssetIds" @changed="loadWorkspace" />
        </t-card>
      </section>
      <section class="column right">
        <t-card :title="$t('workbench.aso.sectionPlans')" bordered>
          <SizePresetSelect v-model="outputSizePreset" class="presetRow" />
          <PlanList
            v-model:selected-plan-id="selectedPlanId"
            :plans="plans"
            :preset-id="outputSizePreset"
            :referenced-asset-ids="referencedAssetIds"
            @generated="onImageGenerated" />
        </t-card>
        <t-card :title="$t('workbench.aso.sectionOutput')" bordered>
          <OutputGallery ref="galleryRef" :outputs="outputs" />
        </t-card>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import InputPanel from "./InputPanel.vue";
import PlanList from "./PlanList.vue";
import MaterialGrid from "./MaterialGrid.vue";
import SizePresetSelect from "./SizePresetSelect.vue";
import OutputGallery from "./OutputGallery.vue";
import { getWorkspace, pollingOutputs } from "@/api/aso";
import projectStore from "@/stores/project";

const { project } = storeToRefs(projectStore());

const plans = ref<any[]>([]);
const outputs = ref<any[]>([]);
const selectedPlanId = ref<string | null>(null);
const referencedAssetIds = ref<number[]>([]);
const outputSizePreset = ref("general_vertical_1080x1920");
const galleryRef = ref<InstanceType<typeof OutputGallery>>();

async function enrichOutputs(raw: any[]) {
  if (!raw.length || !project.value?.id) return raw;
  const { data } = await pollingOutputs(Number(project.value.id), raw.map((o) => o.imageId));
  return raw.map((o) => {
    const polled = data?.find((d: any) => d.imageId === o.imageId);
    return polled ? { ...o, ...polled } : o;
  });
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

onMounted(loadWorkspace);
</script>

<style scoped lang="scss">
.asoWorkbench {
  padding: 20px 24px 32px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
.column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.presetRow {
  margin-bottom: 12px;
}
@media (max-width: 1200px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
