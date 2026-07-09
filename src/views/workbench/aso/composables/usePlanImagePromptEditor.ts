import projectStore from "@/stores/project";
import { saveImagePromptEdit, type ImagePromptItem } from "../utils/imagePromptEdit";

export function usePlanImagePromptEditor(
  getPlan: () => { id: string; title: string; copy: string; imagePrompts?: ImagePromptItem[] } | null | undefined,
  onUpdated: (payload: {
    id: string;
    title: string;
    copy: string;
    imagePrompts: ImagePromptItem[];
    edited: boolean;
  }) => void,
) {
  const { project } = storeToRefs(projectStore());
  const editVisible = ref(false);
  const editSaving = ref(false);
  const editingSlot = ref(0);
  const editingLabel = ref("");
  const editingPrompt = ref("");
  const editingPlanId = ref<string | null>(null);

  function openImagePromptEdit(ip: ImagePromptItem) {
    const plan = getPlan();
    editingPlanId.value = plan?.id ?? null;
    editingSlot.value = ip.slot;
    editingLabel.value = ip.label?.trim() ?? "";
    editingPrompt.value = ip.prompt ?? "";
    editVisible.value = true;
  }

  async function onImagePromptSave(payload: { slot: number; label: string; prompt: string }) {
    const plan = getPlan();
    if (!plan?.id || !project.value?.id || !plan.imagePrompts?.length) return;
    if (editingPlanId.value && plan.id !== editingPlanId.value) {
      window.$message.warning($t("workbench.aso.editImagePromptPlanChanged"));
      editVisible.value = false;
      return;
    }
    editSaving.value = true;
    try {
      const nextPrompts = await saveImagePromptEdit({
        projectId: Number(project.value.id),
        planId: plan.id,
        planTitle: plan.title,
        planCopy: plan.copy,
        imagePrompts: plan.imagePrompts,
        slot: payload.slot,
        label: payload.label,
        prompt: payload.prompt,
      });
      onUpdated({
        id: plan.id,
        title: plan.title,
        copy: plan.copy,
        imagePrompts: nextPrompts,
        edited: true,
      });
      editVisible.value = false;
      editingPlanId.value = null;
      window.$message.success($t("workbench.aso.editImagePromptSaved"));
    } catch (e: any) {
      window.$message.error(e?.message || $t("workbench.aso.savePlanFailed"));
    } finally {
      editSaving.value = false;
    }
  }

  return {
    editVisible,
    editSaving,
    editingSlot,
    editingLabel,
    editingPrompt,
    openImagePromptEdit,
    onImagePromptSave,
  };
}
