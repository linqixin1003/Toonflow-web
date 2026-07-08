<template>
  <div class="planList" :class="{ compact }">
    <t-empty v-if="!plans.length" :description="$t('workbench.aso.emptyPlans')" />
    <t-card
      v-for="plan in plans"
      :key="plan.id"
      class="planCard"
      :class="{ active: plan.id === selectedPlanId }"
      @click="selectPlan(plan.id)">
      <t-input v-model="plan.title" :label="$t('workbench.aso.planTitle')" @blur="savePlan(plan)" @click.stop />
      <t-textarea
        v-if="!compact"
        v-model="plan.copy"
        :autosize="{ minRows: 3, maxRows: 8 }"
        :label="$t('workbench.aso.planCopy')"
        @blur="savePlan(plan)"
        @click.stop />
      <div v-else class="copyPreview" @click.stop>{{ plan.copy }}</div>
      <div class="actions f ac jb">
        <t-tag v-if="plan.edited" theme="warning" variant="light">{{ $t("workbench.aso.edited") }}</t-tag>
        <span v-else />
        <t-button
          size="small"
          theme="primary"
          :loading="generatingPlanId === plan.id"
          :disabled="!!generatingPlanId"
          @click.stop="onGenerateImage(plan)">
          {{ $t("workbench.aso.generateImage") }}
        </t-button>
      </div>
    </t-card>
  </div>
</template>

<script setup lang="ts">
import { updatePlan, saveWorkspace, generateAsoImage, pollingOutputs } from "@/api/aso";
import projectStore from "@/stores/project";

const props = defineProps<{
  plans: any[];
  selectedPlanId: string | null;
  presetId?: string;
  referencedAssetIds?: number[];
  compact?: boolean;
}>();

const emit = defineEmits<{
  "update:selectedPlanId": [id: string];
  generated: [payload: { imageId: number; planId: string; done?: boolean }];
  select: [planId: string];
}>();

const { project } = storeToRefs(projectStore());
const generatingPlanId = ref<string | null>(null);
const localPlans = ref<any[]>([]);
let pollTimer: ReturnType<typeof setInterval> | null = null;

watch(
  () => props.plans,
  (val) => {
    localPlans.value = val.map((p) => ({ ...p }));
  },
  { immediate: true, deep: true },
);

const plans = computed(() => localPlans.value);

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function selectPlan(planId: string) {
  emit("update:selectedPlanId", planId);
  emit("select", planId);
  if (!project.value?.id) return;
  await saveWorkspace(Number(project.value.id), { selectedPlanId: planId });
}

async function savePlan(plan: any) {
  if (!project.value?.id) return;
  await updatePlan(Number(project.value.id), plan.id, { title: plan.title, copy: plan.copy });
  plan.edited = true;
}

async function onGenerateImage(plan: any) {
  if (!project.value?.id || generatingPlanId.value) return;
  const projectId = Number(project.value.id);
  generatingPlanId.value = plan.id;
  try {
    const { data } = await generateAsoImage(projectId, plan.id, props.presetId, props.referencedAssetIds);
    emit("generated", { imageId: data.imageId, planId: plan.id, done: false });
    pollUntilDone(projectId, data.imageId, plan.id);
  } catch (e: any) {
    const msg = e?.message || $t("workbench.aso.generateFailed");
    window.$message.error(e?.code === 409 ? $t("workbench.aso.duplicateGenerating") : msg);
    generatingPlanId.value = null;
  }
}

function pollUntilDone(projectId: number, imageId: number, planId: string) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const { data } = await pollingOutputs(projectId, [imageId]);
      const item = data?.[0];
      if (!item) return;
      if (item.state === "已完成") {
        clearInterval(pollTimer!);
        pollTimer = null;
        generatingPlanId.value = null;
        emit("generated", { imageId, planId, done: true });
        window.$message.success($t("workbench.aso.imageDone"));
      }
      if (item.state === "生成失败") {
        clearInterval(pollTimer!);
        pollTimer = null;
        generatingPlanId.value = null;
        emit("generated", { imageId, planId, done: true });
        window.$message.error(item.errorReason || $t("workbench.aso.generateFailed"));
      }
    } catch {
      clearInterval(pollTimer!);
      pollTimer = null;
      generatingPlanId.value = null;
    }
  }, 2000);
}

function generateImage(planId: string) {
  const plan = plans.value.find((p) => p.id === planId);
  if (!plan) return Promise.resolve();
  return onGenerateImage(plan);
}

defineExpose({ generateImage, generatingPlanId });
</script>

<style scoped lang="scss">
.planList {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.planCard {
  cursor: pointer;
  &.active {
    border-color: var(--td-brand-color);
  }
}
.actions {
  margin-top: 12px;
}
.copyPreview {
  margin-top: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--td-text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.planList.compact .planCard.active {
  box-shadow: 0 0 0 2px var(--td-brand-color-light);
}
</style>
