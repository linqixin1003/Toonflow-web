<template>
  <t-card class="asoPlanItem" :class="{ active: plan.id === selectedPlanId, hasMatrix: hasImagePrompts }" @click="onSelect">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ planTitle }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
      <Handle :id="handleIds.source" type="source" :position="Position.Right" style="right: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="body" @mousedown.stop @pointerdown.stop>
      <t-input v-model="draftTitle" :label="$t('workbench.aso.planTitle')" @blur="savePlan" @click.stop />
      <div v-if="hasImagePrompts" class="matrixSection">
        <div class="matrixTitle">{{ $t("workbench.aso.planImagePrompts") }} ({{ plan.imagePrompts.length }})</div>
        <div class="imagePromptGrid">
          <div v-for="ip in plan.imagePrompts" :key="ip.slot" class="promptCell">
            <div class="promptSlot">{{ ip.slot }}</div>
            <div class="promptLabel" :title="ip.label">{{ ip.label }}</div>
            <button type="button" class="promptText promptTextBtn" :title="$t('workbench.aso.clickToEditPrompt')" @click.stop="openImagePromptEdit(ip)">
              {{ ip.prompt }}
            </button>
            <div class="promptActions f ac jb">
              <t-button size="small" variant="text" theme="primary" @click.stop="openImagePromptEdit(ip)">
                {{ $t("workbench.aso.editImagePrompt") }}
              </t-button>
              <t-button
                size="small"
                variant="outline"
                theme="primary"
                class="slotBtn"
                :loading="ctx.isSlotGenerating(plan.id, ip.slot)"
                :disabled="ctx.isSlotGenerating(plan.id, ip.slot)"
                @click.stop="onGenerateSlot(ip.slot)">
                {{ $t("workbench.aso.generateThisSlot") }}
              </t-button>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="copyPreview">{{ plan.copy }}</div>
      <div v-if="hasImagePrompts && plan.copy" class="copySummary">{{ plan.copy }}</div>
      <div class="actions f ac jb">
        <t-tag v-if="plan.edited" theme="warning" variant="light">{{ $t("workbench.aso.edited") }}</t-tag>
        <span v-else />
        <t-button
          v-if="hasImagePrompts"
          size="small"
          theme="primary"
          :loading="isPlanGenerating"
          :disabled="isPlanGenerating"
          @click.stop="onGenerateAll">
          {{ $t("workbench.aso.generateAllSlots", { count: plan.imagePrompts.length }) }}
        </t-button>
        <t-button
          v-else
          size="small"
          theme="primary"
          :loading="isPlanGenerating"
          :disabled="isPlanGenerating"
          @click.stop="onGenerate">
          {{ $t("workbench.aso.generateImage") }}
        </t-button>
      </div>
    </div>
    <ImagePromptEditDialog
      v-model:visible="editVisible"
      v-model:saving="editSaving"
      :slot="editingSlot"
      :label="editingLabel"
      :prompt="editingPrompt"
      @save="onImagePromptSave" />
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { updatePlan } from "@/api/aso";
import projectStore from "@/stores/project";
import { ASO_WORKBENCH_KEY } from "../asoContext";
import ImagePromptEditDialog from "../components/ImagePromptEditDialog.vue";
import { usePlanImagePromptEditor } from "../composables/usePlanImagePromptEditor";

const props = defineProps<{
  id: string;
  data: {
    plan: any;
    handleIds: { target: string; source: string };
  };
}>();

const ctx = inject(ASO_WORKBENCH_KEY)!;
const { project } = storeToRefs(projectStore());

const plan = computed(() => props.data.plan);
const handleIds = computed(() => props.data.handleIds);
const selectedPlanId = ctx.selectedPlanId;
const hasImagePrompts = computed(() => (plan.value?.imagePrompts?.length ?? 0) > 0);

const isPlanGenerating = computed(() => {
  const id = plan.value?.id;
  if (!id) return false;
  const prefix = `${id}:`;
  for (const key of ctx.generatingSlots.value) {
    if (key.startsWith(prefix)) return true;
  }
  return false;
});

const draftTitle = ref("");
watch(
  plan,
  (p) => {
    draftTitle.value = p?.title ?? "";
  },
  { immediate: true },
);

const planTitle = computed(() => {
  const t = plan.value?.title?.trim();
  return t || $t("workbench.aso.sectionPlans");
});

const {
  editVisible,
  editSaving,
  editingSlot,
  editingLabel,
  editingPrompt,
  openImagePromptEdit,
  onImagePromptSave,
} = usePlanImagePromptEditor(
  () => plan.value,
  (payload) => ctx.onPlanUpdated(payload),
);

function onSelect() {
  ctx.onSelectPlan(plan.value.id);
}

async function savePlan() {
  if (!project.value?.id || draftTitle.value === plan.value.title) return;
  await updatePlan(Number(project.value.id), plan.value.id, {
    title: draftTitle.value,
    copy: plan.value.copy,
    imagePrompts: plan.value.imagePrompts,
  });
  ctx.onPlanUpdated({
    id: plan.value.id,
    title: draftTitle.value,
    copy: plan.value.copy,
    imagePrompts: plan.value.imagePrompts,
    edited: true,
  });
}

function onGenerate() {
  ctx.generatePlanImage(plan.value.id);
}

function onGenerateAll() {
  ctx.generatePlanImage(plan.value.id, undefined, { generateAll: true });
}

function onGenerateSlot(slot: number) {
  ctx.generatePlanImage(plan.value.id, undefined, { promptSlot: slot });
}
</script>

<style scoped lang="scss">
.asoPlanItem {
  width: 340px;
  cursor: pointer;
  user-select: text;

  &.hasMatrix {
    width: 720px;
  }

  &.active {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 2px var(--td-brand-color-light);
  }

  .titleBar {
    cursor: grab;
    user-select: none;
  }

  .title {
    background-color: #0f172a;
    width: fit-content;
    max-width: 280px;
    padding: 5px 10px;
    color: #fff;
    border-radius: 8px 0;
    font-size: 13px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.hasMatrix .title {
    max-width: 480px;
  }

  .body {
    margin-top: 10px;
  }

  .matrixTitle {
    margin-top: 8px;
    font-size: 12px;
    font-weight: 600;
    color: var(--td-text-color-primary);
  }

  .imagePromptGrid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 8px;
  }

  .promptCell {
    border: 1px solid var(--td-border-level-1-color);
    border-radius: 8px;
    padding: 8px;
    min-width: 0;
    background: var(--td-bg-color-secondarycontainer);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .promptSlot {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--td-brand-color);
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 4px;
  }

  .promptLabel {
    font-size: 11px;
    font-weight: 600;
    color: var(--td-text-color-primary);
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 4px;
  }

  .promptText {
    font-size: 11px;
    line-height: 1.45;
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 120px;
    overflow: auto;
    flex: 1;
    text-align: left;
  }

  .promptTextBtn {
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

  .promptActions {
    gap: 4px;
    flex-wrap: wrap;
  }

  .slotBtn {
    flex: 1;
    min-width: 0;
  }

  .copyPreview,
  .copySummary {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .copySummary {
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px dashed var(--td-border-level-1-color);
  }

  .actions {
    margin-top: 12px;
  }
}
</style>
