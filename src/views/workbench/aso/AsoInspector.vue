<template>
  <div class="asoInspector">
    <div class="inspectorHeader f ac jb">
      <span class="title">{{ headerTitle }}</span>
      <t-tag v-if="selectedPlan?.edited" size="small" theme="warning" variant="light">{{ $t("workbench.aso.edited") }}</t-tag>
    </div>

    <t-empty v-if="!selectedPlan && !selectedOutput" :description="$t('workbench.aso.inspectorEmpty')" />

    <template v-else-if="selectedOutput">
      <div class="section">
        <div class="sectionTitle">{{ $t("workbench.aso.sectionOutput") }}</div>
        <t-tag size="small" :theme="stateTheme(selectedOutput.state)" variant="light">{{ selectedOutput.state }}</t-tag>
        <t-tag size="small" variant="outline" class="mt8">{{ selectedOutput.presetId }}</t-tag>
        <div v-if="selectedOutput.state === '生成中'" class="previewBox f ac jc">
          <t-loading />
        </div>
        <img v-else-if="selectedOutput.filePath" :src="selectedOutput.filePath" class="previewImg" />
        <div v-else-if="selectedOutput.errorReason" class="errorText">{{ selectedOutput.errorReason }}</div>
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
      <div class="section">
        <div class="sectionTitle">{{ $t("workbench.aso.planStats") }}</div>
        <ul class="statsList">
          <li>{{ $t("workbench.aso.statTitleChars", { count: titleLen }) }}</li>
          <li>{{ $t("workbench.aso.statCopyChars", { count: copyLen }) }}</li>
          <li>{{ $t("workbench.aso.statMaterials", { count: referencedCount }) }}</li>
          <li>{{ $t("workbench.aso.statOutputs", { count: planOutputs.length }) }}</li>
        </ul>
      </div>
      <div class="section">
        <SizePresetSelect v-model="presetModel" />
      </div>
      <div class="section" v-if="planOutputs.length">
        <div class="sectionTitle">{{ $t("workbench.aso.planOutputs") }}</div>
        <div v-for="out in planOutputs" :key="out.imageId" class="outputRow f ac jb" @click="emit('selectOutput', out.imageId)">
          <span class="outputLabel">{{ out.presetId }}</span>
          <t-tag size="small" :theme="stateTheme(out.state)" variant="light">{{ out.state }}</t-tag>
        </div>
      </div>
      <div class="footer">
        <t-button
          block
          theme="primary"
          :loading="generating"
          :disabled="generating || generateBlocked"
          @click="emit('generateImage', selectedPlan.id)">
          {{ $t("workbench.aso.generateImage") }}
        </t-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import SizePresetSelect from "./SizePresetSelect.vue";
import { updatePlan } from "@/api/aso";
import projectStore from "@/stores/project";

const props = defineProps<{
  plans: any[];
  outputs: any[];
  selectedPlanId: string | null;
  selectedOutputId: number | null;
  referencedCount: number;
  presetId: string;
  generating: boolean;
  generateBlocked?: boolean;
}>();

const emit = defineEmits<{
  "update:presetId": [id: string];
  generateImage: [planId: string];
  selectOutput: [imageId: number];
  planUpdated: [payload: { id: string; title: string; copy: string; edited: boolean }];
}>();

const { project } = storeToRefs(projectStore());
const draftTitle = ref("");
const draftCopy = ref("");
const saving = ref(false);

const presetModel = computed({
  get: () => props.presetId,
  set: (v: string) => emit("update:presetId", v),
});

const selectedPlan = computed(() => props.plans.find((p) => p.id === props.selectedPlanId) ?? null);
const selectedOutput = computed(() => props.outputs.find((o) => o.imageId === props.selectedOutputId) ?? null);
const planOutputs = computed(() => props.outputs.filter((o) => o.planId === props.selectedPlanId));

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

async function savePlanFields() {
  const plan = selectedPlan.value;
  if (!plan || !project.value?.id || saving.value) return;
  if (draftTitle.value === plan.title && draftCopy.value === plan.copy) return;
  saving.value = true;
  try {
    await updatePlan(Number(project.value.id), plan.id, {
      title: draftTitle.value,
      copy: draftCopy.value,
    });
    emit("planUpdated", {
      id: plan.id,
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

const headerTitle = computed(() => {
  if (selectedOutput.value) return $t("workbench.aso.outputsTitle");
  if (selectedPlan.value) return selectedPlan.value.title || $t("workbench.aso.sectionPlans");
  return $t("workbench.aso.inspectorTitle");
});

function stateTheme(state: string) {
  if (state === "已完成") return "success";
  if (state === "生成失败") return "danger";
  return "primary";
}
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
.detailText {
  font-size: 14px;
  line-height: 1.6;
  word-break: break-word;
  &.copy {
    white-space: pre-wrap;
  }
}
.statsList {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--td-text-color-primary);
}
.outputRow {
  padding: 8px 10px;
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  &:hover {
    border-color: var(--td-brand-color);
  }
}
.outputLabel {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
.previewBox {
  min-height: 200px;
  margin-top: 12px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}
.previewImg {
  width: 100%;
  margin-top: 12px;
  border-radius: 8px;
  display: block;
}
.errorText {
  margin-top: 12px;
  font-size: 12px;
  color: var(--td-error-color);
  word-break: break-word;
}
.footer {
  margin-top: auto;
  padding-top: 12px;
}
.mt8 {
  margin-top: 8px;
}
</style>
