import * as asoApi from "@/api/aso";
import * as uiuxApi from "@/api/uiux";
import projectStore from "@/stores/project";

export type ImagePromptItem = { slot: number; label?: string; prompt: string };

function resolveUpdatePlan() {
  const { project } = projectStore();
  return project?.projectType === "uiux" ? uiuxApi.updatePlan : asoApi.updatePlan;
}

export async function saveImagePromptEdit(params: {
  projectId: number;
  planId: string;
  planTitle: string;
  planCopy: string;
  imagePrompts: ImagePromptItem[];
  slot: number;
  label: string;
  prompt: string;
}) {
  const { projectId, planId, planTitle, planCopy, imagePrompts, slot, label, prompt } = params;
  const nextPrompts = imagePrompts.map((ip) =>
    ip.slot === slot ? { ...ip, label, prompt } : ip,
  );
  await resolveUpdatePlan()(projectId, planId, {
    title: planTitle,
    copy: planCopy,
    imagePrompts: nextPrompts,
  });
  return nextPrompts;
}
