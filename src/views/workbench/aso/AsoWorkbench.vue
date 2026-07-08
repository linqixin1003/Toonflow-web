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
        <template #node-asoPlans="slotProps">
          <AsoPlansNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <template #node-asoOutput="slotProps">
          <AsoOutputNode :id="slotProps.id" :data="slotProps.data" />
        </template>
        <Background />
        <Controls />
        <div class="flowToolbar f ac">
          <t-tooltip :content="$t('workbench.aso.flowAutoLayout')" placement="bottom">
            <t-button variant="outline" @click="layoutGraph()">
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
          :generating="planListRef?.generatingPlanId === selectedPlanId"
          :generate-blocked="!!planListRef?.generatingPlanId && planListRef?.generatingPlanId !== selectedPlanId"
          @update:preset-id="outputSizePreset = $event"
          @generate-image="onGenerateFromInspector"
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
import AsoPlansNode from "./node/AsoPlansNode.vue";
import AsoOutputNode from "./node/AsoOutputNode.vue";
import AsoInspector from "./AsoInspector.vue";
import { ASO_WORKBENCH_KEY } from "./asoContext";
import { ASO_NODE_IDS, DEFAULT_ASO_NODE_POSITIONS, useAsoFlowBuilder, type AsoNodePositions } from "./utils/asoFlowBuilder";
import { getWorkspace, pollingOutputs, saveWorkspace } from "@/api/aso";
import projectStore from "@/stores/project";
import settingStore from "@/stores/setting";
import PlanList from "./PlanList.vue";
import OutputGallery from "./OutputGallery.vue";

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
const planListRef = ref<InstanceType<typeof PlanList> | null>(null);
const galleryRef = ref<InstanceType<typeof OutputGallery> | null>(null);
const inspectorVisible = useLocalStorage("aso_inspector_visible", true);

const nodePositions = ref<AsoNodePositions>({ ...DEFAULT_ASO_NODE_POSITIONS });
const { nodes, edges } = useAsoFlowBuilder(nodePositions);

const isSpacePressed = ref(false);
let dragOrigin = { x: 0, y: 0, vx: 0, vy: 0 };
let savePosTimer: ReturnType<typeof setTimeout> | null = null;

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

function scheduleSavePositions() {
  if (!project.value?.id) return;
  if (savePosTimer) clearTimeout(savePosTimer);
  savePosTimer = setTimeout(async () => {
    try {
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

function onGenerateFromInspector(planId: string) {
  planListRef.value?.generateImage(planId);
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
  if (saved && Object.keys(saved).length > 0) {
    nodePositions.value = { ...DEFAULT_ASO_NODE_POSITIONS, ...saved };
    return true;
  }
  return false;
}

async function onPlansGenerated(payload: { plans: any[]; workspace?: any }) {
  plans.value = payload.plans ?? payload.workspace?.plans ?? [];
  if (payload.workspace) {
    selectedPlanId.value = payload.workspace.selectedPlanId;
    outputs.value = await enrichOutputs(payload.workspace.outputs ?? outputs.value);
  }
  await nextTick();
  updateNodeInternals([ASO_NODE_IDS.plans, ASO_NODE_IDS.input]);
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

provide(ASO_WORKBENCH_KEY, {
  referencedAssetIds,
  plans,
  outputs,
  selectedPlanId,
  selectedOutputId,
  outputSizePreset,
  planListRef,
  galleryRef,
  loadWorkspace,
  onPlansGenerated,
  onImageGenerated,
  onSelectPlan,
  onPlanUpdated,
});

async function layoutGraph() {
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

  const chain = [ASO_NODE_IDS.input, ASO_NODE_IDS.materials, ASO_NODE_IDS.plans, ASO_NODE_IDS.output];
  const gap = 80;
  let curX = 0;
  for (const id of chain) {
    const node = oldData.nodes.find((n) => n.id === id);
    const dim = dims.get(id);
    if (!node || !dim) continue;
    node.position.x = curX;
    node.position.y = 0;
    curX += dim.w + gap;
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
  const hasSavedLayout = await loadWorkspace();
  await nextTick();
  if (hasSavedLayout) {
    await fitView({ padding: 0.2, duration: 200 });
  } else {
    await layoutGraph();
  }
});

onUnmounted(() => {
  if (savePosTimer) clearTimeout(savePosTimer);
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
