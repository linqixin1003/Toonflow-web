<template>
  <div class="asoFlowWorkbench f">
    <div class="flowPane">
      <VueFlow
        id="asoFlowBox"
        class="flowMain"
        :class="{ 'is-interacting': isInteracting && otherSetting.interacting, 'space-dragging': isSpacePressed }"
        :nodes="nodes"
        :edges="edges"
        :nodes-draggable="!isSpacePressed"
        :nodes-connectable="false"
        :elements-selectable="!isSpacePressed"
        :edges-updatable="false"
        :nodes-focusable="false"
        :edges-focusable="false"
        :disable-keyboard-a11y="true"
        :select-nodes-on-drag="false"
        :auto-pan-on-node-drag="false"
        :zoom-on-double-click="false"
        :delete-key-code="null"
        fit-view-on-init
        :min-zoom="0.2"
        :max-zoom="2"
        :pan-on-scroll="canvasWheelEvent === 'scroll'"
        :zoom-on-scroll="canvasWheelEvent === 'zoom'"
        @mousedown="onSpaceMouseDown">
        <template #node-asoInput="slotProps">
          <AsoInputNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <template #node-asoMaterials="slotProps">
          <AsoMaterialsNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <template #node-asoPlanItem="slotProps">
          <AsoPlanItemNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <template #node-asoOutputItem="slotProps">
          <AsoOutputItemNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <Background />
        <Controls />
        <div class="flowToolbar f ac">
          <t-tooltip :content="$t('workbench.aso.flowAutoLayout')" placement="bottom">
            <t-button variant="outline" @click="layoutGraph(true)">
              <template #icon><i-tree-diagram size="16" /></template>
            </t-button>
          </t-tooltip>
          <span class="flowHint">{{ $t("workbench.aso.flowHint") }}</span>
        </div>
        <t-tooltip v-if="!inspectorVisible" :content="$t('workbench.aso.showInspector')" placement="left">
          <div class="openInspectorBtn c" @click.stop="inspectorVisible = true">
            <i-menu-unfold-one theme="outline" size="22" />
          </div>
        </t-tooltip>
      </VueFlow>
    </div>

    <transition name="inspector-slide">
      <aside v-show="inspectorVisible" class="inspectorPane">
        <AsoInspector
          :plans="plans"
          :outputs="outputs"
          :selected-plan-id="selectedPlanId"
          :selected-output-id="selectedOutputId"
          :referenced-count="referencedAssetIds.length"
          :preset-id="outputSizePreset"
          :generating="generatingPlanId === selectedPlanId"
          :generate-blocked="!!generatingPlanId && generatingPlanId !== selectedPlanId"
          @update:preset-id="outputSizePreset = $event"
          @generate-image="generatePlanImage"
          @select-output="selectedOutputId = $event"
          @plan-updated="onPlanUpdated"
          @close="inspectorVisible = false" />
      </aside>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { useEventListener, useLocalStorage } from "@vueuse/core";
import { VueFlow, useVueFlow } from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";

import AsoInputNode from "./node/AsoInputNode.vue";
import AsoMaterialsNode from "./node/AsoMaterialsNode.vue";
import AsoPlanItemNode from "./node/AsoPlanItemNode.vue";
import AsoOutputItemNode from "./node/AsoOutputItemNode.vue";
import AsoInspector from "./AsoInspector.vue";
import { ASO_WORKBENCH_KEY } from "./asoContext";
import {
  ASO_NODE_IDS,
  DEFAULT_ASO_NODE_POSITIONS,
  planNodeId,
  outputNodeId,
  useAsoFlowBuilder,
  type AsoNodePositions,
} from "./utils/asoFlowBuilder";
import { getWorkspace, pollingOutputs, saveWorkspace, generateAsoImage } from "@/api/aso";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";

const { project } = storeToRefs(projectStore());
const { canvasWheelEvent, otherSetting } = storeToRefs(settingStore());

