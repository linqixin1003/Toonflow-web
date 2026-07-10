<template>

  <div class="asoInspector">

    <div class="inspectorHeader f ac jb">

      <span class="title">{{ headerTitle }}</span>

      <div class="headerActions f ac">

        <t-tag v-if="selectedPlan?.edited" size="small" theme="warning" variant="light">{{ $t("workbench.aso.edited") }}</t-tag>

        <t-tooltip :content="$t('workbench.aso.hideInspector')" placement="left">

          <t-button variant="text" size="small" shape="square" @click="emit('close')">

            <i-menu-fold-one theme="outline" size="18" />

          </t-button>

        </t-tooltip>

      </div>

    </div>



    <t-empty v-if="!selectedPlan && !selectedOutput" :description="$t('workbench.aso.inspectorEmpty')" />



    <template v-else-if="selectedOutput">

      <div class="section">

        <div class="sectionTitle">{{ $t("workbench.aso.sectionOutput") }}</div>

        <PlanOutputGrid
          :outputs="[selectedOutput]"
          :selected-image-id="selectedOutput.imageId"
          :retrying-image-id="retryingOutputId"
          @select="emit('selectOutput', $event)"
          @retry="emitRetryOutput"
          @edit="emitEditOutput" />

      </div>

    </template>



    <template v-else-if="selectedPlan">

      <div class="section">

        <t-input

          v-model="draftTitle"

          :label="$t('workbench.aso.planTitle')"

          :disabled="saving"

          @blur="savePlanFields" />

      </div>

      <div class="section">

        <t-textarea

          v-model="draftCopy"

          :label="$t('workbench.aso.planCopy')"

          :autosize="{ minRows: 4, maxRows: 12 }"

          :disabled="saving"

          @blur="savePlanFields" />

      </div>

      <div class="section" v-if="selectedPlan.imagePrompts?.length">

        <div class="sectionTitle">{{ $t("workbench.aso.planImagePrompts") }} ({{ selectedPlan.imagePrompts.length }})</div>

        <div class="inspectorPromptGrid">

          <div v-for="ip in selectedPlan.imagePrompts" :key="ip.slot" class="inspectorPromptCell">

            <div class="inspectorPromptHead">

              <span class="slotBadge">{{ ip.slot }}</span>

              <span class="inspectorPromptLabel">{{ ip.label }}</span>

            </div>

            <button
              type="button"
              class="inspectorPromptText inspectorPromptTextBtn"
              :title="$t('workbench.aso.clickToEditPrompt')"
              @click="openImagePromptEdit(ip)">
              {{ ip.prompt }}
            </button>

            <div class="inspectorPromptActions f ac jb">
              <t-button size="small" variant="text" theme="primary" @click="openImagePromptEdit(ip)">
                {{ $t("workbench.aso.editImagePrompt") }}
              </t-button>

              <t-button

                size="small"

                variant="outline"

                theme="primary"

                class="slotGenerateBtn"

                :loading="isSlotGenerating(ip.slot)"

                :disabled="isSlotGenerating(ip.slot)"

                @click="emitGenerate({ promptSlot: ip.slot })">

                {{ $t("workbench.aso.generateThisSlot") }}

              </t-button>
            </div>

          </div>

        </div>

      </div>

      <div class="section">

        <div class="sectionTitle">{{ $t("workbench.aso.planStats") }}</div>

        <ul class="statsList">

          <li>{{ $t("workbench.aso.statTitleChars", { count: titleLen }) }}</li>

          <li>{{ $t("workbench.aso.statCopyChars", { count: copyLen }) }}</li>

          <li v-if="selectedPlan.imagePrompts?.length">

            {{ $t("workbench.aso.statImagePrompts", { count: selectedPlan.imagePrompts.length }) }}

          </li>

          <li>{{ $t("workbench.aso.statMaterials", { count: referencedCount }) }}</li>

          <li>{{ $t("workbench.aso.statOutputs", { count: planOutputs.length }) }}</li>

        </ul>

      </div>

      <div class="section">

        <SizePresetSelect v-model="presetModel" />

      </div>

      <div class="section" v-if="planOutputs.length">

        <div class="sectionTitle">{{ $t("workbench.aso.planOutputs") }}</div>

        <PlanOutputGrid
          :outputs="planOutputs"
          :selected-image-id="selectedOutputId"
          :retrying-image-id="retryingOutputId"
          @select="emit('selectOutput', $event)"
          @retry="emitRetryOutput"
          @edit="emitEditOutput" />

      </div>

      <div class="footer">

        <t-button

          v-if="selectedPlan.imagePrompts?.length"

          block

          theme="primary"

          :loading="generating"

          :disabled="generating"

          @click="emitGenerate({ generateAll: true })">

          {{ $t("workbench.aso.generateAllSlots", { count: selectedPlan.imagePrompts.length }) }}

        </t-button>

        <t-button

          v-else

          block

          theme="primary"

          :loading="generating"

          :disabled="generating"

          @click="emitGenerate()">

          {{ $t("workbench.aso.generateImage") }}

        </t-button>

      </div>

    </template>

    <ImagePromptEditDialog
      v-model:visible="editVisible"
      v-model:saving="editSaving"
      :slot="editingSlot"
      :label="editingLabel"
      :prompt="editingPrompt"
      @save="onImagePromptSave" />

  </div>

