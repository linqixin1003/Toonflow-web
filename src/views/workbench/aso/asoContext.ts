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
  imagePromptCount: Ref<number>;
  generatingPlanId: Ref<string | null>;
  generatingSlots: Ref<Set<string>>;
  loadWorkspace: (options?: LoadWorkspaceOptions) => Promise<boolean>;
  refreshOutputsFromServer: () => Promise<void>;
  onPlansGenerated: (payload: { plans: any[]; workspace?: any }) => Promise<void>;
  onSelectPlan: (planId: string) => void;
  onPlanUpdated: (payload: { id: string; title: string; copy: string; imagePrompts?: any[]; edited?: boolean }) => void;
  generatePlanImage: (
    planId: string,
    presetId?: string,
    options?: { promptSlot?: number; generateAll?: boolean },
  ) => Promise<void>;
  isSlotGenerating: (planId: string, promptSlot?: number) => boolean;
  deleteOutputItem: (imageId: number, options?: { silent?: boolean }) => Promise<void>;
  regenerateOutput: (output: any) => Promise<void>;
  onEditOutput?: (output: any) => void;
  waitForSlotGenerationEnd: (planId: string, promptSlot?: number) => Promise<void>;
  remeasureFlowNodes: () => Promise<void>;
  layoutGraphIncremental?: () => Promise<void>;
}

export const ASO_WORKBENCH_KEY: InjectionKey<AsoWorkbenchContext> = Symbol("asoWorkbench");
