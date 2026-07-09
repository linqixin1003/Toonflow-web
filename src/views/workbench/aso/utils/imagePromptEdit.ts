import { updatePlan } from "@/api/aso";

export type ImagePromptItem = { slot: number; label?: string; prompt: string };

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
  await updatePlan(projectId, planId, {
    title: planTitle,
    copy: planCopy,
    imagePrompts: nextPrompts,
  });
  return nextPrompts;
}
