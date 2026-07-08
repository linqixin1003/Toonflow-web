import type { InjectionKey, Ref } from "vue";

export interface AsoWorkbenchContext {
  referencedAssetIds: Ref<number[]>;
  plans: Ref<any[]>;
  outputs: Ref<any[]>;
  selectedPlanId: Ref<string | null>;
  selectedOutputId: Ref<number | null>;
  outputSizePreset: Ref<string>;
  generatingPlanId: Ref<string | null>;
  loadWorkspace: () => Promise<boolean>;
  onPlansGenerated: (payload: { plans: any[]; workspace?: any }) => Promise<void>;
  onSelectPlan: (planId: string) => void;
  onPlanUpdated: (payload: { id: string; title: string; copy: string; edited?: boolean }) => void;
  generatePlanImage: (planId: string) => Promise<void>;
  remeasureFlowNodes: () => Promise<void>;
}

export const ASO_WORKBENCH_KEY: InjectionKey<AsoWorkbenchContext> = Symbol("asoWorkbench");