const {
  toObject,
  fromObject,
  fitView,
  findNode,
  onNodeDragStart,
  onNodeDragStop,
  onMoveStart,
  onMoveEnd,
  updateNodeInternals,
  getNodes,
  getViewport,
  setViewport,
} = useVueFlow({ id: "asoFlowBox" });

const plans = ref<any[]>([]);
const outputs = ref<any[]>([]);
const selectedPlanId = ref<string | null>(null);
const selectedOutputId = ref<number | null>(null);
const referencedAssetIds = ref<number[]>([]);
const outputSizePreset = ref("general_vertical_1080x1920");
const generatingPlanId = ref<string | null>(null);
const inspectorVisible = useLocalStorage("aso_inspector_visible", true);

const nodePositions = ref<AsoNodePositions>({ ...DEFAULT_ASO_NODE_POSITIONS });
const { nodes, edges } = useAsoFlowBuilder(nodePositions, plans, outputs);

const isSpacePressed = ref(false);
let dragOrigin = { x: 0, y: 0, vx: 0, vy: 0 };
let savePosTimer: ReturnType<typeof setTimeout> | null = null;
let outputPollTimer: ReturnType<typeof setInterval> | null = null;
let remeasureTimer: ReturnType<typeof setTimeout> | null = null;

function onSpaceMouseDown(e: MouseEvent) {
  if (!isSpacePressed.value || e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const vp = getViewport();
  dragOrigin = { x: e.clientX, y: e.clientY, vx: vp.x, vy: vp.y };
  document.addEventListener("mousemove", onSpaceMouseMove);
  document.addEventListener("mouseup", onSpaceMouseUp, { once: true });
}
function onSpaceMouseMove(e: MouseEvent) {
  setViewport({ x: dragOrigin.vx + e.clientX - dragOrigin.x, y: dragOrigin.vy + e.clientY - dragOrigin.y, zoom: getViewport().zoom });
}
function onSpaceMouseUp() {
  document.removeEventListener("mousemove", onSpaceMouseMove);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('[contenteditable="true"], .t-input, .t-textarea, .md-editor'));
}

useEventListener(document, "keydown", (e: KeyboardEvent) => {
  if (e.code === "Space" && !e.repeat) {
    if (isEditableTarget(e.target)) return;
    e.preventDefault();
    isSpacePressed.value = true;
  }
});
useEventListener(document, "keyup", (e: KeyboardEvent) => {
  if (e.code === "Space") isSpacePressed.value = false;
});

const isInteracting = ref(false);
let interactionTimer: ReturnType<typeof setTimeout> | null = null;
function startInteracting() {
  if (interactionTimer) clearTimeout(interactionTimer);
  isInteracting.value = true;
}
function stopInteracting() {
  if (interactionTimer) clearTimeout(interactionTimer);
  interactionTimer = setTimeout(() => {
    isInteracting.value = false;
  }, 150);
}

onNodeDragStart(() => startInteracting());
onMoveStart(() => startInteracting());
onMoveEnd(() => stopInteracting());

function pruneNodePositions() {
  const valid = new Set<string>([
    ASO_NODE_IDS.input,
    ASO_NODE_IDS.materials,
    ...plans.value.map((p) => planNodeId(p.id)),
    ...outputs.value.map((o) => outputNodeId(o.imageId)),
  ]);
  const next: AsoNodePositions = {};
  for (const [key, pos] of Object.entries(nodePositions.value)) {
    if (valid.has(key)) next[key] = pos;
  }
  nodePositions.value = next;
}

function scheduleSavePositions() {
  if (!project.value?.id) return;
  if (savePosTimer) clearTimeout(savePosTimer);
  savePosTimer = setTimeout(async () => {
    try {
      pruneNodePositions();
      await saveWorkspace(Number(project.value!.id), { nodePositions: nodePositions.value });
    } catch (e: any) {
      window.$message.error(e?.message || $t("workbench.aso.savePlanFailed"));
    }
  }, 500);
}

onNodeDragStop(async ({ nodes: draggedNodes }) => {
  await nextTick();
  stopInteracting();
  for (const node of draggedNodes) {
    nodePositions.value[node.id] = { x: node.position.x, y: node.position.y };
  }
  scheduleSavePositions();
});

