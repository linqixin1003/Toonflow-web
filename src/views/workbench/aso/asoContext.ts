import type { InjectionKey, Ref } from "vue";

export type LoadWorkspaceOptions = {
  plans?: boolean;
  outputs?: boolean;
  layout?: boolean;
  meta?: boolean;
};

export interface AsoWorkbenchContext {
  referencedAssetIds: Ref<number[]>;
  plans: Ref<any[]>;
  outputs: Ref<any[]>;
  selectedPlanId: Ref<string | null>;
  selectedOutputId: Ref<number | null>;
  outputSizePreset: Ref<string>;
  planCount: Ref<number>;
  generatingPlanId: Ref<string | null>;
  loadWorkspace: (options?: LoadWorkspaceOptions) => Promise<boolean>;
  refreshOutputsFromServer: () => Promise<void>;
  onPlansGenerated: (payload: { plans: any[]; workspace?: any }) => Promise<void>;
  onSelectPlan: (planId: string) => void;
  onPlanUpdated: (payload: { id: string; title: string; copy: string; edited?: boolean }) => void;
  generatePlanImage: (planId: string, presetId?: string) => Promise<void>;
  deleteOutputItem: (imageId: number) => Promise<void>;
  regenerateOutput: (output: any) => Promise<void>;
  remeasureFlowNodes: () => Promise<void>;
}

export const ASO_WORKBENCH_KEY: InjectionKey<AsoWorkbenchContext> = Symbol("asoWorkbench");
