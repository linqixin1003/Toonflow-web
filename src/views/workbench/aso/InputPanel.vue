<template>
  <div class="inputPanel">
    <t-textarea
      v-model="inputText"
      :autosize="{ minRows: 4, maxRows: 10 }"
      :placeholder="$t('workbench.aso.inputPlaceholder')" />
    <div class="row f ac jb">
      <div class="planCountWrap f ac">
        <span class="planCountLabel">{{ $t("workbench.aso.planCount") }}</span>
        <t-input-number v-model="planCount" :min="1" :max="10" theme="column" @change="onPlanCountChange" />
      </div>
      <t-button theme="primary" :loading="streaming" @click="onGenerate">
        {{ $t("workbench.aso.generatePlans") }}
      </t-button>
    </div>
    <div v-if="streamText" class="streamPreview">{{ streamText }}</div>
  </div>
</template>

<script setup lang="ts">
import { useAsoPlanStream } from "@/composables/useAsoPlanStream";
import { getWorkspace, saveWorkspace } from "@/api/aso";
import projectStore from "@/stores/project";
import { ASO_WORKBENCH_KEY } from "./asoContext";

const props = defineProps<{ assetIds?: number[] }>();
const emit = defineEmits<{ generated: [payload: { plans: any[]; workspace: any }] }>();

const ctx = inject(ASO_WORKBENCH_KEY, null);
const { project } = storeToRefs(projectStore());
const inputText = ref("");
const planCount = ctx?.planCount ?? ref(1);
const { streaming, streamText, run } = useAsoPlanStream();

async function loadInputState() {
  if (!project.value?.id) return;
  const { data } = await getWorkspace(Number(project.value.id));
  inputText.value = data.workspace?.inputText ?? "";
  if (data.workspace?.planCount) planCount.value = data.workspace.planCount;
}

onMounted(loadInputState);

watch(
  () => project.value?.id,
  () => loadInputState(),
);

async function onPlanCountChange(val: number) {
  if (!project.value?.id || !val) return;
  await saveWorkspace(Number(project.value.id), { planCount: val });
}

async function onGenerate() {
  if (!project.value?.id) return;
  const hasAssets = (props.assetIds?.length ?? 0) > 0;
  if (!inputText.value.trim() && !hasAssets) {
    window.$message.warning($t("workbench.aso.inputRequired"));
    return;
  }
  const projectId = Number(project.value.id);
  const requested = planCount.value;
  try {
    await saveWorkspace(projectId, { inputText: inputText.value, planCount: requested });
    const result = await run({
      projectId,
      inputText: inputText.value,
      planCount: requested,
      assetIds: props.assetIds ?? [],
    });
    emit("generated", { plans: result.plans, workspace: result.workspace });
    const savedCount = result.workspace?.plans?.length ?? result.plans?.length ?? 0;
    if (savedCount < requested) {
      window.$message.warning($t("workbench.aso.plansPartialSaved", { saved: savedCount, requested }));
    } else if (savedCount > 1) {
      window.$message.success($t("workbench.aso.plansGeneratedCount", { count: savedCount }));
    } else {
      window.$message.success($t("workbench.aso.plansGenerated"));
    }
    if (result.visionFallback) {
      window.$message.warning($t("workbench.aso.visionFallback"));
    }
  } catch (e: any) {
    window.$message.error(
      e?.code === 409 ? $t("workbench.aso.plansDuplicateGenerating") : e?.message || $t("workbench.aso.generateFailed"),
    );
  }
}
</script>

<style scoped lang="scss">
.inputPanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.row {
  margin-top: 8px;
}
.planCountWrap {
  gap: 8px;
}
.planCountLabel {
  font-size: 14px;
  color: var(--td-text-color-primary);
  white-space: nowrap;
}
.streamPreview {
  max-height: 160px;
  overflow: auto;
  padding: 8px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
  font-size: 12px;
  white-space: pre-wrap;
}
</style>
