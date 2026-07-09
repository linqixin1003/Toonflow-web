<template>
  <div class="inputPanel">
    <t-textarea
      v-model="inputText"
      :autosize="{ minRows: 4, maxRows: 10 }"
      :placeholder="$t('workbench.aso.inputPlaceholder')" />
    <div class="countsRow f ac">
      <div class="countWrap f ac">
        <span class="countLabel">{{ $t("workbench.aso.planCount") }}</span>
        <t-input-number v-model="planCount" :min="1" :max="10" theme="column" @change="onCountsChange" />
      </div>
      <div class="countWrap f ac">
        <span class="countLabel">{{ $t("workbench.aso.imagePromptCount") }}</span>
        <t-input-number v-model="imagePromptCount" :min="0" :max="20" theme="column" @change="onCountsChange" />
      </div>
      <t-button theme="primary" :loading="streaming" @click="onGenerate">
        {{ $t("workbench.aso.generatePlans") }}
      </t-button>
    </div>
    <div class="planHint">{{ $t("workbench.aso.planCountHint") }}</div>
    <div class="planHint">{{ $t("workbench.aso.imagePromptCountHint") }}</div>
    <div v-if="totalPromptCount > 0" class="planHint highlight">
      {{
        $t("workbench.aso.totalPromptsHint", {
          plans: planCount,
          images: effectiveImagePromptCount,
          total: totalPromptCount,
        })
      }}
    </div>
    <div v-if="existingPlanCount > 0" class="planHint">
      {{
        $t("workbench.aso.existingPlansHint", {
          count: existingPlanCount,
          requested: planCount,
          total: existingPlanCount + planCount,
        })
      }}
    </div>
    <div v-if="streamProgress" class="planHint highlight">{{ streamProgress }}</div>
    <div v-if="streamText" class="streamPreview">{{ streamText }}</div>

    <t-dialog
      v-model:visible="showGenModeDialog"
      :header="$t('workbench.aso.generateModeTitle')"
      attach="body"
      placement="center"
      width="480px"
      :footer="false"
      @close="pendingGenerate = null">
      <p class="genModeBody">
        {{
          $t("workbench.aso.generateModeBody", {
            existing: pendingGenerate?.existing ?? 0,
            requested: pendingGenerate?.requested ?? 0,
            total: (pendingGenerate?.existing ?? 0) + (pendingGenerate?.requested ?? 0),
          })
        }}
      </p>
      <div class="genModeActions">
        <t-button variant="outline" @click="showGenModeDialog = false">{{ $t("workbench.aso.generateModeCancel") }}</t-button>
        <t-button variant="outline" theme="danger" @click="confirmGenerate('replace')">
          {{ $t("workbench.aso.generateModeReplace") }}
        </t-button>
        <t-button theme="primary" :disabled="!canAppend" @click="confirmGenerate('append')">
          {{ $t("workbench.aso.generateModeAppend") }}
        </t-button>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { useAsoPlanStream } from "@/composables/useAsoPlanStream";
import { getWorkspace, saveWorkspace } from "@/api/aso";
import projectStore from "@/stores/project";
import { ASO_WORKBENCH_KEY } from "./asoContext";
import { resolveImagePromptCount } from "@/utils/asoNumberedPoints";

const props = defineProps<{ assetIds?: number[] }>();
const emit = defineEmits<{ generated: [payload: { plans: any[]; workspace: any }] }>();

const ctx = inject(ASO_WORKBENCH_KEY, null);
const { project } = storeToRefs(projectStore());
const inputText = ref("");
const planCount = ctx?.planCount ?? ref(1);
const imagePromptCount = ctx?.imagePromptCount ?? ref(0);
const { streaming, streamText, run, abort: abortPlanStream } = useAsoPlanStream();
const streamProgress = ref("");
const showGenModeDialog = ref(false);
const pendingGenerate = ref<{ existing: number; requested: number } | null>(null);
const MAX_PLAN_COUNT = 10;

const existingPlanCount = computed(() => ctx?.plans.value.filter((p) => p?.id).length ?? 0);
const detectedImageCount = computed(() => resolveImagePromptCount(inputText.value, null));
const effectiveImagePromptCount = computed(() =>
  resolveImagePromptCount(inputText.value, imagePromptCount.value),
);
const totalPromptCount = computed(() => planCount.value * effectiveImagePromptCount.value);
const canAppend = computed(() => {
  const existing = pendingGenerate.value?.existing ?? existingPlanCount.value;
  const requested = pendingGenerate.value?.requested ?? planCount.value;
  return existing + requested <= MAX_PLAN_COUNT;
});

let remeasureTimer: ReturnType<typeof setTimeout> | null = null;
watch(streamText, () => {
  if (!ctx?.remeasureFlowNodes) return;
  if (remeasureTimer) clearTimeout(remeasureTimer);
  remeasureTimer = setTimeout(() => {
    remeasureTimer = null;
    ctx.remeasureFlowNodes();
  }, 150);
});

onBeforeUnmount(() => {
  if (remeasureTimer) clearTimeout(remeasureTimer);
  abortPlanStream();
});

function syncCountsFromWorkspace(workspace: any) {
  planCount.value = Math.min(Math.max(workspace?.planCount ?? 1, 1), 10);
  const saved = workspace?.imagePromptCount ?? 0;
  imagePromptCount.value = Math.min(Math.max(saved, 0), 20);
}

async function loadInputState() {
  if (!project.value?.id) return;
  const { data } = await getWorkspace(Number(project.value.id));
  inputText.value = data.workspace?.inputText ?? "";
  syncCountsFromWorkspace(data.workspace);
  const savedPromptCount = data.workspace?.imagePromptCount;
  if (
    savedPromptCount == null &&
    imagePromptCount.value === 0 &&
    detectedImageCount.value > 0
  ) {
    imagePromptCount.value = detectedImageCount.value;
  }
}

