import type { Ref } from "vue";
import { computed } from "vue";

export const ASO_NODE_IDS = {
  input: "asoInput",
  materials: "asoMaterials",
  plans: "asoPlans",
  output: "asoOutput",
} as const;

export type AsoNodeId = (typeof ASO_NODE_IDS)[keyof typeof ASO_NODE_IDS];
export type AsoNodePositions = Record<string, { x: number; y: number }>;

export const DEFAULT_ASO_NODE_POSITIONS: AsoNodePositions = {
  asoInput: { x: 0, y: 0 },
  asoMaterials: { x: 420, y: 0 },
  asoPlans: { x: 840, y: 0 },
  asoOutput: { x: 1260, y: 0 },
};

const edgeStyle = {
  stroke: "#334155",
  strokeWidth: 3,
};

export function useAsoFlowBuilder(nodePositions: Ref<AsoNodePositions>) {
  const nodes = computed(() => {
    const positions = nodePositions.value;
    const ids = ASO_NODE_IDS;

    return [
      {
        id: ids.input,
        type: "asoInput",
        dragHandle: ".dragHandle",
        position: positions[ids.input] ?? DEFAULT_ASO_NODE_POSITIONS[ids.input],
        data: {
          handleIds: { source: `${ids.input}-source` },
        },
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
      {
        id: ids.plans,
        type: "asoPlans",
        dragHandle: ".dragHandle",
        position: positions[ids.plans] ?? DEFAULT_ASO_NODE_POSITIONS[ids.plans],
        data: {
          handleIds: {
            target: `${ids.plans}-target`,
            source: `${ids.plans}-source`,
          },
        },
      },
      {
        id: ids.output,
        type: "asoOutput",
        dragHandle: ".dragHandle",
        position: positions[ids.output] ?? DEFAULT_ASO_NODE_POSITIONS[ids.output],
        data: {
          handleIds: { target: `${ids.output}-target` },
        },
      },
    ];
  });

  const edges = computed(() => {
    const ids = ASO_NODE_IDS;
    return [
      {
        id: `${ids.input}-${ids.materials}`,
        source: ids.input,
        target: ids.materials,
        sourceHandle: `${ids.input}-source`,
        targetHandle: `${ids.materials}-target`,
        animated: false,
        style: edgeStyle,
      },
      {
        id: `${ids.materials}-${ids.plans}`,
        source: ids.materials,
        target: ids.plans,
        sourceHandle: `${ids.materials}-source`,
        targetHandle: `${ids.plans}-target`,
        animated: false,
        style: edgeStyle,
      },
      {
        id: `${ids.plans}-${ids.output}`,
        source: ids.plans,
        target: ids.output,
        sourceHandle: `${ids.plans}-source`,
        targetHandle: `${ids.output}-target`,
        animated: false,
        style: edgeStyle,
      },
    ];
  });

  return { nodes, edges };
}