</template>



<script setup lang="ts">

import SizePresetSelect from "./SizePresetSelect.vue";

import PlanOutputGrid from "./components/PlanOutputGrid.vue";

import ImagePromptEditDialog from "./components/ImagePromptEditDialog.vue";

import { useCreativeApi } from "@/composables/useCreativeApi";
import projectStore from "@/stores/project";

import { usePlanImagePromptEditor } from "./composables/usePlanImagePromptEditor";
import { resolveOutputPlanId } from "./utils/asoFlowBuilder";

const props = defineProps<{
  plans: any[];

  outputs: any[];

  selectedPlanId: string | null;

  selectedOutputId: number | null;

  referencedCount: number;

  presetId: string;

  generating: boolean;

  isSlotGenerating: (slot: number) => boolean;

  retryingOutputId?: number | null;

}>();



const emit = defineEmits<{

  "update:presetId": [id: string];

  generateImage: [planId: string, options?: { promptSlot?: number; generateAll?: boolean }];

  selectOutput: [imageId: number];

  retryOutput: [output: any];

  editOutput: [output: any];

  planUpdated: [payload: { id: string; title: string; copy: string; imagePrompts?: any[]; edited: boolean }];

  close: [];

}>();



const { project } = storeToRefs(projectStore());
const { api } = useCreativeApi();

const draftTitle = ref("");

const draftCopy = ref("");

const saving = ref(false);



const presetModel = computed({

  get: () => props.presetId,

  set: (v: string) => emit("update:presetId", v),

});



const selectedPlan = computed(() => props.plans.find((p) => p.id === props.selectedPlanId) ?? null);

const selectedOutput = computed(() => props.outputs.find((o) => o.imageId === props.selectedOutputId) ?? null);

const planOutputs = computed(() => {
  const planId = props.selectedPlanId;
  if (!planId) return [];
  return props.outputs.filter((o) => resolveOutputPlanId(o, props.plans) === planId);
});



watch(

  selectedPlan,

  (plan) => {

    if (!plan) {

      draftTitle.value = "";

      draftCopy.value = "";

      return;

    }

    draftTitle.value = plan.title;

    draftCopy.value = plan.copy;

  },

  { immediate: true },

);



const titleLen = computed(() => draftTitle.value.length);

const copyLen = computed(() => draftCopy.value.length);

const {
  editVisible,
  editSaving,
  editingSlot,
  editingLabel,
  editingPrompt,
  openImagePromptEdit,
  onImagePromptSave,
} = usePlanImagePromptEditor(
  () => selectedPlan.value,
  (payload) => emit("planUpdated", payload),
);

function emitGenerate(options?: { promptSlot?: number; generateAll?: boolean }) {

  if (!selectedPlan.value) return;

  emit("generateImage", selectedPlan.value.id, options);

}



