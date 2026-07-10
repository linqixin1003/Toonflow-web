import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import projectStore from "@/stores/project";

/**
 * Creative workbench i18n helper: prefer workbench.uiux.* overrides when
 * projectType is uiux, otherwise fall back to workbench.aso.*.
 */
export function useCreativeI18n() {
  const { project } = storeToRefs(projectStore());
  const { t, te } = useI18n();
  const isUiuxProject = computed(() => project.value?.projectType === "uiux");

  function ct(key: string, params?: Record<string, unknown>) {
    if (isUiuxProject.value) {
      const uiuxKey = `workbench.uiux.${key}`;
      if (te(uiuxKey)) return t(uiuxKey, params as any);
    }
    return t(`workbench.aso.${key}`, params as any);
  }

  return { ct, isUiuxProject };
}