async function enrichOutputs(raw: any[]) {
  if (!raw.length || !project.value?.id) return raw;
  const { data } = await pollingOutputs(Number(project.value.id), raw.map((o) => o.imageId));
  return raw.map((o) => {
    const polled = data?.find((d: any) => d.imageId === o.imageId);
    return polled ? { ...o, ...polled } : o;
  });
}

async function remeasureFlowNodes() {
  await nextTick();
  updateNodeInternals(getNodes.value.map((n) => n.id));
}

function scheduleRemeasure() {
  if (remeasureTimer) clearTimeout(remeasureTimer);
  remeasureTimer = setTimeout(() => {
    remeasureTimer = null;
    remeasureFlowNodes();
  }, 150);
}

function positionOutputNearPlan(planId: string, imageId: number) {
  const pid = planNodeId(planId);
  const oid = outputNodeId(imageId);
  if (nodePositions.value[oid]) return;
  const planPos = nodePositions.value[pid] ?? { x: 420, y: 0 };
  const siblings = outputs.value.filter((o) => o.planId === planId);
  const idx = siblings.findIndex((o) => o.imageId === imageId);
  nodePositions.value[oid] = {
    x: planPos.x + 420,
    y: planPos.y + Math.max(0, idx) * 300,
  };
}

function applyPollResults(items: any[]) {
  for (const item of items) {
    const idx = outputs.value.findIndex((o) => o.imageId === item.imageId);
    if (idx < 0) continue;
    const prev = outputs.value[idx];
    outputs.value[idx] = { ...prev, ...item };
    if (prev.state !== "生成中") continue;
    if (item.state === "已完成") {
      window.$message.success($t("workbench.aso.imageDone"));
      if (generatingPlanId.value && prev.planId === generatingPlanId.value) {
        generatingPlanId.value = null;
      }
    } else if (item.state === "生成失败") {
      window.$message.error(item.errorReason || $t("workbench.aso.generateFailed"));
      if (generatingPlanId.value && prev.planId === generatingPlanId.value) {
        generatingPlanId.value = null;
      }
    }
  }
}

function stopOutputPoll() {
  if (outputPollTimer) {
    clearInterval(outputPollTimer);
    outputPollTimer = null;
  }
}

function scheduleOutputPoll() {
  stopOutputPoll();
  const pending = outputs.value.filter((o) => o.state === "生成中").map((o) => o.imageId);
  if (!pending.length || !project.value?.id) return;
  outputPollTimer = setInterval(() => refreshOutputsPending(), 2500);
}

async function refreshOutputsPending() {
  if (!project.value?.id) return;
  const pending = outputs.value.filter((o) => o.state === "生成中").map((o) => o.imageId);
  if (!pending.length) {
    stopOutputPoll();
    if (generatingPlanId.value) generatingPlanId.value = null;
    return;
  }
  try {
    const { data } = await pollingOutputs(Number(project.value.id), pending);
    if (Array.isArray(data) && data.length) applyPollResults(data);
  } catch {
    return;
  }
  if (!outputs.value.some((o) => o.state === "生成中")) {
    stopOutputPoll();
    if (generatingPlanId.value) generatingPlanId.value = null;
  }
  scheduleRemeasure();
}

watch(outputs, scheduleOutputPoll, { deep: true });
watch(() => plans.value.length, scheduleRemeasure);
watch(() => outputs.value.length, scheduleRemeasure);

async function generatePlanImage(planId: string) {
  if (!project.value?.id || generatingPlanId.value) return;
  const projectId = Number(project.value.id);
  generatingPlanId.value = planId;
  try {
    const { data } = await generateAsoImage(projectId, planId, outputSizePreset.value, referencedAssetIds.value);
    await loadWorkspace();
    positionOutputNearPlan(planId, data.imageId);
    scheduleRemeasure();
  } catch (e: any) {
    const msg = e?.message || $t("workbench.aso.generateFailed");
    window.$message.error(e?.code === 409 ? $t("workbench.aso.duplicateGenerating") : msg);
    generatingPlanId.value = null;
  }
}