function emitRetryOutput(output: any) {

  emit("retryOutput", output);

}

function emitEditOutput(output: any) {
  emit("editOutput", output);
}



async function saveDraftForPlan(planId: string) {
  const plan = props.plans.find((p) => p.id === planId);
  if (!plan || !project.value?.id || saving.value) return;
  if (draftTitle.value === plan.title && draftCopy.value === plan.copy) return;
  saving.value = true;
  try {
    await api.value.updatePlan(Number(project.value.id), planId, {
      title: draftTitle.value,
      copy: draftCopy.value,
    });
    emit("planUpdated", {
      id: planId,
      title: draftTitle.value,
      copy: draftCopy.value,
      edited: true,
    });
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.aso.savePlanFailed"));
  } finally {
    saving.value = false;
  }
}

async function savePlanFields() {
  const plan = selectedPlan.value;
  if (!plan) return;
  await saveDraftForPlan(plan.id);
}

watch(
  () => props.selectedPlanId,
  (newId, oldId) => {
    if (oldId && oldId !== newId) void saveDraftForPlan(oldId);
  },
  { flush: "pre" },
);

watch(
  () => props.selectedOutputId,
  (id, prev) => {
    if (id != null && id !== prev && props.selectedPlanId) void savePlanFields();
  },
);

const headerTitle = computed(() => {

  if (selectedOutput.value) return $t("workbench.aso.outputsTitle");

  if (selectedPlan.value) return selectedPlan.value.title || $t("workbench.aso.sectionPlans");

  return $t("workbench.aso.inspectorTitle");

});

</script>



<style scoped lang="scss">

.asoInspector {

  height: 100%;

  display: flex;

  flex-direction: column;

  padding: 16px 18px 20px;

  box-sizing: border-box;

  overflow: auto;

}

.inspectorHeader {

  margin-bottom: 16px;

  padding-bottom: 12px;

  border-bottom: 1px solid var(--td-border-level-1-color);

}

.headerActions {

  gap: 8px;

  flex-shrink: 0;

}

.title {

  font-size: 16px;

  font-weight: 600;

  line-height: 1.4;

  word-break: break-word;

}

.section {

  margin-bottom: 18px;

}

.sectionTitle {

  font-size: 13px;

  font-weight: 600;

  color: var(--td-text-color-secondary);

  margin-bottom: 8px;

}

.statsList {

  margin: 0;

  padding-left: 18px;

  font-size: 13px;

  line-height: 1.8;

  color: var(--td-text-color-primary);

}

.footer {

  margin-top: auto;

  padding-top: 12px;

}

.inspectorPromptGrid {

  display: grid;

  grid-template-columns: repeat(2, minmax(0, 1fr));

  gap: 8px;

}

.inspectorPromptCell {

  border: 1px solid var(--td-border-level-1-color);

  border-radius: 8px;

  padding: 8px;

  background: var(--td-bg-color-secondarycontainer);

  display: flex;

  flex-direction: column;

  gap: 6px;

}

.inspectorPromptHead {

  display: flex;

  align-items: center;

  gap: 6px;

}

.slotBadge {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  min-width: 20px;

  height: 20px;

  padding: 0 4px;

  border-radius: 4px;

  background: var(--td-brand-color);

  color: #fff;

  font-size: 11px;

  font-weight: 700;

}

.inspectorPromptLabel {

  font-size: 12px;

  font-weight: 600;

  overflow: hidden;

  text-overflow: ellipsis;

  white-space: nowrap;

}

.inspectorPromptText {

  font-size: 12px;

  line-height: 1.5;

  color: var(--td-text-color-secondary);

  white-space: pre-wrap;

  word-break: break-word;

  max-height: 160px;

  overflow: auto;

  flex: 1;

  text-align: left;

}

.inspectorPromptTextBtn {
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s ease;

  &:hover {
    background: rgba(0, 82, 217, 0.08);
    color: var(--td-text-color-primary);
  }
}

.inspectorPromptActions {
  gap: 4px;
  flex-wrap: wrap;
}

.slotGenerateBtn {

  flex: 1;

  min-width: 0;

}

</style>


