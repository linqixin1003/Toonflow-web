import type { Ref } from "vue";
import { computed } from "vue";

export const ASO_NODE_IDS = {
  input: "asoInput",
  materials: "asoMaterials",
} as const;

export type AsoNodePositions = Record<string, { x: number; y: number }>;

export const DEFAULT_ASO_NODE_POSITIONS: AsoNodePositions = {
  asoInput: { x: 0, y: 0 },
  asoMaterials: { x: 0, y: 320 },
};

export function planNodeId(planId: string) {
  return `asoPlan-${planId}`;
}

export function planOutputsNodeId(planId: string) {
  return `asoPlanOutputs-${planId}`;
}

export function outputNodeId(imageId: number) {
  return `asoOutput-${imageId}`;
}

export const DEFAULT_PLAN_OUTPUTS_NODE_DIM = { w: 400, h: 420 } as const;

export const DEFAULT_OUTPUT_DIM = { w: 280, h: 320 } as const;

export type AsoNodeDim = { w: number; h: number };

export type LayoutPlanOutputOptions = {
  planOutGap?: number;
  tileGapX?: number;
  tileGapY?: number;
  maxPerRow?: number;
};

/** Position the grouped outputs node to the right of a plan card. */
export function layoutPlanOutputsNodePosition(
  planPos: { x: number; y: number },
  planDim: AsoNodeDim,
  planOutGap = 80,
): { x: number; y: number } {
  return {
    x: planPos.x + planDim.w + planOutGap,
    y: planPos.y,
  };
}

export function estimatePlanOutputsNodeHeight(outputCount: number, cardColumnWidth = 188): number {
  const cardImageH = cardColumnWidth;
  const cardMetaH = 56;
  const cardH = cardImageH + cardMetaH + 12;
  const rows = Math.max(1, Math.ceil(outputCount / 2));
  return 52 + rows * cardH + (rows - 1) * 14;
}
const edgeStyle = {
  stroke: "#334155",
  strokeWidth: 3,
};

/** Match output to a plan; falls back to index suffix when plan was regenerated. */
export function resolveOutputPlanId(output: { planId?: string }, plans: { id: string }[]): string | null {
  if (!output.planId || !plans.length) return null;
  if (plans.some((p) => p.id === output.planId)) return output.planId;

  const suffix = output.planId.match(/_(\d+)$/)?.[1];
  if (suffix !== undefined) {
    const bySuffix = plans.find((p) => p.id.endsWith(`_${suffix}`));
    if (bySuffix) return bySuffix.id;
    const idx = Number(suffix);
    if (!Number.isNaN(idx)) {
      if (plans[idx]?.id) return plans[idx].id;
      if (idx > 0 && plans[idx - 1]?.id) return plans[idx - 1].id;
    }
  }
  return null;
}

export function useAsoFlowBuilder(
  nodePositions: Ref<AsoNodePositions>,
  plans: Ref<any[]>,
  outputs: Ref<any[]>,
) {
  const nodes = computed(() => {
    const positions = nodePositions.value;
    const ids = ASO_NODE_IDS;
    const list: any[] = [
      {
        id: ids.input,
        type: "asoInput",
        dragHandle: ".dragHandle",
        position: positions[ids.input] ?? DEFAULT_ASO_NODE_POSITIONS[ids.input],
        data: { handleIds: { source: `${ids.input}-source` } },
      },
      {
        id: ids.materials,
        type: "asoMaterials",
        dragHandle: ".dragHandle",
        position: positions[ids.materials] ?? DEFAULT_ASO_NODE_POSITIONS[ids.materials],
        data: {
          handleIds: {
            target: `${ids.materials}-target`,
            source: `${ids.materials}-source`,
          },
        },
      },
    ];

    for (const plan of plans.value.filter((p) => p?.id)) {
      const id = planNodeId(plan.id);
      list.push({
        id,
        type: "asoPlanItem",
        dragHandle: ".dragHandle",
        position: positions[id] ?? { x: 420, y: 0 },
        data: {
          plan,
          handleIds: {
            target: `${id}-target`,
            source: `${id}-source`,
          },
        },
      });

      const outNodeId = planOutputsNodeId(plan.id);
      list.push({
        id: outNodeId,
        type: "asoPlanOutputs",
        dragHandle: ".dragHandle",
        position: positions[outNodeId] ?? { x: 900, y: 0 },
        data: {
          planId: plan.id,
          handleIds: { target: `${outNodeId}-target` },
        },
      });
    }

    return list;
  });

  const edges = computed(() => {
    const ids = ASO_NODE_IDS;
    const list: any[] = [
      {
        id: `${ids.input}-${ids.materials}`,
        source: ids.input,
        target: ids.materials,
        sourceHandle: `${ids.input}-source`,
        targetHandle: `${ids.materials}-target`,
        animated: false,
        style: edgeStyle,
      },
    ];

    for (const plan of plans.value.filter((p) => p?.id)) {
      const pid = planNodeId(plan.id);
      list.push({
        id: `${ids.materials}-${pid}`,
        source: ids.materials,
        target: pid,
        sourceHandle: `${ids.materials}-source`,
        targetHandle: `${pid}-target`,
        animated: false,
        style: edgeStyle,
      });

      const outGid = planOutputsNodeId(plan.id);
      list.push({
        id: `${pid}-${outGid}`,
        source: pid,
        target: outGid,
        sourceHandle: `${pid}-source`,
        targetHandle: `${outGid}-target`,
        animated: false,
        style: { ...edgeStyle, stroke: "#2563eb" },
      });
    }

    return list;
  });

  return { nodes, edges };
}