function applySavedLayout(saved: Record<string, { x: number; y: number }> | undefined): boolean {
  if (!saved || !Object.keys(saved).length) return false;
  const { asoPlans: _asoPlans, asoOutput: _asoOutput, ...rest } = saved as Record<string, { x: number; y: number }>;
  nodePositions.value = { ...DEFAULT_ASO_NODE_POSITIONS, ...rest };
  return true;
}

function needsPerItemLayout(): boolean {
  if (plans.value.some((p) => !nodePositions.value[planNodeId(p.id)])) return true;
  return outputs.value.some((o) => !nodePositions.value[outputNodeId(o.imageId)]);
}

async function loadWorkspace(): Promise<boolean> {
  if (!project.value?.id) return false;
  const { data } = await getWorkspace(Number(project.value.id));
  plans.value = data.workspace?.plans ?? [];
  outputs.value = await enrichOutputs(data.workspace?.outputs ?? []);
  selectedPlanId.value = data.workspace?.selectedPlanId ?? null;
  referencedAssetIds.value = data.workspace?.referencedAssetIds ?? [];
  outputSizePreset.value = data.workspace?.outputSizePreset ?? "general_vertical_1080x1920";
  const saved = data.workspace?.nodePositions;
  return applySavedLayout(saved);
}

async function onPlansGenerated(payload: { plans: any[]; workspace?: any }) {
  plans.value = payload.plans ?? payload.workspace?.plans ?? [];
  if (payload.workspace) {
    selectedPlanId.value = payload.workspace.selectedPlanId;
    outputs.value = await enrichOutputs(payload.workspace.outputs ?? outputs.value);
  }
  await remeasureFlowNodes();
  await layoutGraph(false);
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

provide(ASO_WORKBENCH_KEY, {
  referencedAssetIds,
  plans,
  outputs,
  selectedPlanId,
  selectedOutputId,
  outputSizePreset,
  generatingPlanId,
  loadWorkspace,
  onPlansGenerated,
  onSelectPlan,
  onPlanUpdated,
  generatePlanImage,
  remeasureFlowNodes,
});

async function layoutGraph(relayoutAll = false) {
  if (relayoutAll) {
    const keep: AsoNodePositions = {};
    for (const id of [ASO_NODE_IDS.input, ASO_NODE_IDS.materials]) {
      if (nodePositions.value[id]) keep[id] = nodePositions.value[id];
    }
    nodePositions.value = { ...DEFAULT_ASO_NODE_POSITIONS, ...keep };
  }

  await nextTick();
  const nodeIds = getNodes.value.map((n) => n.id);
  updateNodeInternals(nodeIds);
  await nextTick();

  let retries = 20;
  while (retries-- > 0) {
    const ready = nodeIds.every((id) => {
      const node = findNode(id);
      return node?.dimensions?.width && node.dimensions.width > 0;
    });
    if (ready) break;
    await new Promise((r) => setTimeout(r, 80));
  }

  const oldData = toObject();
  const dims = new Map<string, { w: number; h: number }>();
  for (const n of oldData.nodes) {
    const vNode = findNode(n.id);
    dims.set(n.id, { w: vNode?.dimensions?.width ?? 340, h: vNode?.dimensions?.height ?? 200 });
  }

  const gap = 60;
  const planOutGap = 80;
  const planStartX = 420;

  const inputNode = oldData.nodes.find((n) => n.id === ASO_NODE_IDS.input);
  const matNode = oldData.nodes.find((n) => n.id === ASO_NODE_IDS.materials);
  if (inputNode) {
    const inputPos = nodePositions.value[ASO_NODE_IDS.input] ?? { x: 0, y: 0 };
    inputNode.position.x = inputPos.x;
    inputNode.position.y = inputPos.y;
    const inputDim = dims.get(ASO_NODE_IDS.input) ?? { w: 340, h: 200 };
    if (matNode) {
      const matPos = nodePositions.value[ASO_NODE_IDS.materials];
      if (matPos) {
        matNode.position.x = matPos.x;
        matNode.position.y = matPos.y;
      } else {
        matNode.position.x = 0;
        matNode.position.y = inputDim.h + gap;
      }
    }
  }

  let planY = 0;
  for (const plan of plans.value) {
    const pid = planNodeId(plan.id);
    const planNode = oldData.nodes.find((n) => n.id === pid);
    const planDim = dims.get(pid) ?? { w: 340, h: 220 };
    if (!planNode) continue;

    const savedPlan = !relayoutAll ? nodePositions.value[pid] : undefined;
    if (savedPlan) {
      planNode.position.x = savedPlan.x;
      planNode.position.y = savedPlan.y;
    } else {
      planNode.position.x = planStartX;
      planNode.position.y = planY;
    }

    const planOutputs = outputs.value.filter((o) => o.planId === plan.id);
    const planYBase = planNode.position.y;
    let outY = planYBase;
    const outX = planNode.position.x + planDim.w + planOutGap;
    for (const out of planOutputs) {
      const oid = outputNodeId(out.imageId);
      const outNode = oldData.nodes.find((n) => n.id === oid);
      const outDim = dims.get(oid) ?? { w: 280, h: 260 };
      if (!outNode) continue;
      const savedOut = !relayoutAll ? nodePositions.value[oid] : undefined;
      if (savedOut) {
        outNode.position.x = savedOut.x;
        outNode.position.y = savedOut.y;
      } else {
        outNode.position.x = outX;
        outNode.position.y = outY;
        outY += outDim.h + 40;
      }
    }

    if (!savedPlan) {
      const blockHeight = Math.max(planDim.h, outY - planYBase);
      planY = planYBase + blockHeight + gap;
    }
  }

  await fromObject(oldData);
  await nextTick();
  for (const node of getNodes.value) {
    nodePositions.value[node.id] = { x: node.position.x, y: node.position.y };
  }
  scheduleSavePositions();
  await fitView({ padding: 0.2, duration: 200 });
}

onMounted(async () => {
  const hadSaved = await loadWorkspace();
  await nextTick();
  scheduleOutputPoll();
  if (hadSaved) {
    if (needsPerItemLayout()) await layoutGraph(false);
    await remeasureFlowNodes();
    await fitView({ padding: 0.2, duration: 200 });
  } else {
    await layoutGraph(true);
  }
});

onUnmounted(() => {
  if (savePosTimer) clearTimeout(savePosTimer);
  stopOutputPoll();
  if (remeasureTimer) clearTimeout(remeasureTimer);
});
</script>

<style scoped lang="scss">
.asoFlowWorkbench {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  background: var(--td-bg-color-page);
}

.flowPane {
  flex: 1;
  min-width: 0;
  position: relative;
}

.inspectorPane {
  width: 380px;
  flex-shrink: 0;
  border-left: 1px solid var(--td-border-level-1-color);
  background: var(--td-bg-color-container);
}

.flowMain {
  height: 100%;

  :deep(.vue-flow__node) {
    overflow: visible;
  }

  &.space-dragging {
    cursor: grab !important;
    :deep(*) {
      cursor: grab !important;
    }
  }
}

.flowToolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--td-border-level-1-color);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
}

.flowHint {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  white-space: nowrap;
}

.openInspectorBtn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  background: var(--td-bg-color-container);
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 10px;
  z-index: 10;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  &:hover {
    background: var(--td-bg-color-container-hover);
  }
}

.inspector-slide-enter-active,
.inspector-slide-leave-active {
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.inspector-slide-enter-from,
.inspector-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

.flowMain.is-interacting {
  :deep(.vue-flow__node) {
    will-change: transform;
    contain: layout style paint;
  }
}

:deep(.source),
:deep(.target) {
  width: 12px;
  height: 12px;
}

@media (max-width: 1100px) {
  .asoFlowWorkbench {
    flex-direction: column;
  }
  .inspectorPane {
    width: 100%;
    max-height: 42vh;
    border-left: none;
    border-top: 1px solid var(--td-border-level-1-color);
  }
  .flowPane {
    min-height: 55vh;
  }
}
</style>
