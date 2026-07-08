<template>
  <t-card class="asoPlanItem" :class="{ active: plan.id === selectedPlanId }" @click="onSelect">
    <div class="titleBar dragHandle pr">
      <div class="title c">{{ planTitle }}</div>
      <Handle :id="handleIds.target" type="target" :position="Position.Left" style="left: calc(-1 * var(--td-comp-paddingLR-xl))" />
      <Handle :id="handleIds.source" type="source" :position="Position.Right" style="right: calc(-1 * var(--td-comp-paddingLR-xl))" />
    </div>
    <div class="body" @mousedown.stop @pointerdown.stop>
      <t-input v-model="draftTitle" :label="$t('workbench.aso.planTitle')" @blur="savePlan" @click.stop />
      <div class="copyPreview">{{ plan.copy }}</div>
      <div class="actions f ac jb">
        <t-tag v-if="plan.edited" theme="warning" variant="light">{{ $t("workbench.aso.edited") }}</t-tag>
        <span v-else />
        <t-button
          size="small"
          theme="primary"
          :loading="generatingPlanId === plan.id"
          :disabled="!!generatingPlanId"
          @click.stop="onGenerate">
          {{ $t("workbench.aso.generateImage") }}
        </t-button>
      </div>
    </div>
  </t-card>
</template>

<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
import { updatePlan } from "@/api/aso";
import projectStore from "@/stores/project";
import { ASO_WORKBENCH_KEY } from "../asoContext";

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
const generatingPlanId = ctx.generatingPlanId;

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

function onSelect() {
  ctx.onSelectPlan(plan.value.id);
}

async function savePlan() {
  if (!project.value?.id || draftTitle.value === plan.value.title) return;
  await updatePlan(Number(project.value.id), plan.value.id, { title: draftTitle.value, copy: plan.value.copy });
  ctx.onPlanUpdated({
    id: plan.value.id,
    title: draftTitle.value,
    copy: plan.value.copy,
    edited: true,
  });
}

function onGenerate() {
  ctx.generatePlanImage(plan.value.id);
}
</script>

<style scoped lang="scss">
.asoPlanItem {
  width: 340px;
  cursor: pointer;
  user-select: text;

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

  .body {
    margin-top: 10px;
  }

  .copyPreview {
    margin-top: 8px;
    font-size: 12px;
    line-height: 1.5;
    color: var(--td-text-color-secondary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .actions {
    margin-top: 12px;
  }
}
</style>
