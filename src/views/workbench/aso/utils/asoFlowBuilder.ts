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

export function outputNodeId(imageId: number) {
  return `asoOutput-${imageId}`;
}

const edgeStyle = {
  stroke: "#334155",
  strokeWidth: 3,
};

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

    for (const plan of plans.value) {
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
    }

    for (const out of outputs.value) {
      const id = outputNodeId(out.imageId);
      list.push({
        id,
        type: "asoOutputItem",
        dragHandle: ".dragHandle",
        position: positions[id] ?? { x: 800, y: 0 },
        data: {
          output: out,
          handleIds: { target: `${id}-target` },
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

    for (const plan of plans.value) {
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
    }

    for (const out of outputs.value) {
      if (!out.planId) continue;
      const pid = planNodeId(out.planId);
      const oid = outputNodeId(out.imageId);
      if (!plans.value.some((p) => p.id === out.planId)) continue;
      list.push({
        id: `${pid}-${oid}`,
        source: pid,
        target: oid,
        sourceHandle: `${pid}-source`,
        targetHandle: `${oid}-target`,
        animated: false,
        style: { ...edgeStyle, stroke: "#2563eb" },
      });
    }

    return list;
  });

  return { nodes, edges };
}
