import { computed } from "vue";
import { storeToRefs } from "pinia";
import * as asoApi from "@/api/aso";
import * as uiuxApi from "@/api/uiux";
import projectStore from "@/stores/project";

/** Shared ASO / UI-UX API client switcher for the creative workbench. */
export function useCreativeApi() {
  const { project } = storeToRefs(projectStore());
  const isUiuxProject = computed(() => project.value?.projectType === "uiux");
  const api = computed(() => (isUiuxProject.value ? uiuxApi : asoApi));
  return { api, isUiuxProject };
}
