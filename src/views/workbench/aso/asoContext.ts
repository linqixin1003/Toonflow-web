import type { InjectionKey, Ref } from "vue";
import type PlanList from "./PlanList.vue";
import type OutputGallery from "./OutputGallery.vue";

export interface AsoWorkbenchContext {
  referencedAssetIds: Ref<number[]>;
  plans: Ref<any[]>;
  outputs: Ref<any[]>;
  selectedPlanId: Ref<string | null>;
  selectedOutputId: Ref<number | null>;
  outputSizePreset: Ref<string>;
  presetId: Ref<string>;
  planListRef: Ref<InstanceType<typeof PlanList> | null>;
  galleryRef: Ref<InstanceType<typeof OutputGallery> | null>;
  loadWorkspace: () => Promise<void>;
  onPlansGenerated: (payload: { plans: any[]; workspace?: any }) => Promise<void>;
  onImageGenerated: () => void;
  onSelectPlan: (planId: string) => void;
}

export const ASO_WORKBENCH_KEY: InjectionKey<AsoWorkbenchContext> = Symbol("asoWorkbench");