onMounted(loadInputState);

watch(
  () => project.value?.id,
  () => {
    abortPlanStream();
    streamProgress.value = "";
    streamText.value = "";
    void loadInputState();
  },
);

async function onCountsChange() {
  if (!project.value?.id) return;
  await saveWorkspace(Number(project.value.id), {
    planCount: planCount.value,
    imagePromptCount: imagePromptCount.value,
  });
}

function confirmGenerate(mode: "append" | "replace") {
  showGenModeDialog.value = false;
  if (!pendingGenerate.value) return;
  if (mode === "append" && !canAppend.value) {
    window.$message.warning(
      $t("workbench.aso.plansAppendLimit", {
        max: MAX_PLAN_COUNT,
        existing: pendingGenerate.value.existing,
        remaining: MAX_PLAN_COUNT - pendingGenerate.value.existing,
      }),
    );
    return;
  }
  void executeGenerate(mode === "append");
}

async function executeGenerate(appendPlans: boolean) {
  if (!project.value?.id) return;
  const projectId = Number(project.value.id);
  const requested = planCount.value;
  const imgCount = effectiveImagePromptCount.value;
  const existingAtStart = appendPlans ? existingPlanCount.value : 0;

  if (appendPlans && existingAtStart + requested > MAX_PLAN_COUNT) {
    window.$message.warning(
      $t("workbench.aso.plansAppendLimit", {
        max: MAX_PLAN_COUNT,
        existing: existingAtStart,
        remaining: MAX_PLAN_COUNT - existingAtStart,
      }),
    );
    return;
  }

  try {
    streamProgress.value = "";
    if (!appendPlans && ctx) {
      ctx.plans.value = [];
      ctx.outputs.value = [];
    }
    await saveWorkspace(projectId, {
      inputText: inputText.value,
      planCount: requested,
      imagePromptCount: imagePromptCount.value,
    });
    const result = await run({
      projectId,
      inputText: inputText.value,
      planCount: requested,
      imagePromptCount: imgCount,
      appendPlans,
      assetIds: props.assetIds ?? [],
      onEvent: (event, data) => {
        if (Number(project.value?.id) !== projectId) return;
        if (event === "plan_start" && data.batched) {
          streamText.value = "";
        }
        if (event === "plan_start" && data.total > 0) {
          const batchTotal = appendPlans ? requested : data.total;
          const batchIndex = appendPlans
            ? (data.index ?? 0) - existingAtStart + 1
            : data.batched
              ? (data.index ?? 0) - (data.planIndexOffset ?? 0) + 1
              : 1;
          streamProgress.value = $t("workbench.aso.planGeneratingProgress", {
            current: Math.max(batchIndex, 1),
            total: batchTotal,
          });
        }
        if (event === "plan_done" && ctx) {
          if (Number(project.value?.id) !== projectId) return;
          const next = [...ctx.plans.value];
          while (next.length <= data.index) next.push(null as any);
          next[data.index] = data.plan;
          ctx.plans.value = next;
          void ctx.layoutGraphIncremental?.();
        }
      },
    });
    if (Number(project.value?.id) !== projectId) return;
    streamProgress.value = "";
    emit("generated", { plans: result.plans, workspace: result.workspace });
    const savedCount = result.workspace?.plans?.length ?? result.plans?.length ?? 0;
    const addedCount = appendPlans ? requested : savedCount;
    if (!appendPlans && savedCount < requested) {
      window.$message.warning($t("workbench.aso.plansPartialSaved", { saved: savedCount, requested }));
    } else if (appendPlans) {
      window.$message.success($t("workbench.aso.plansAppended", { added: addedCount, total: savedCount }));
    } else if (imgCount > 0) {
      window.$message.success(
        $t("workbench.aso.plansGeneratedMatrix", { plans: savedCount, images: imgCount, total: savedCount * imgCount }),
      );
    } else if (savedCount > 1) {
      window.$message.success($t("workbench.aso.plansGeneratedCount", { count: savedCount }));
    } else {
      window.$message.success($t("workbench.aso.plansGenerated"));
    }
    if (result.visionFallback) {
      window.$message.warning($t("workbench.aso.visionFallback"));
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return;
    streamProgress.value = "";
    if (ctx) {
      await ctx.loadWorkspace({ plans: true, layout: true, meta: true, outputs: true });
      await ctx.layoutGraphIncremental?.();
    }
    window.$message.error(
      e?.code === 409 ? $t("workbench.aso.plansDuplicateGenerating") : e?.message || $t("workbench.aso.generateFailed"),
    );
  }
}

async function onGenerate() {
  if (!project.value?.id) return;
  const hasAssets = (props.assetIds?.length ?? 0) > 0;
  if (!inputText.value.trim() && !hasAssets) {
    window.$message.warning($t("workbench.aso.inputRequired"));
    return;
  }
  const requested = planCount.value;
  const existing = existingPlanCount.value;
  if (existing > 0) {
    pendingGenerate.value = { existing, requested };
    showGenModeDialog.value = true;
    return;
  }
  await executeGenerate(false);
}
</script>

<style scoped lang="scss">
.inputPanel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.countsRow {
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}
.countWrap {
  gap: 8px;
}
.countLabel {
  font-size: 14px;
  color: var(--td-text-color-primary);
  white-space: nowrap;
}
.planHint {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
}
.planHint.highlight {
  color: var(--td-brand-color);
  font-weight: 600;
}
.streamPreview {
  padding: 8px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.genModeBody {
  margin: 0 0 20px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--td-text-color-primary);
}
.genModeActions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
