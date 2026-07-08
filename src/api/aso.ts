import axios from "@/utils/axios";
import settingStore from "@/stores/setting";
import { storeToRefs } from "pinia";

export function getWorkspace(projectId: number) {
  return axios.post("/aso/getWorkspace", { projectId });
}

export function saveWorkspace(projectId: number, patch: Record<string, unknown>) {
  return axios.post("/aso/saveWorkspace", { projectId, patch });
}

export function getSizePresets() {
  return axios.get("/aso/getSizePresets");
}

export function generatePlans(projectId: number, inputText: string, planCount: number, assetIds: number[] = []) {
  return axios.post("/aso/generatePlans", { projectId, inputText, planCount, assetIds });
}

export function updatePlan(projectId: number, planId: string, data: { title?: string; copy?: string }) {
  return axios.post("/aso/updatePlan", { projectId, planId, ...data });
}

export function uploadMaterial(projectId: number, base64: string, name?: string, describe?: string) {
  return axios.post("/aso/uploadMaterial", { projectId, base64, name, describe });
}

export function createTextMaterial(projectId: number, name: string, describe: string) {
  return axios.post("/aso/createTextMaterial", { projectId, name, describe });
}

export function listMaterials(projectId: number, type: "aso_material" | "aso_output" = "aso_material") {
  return axios.post("/aso/listMaterials", { projectId, type });
}

export function deleteMaterial(projectId: number, assetId: number) {
  return axios.post("/aso/deleteMaterial", { projectId, assetId });
}

export function generateAsoImage(projectId: number, planId: string, presetId?: string, assetIds?: number[]) {
  return axios.post("/aso/generateAsoImage", { projectId, planId, presetId, assetIds });
}

export function pollingOutputs(projectId: number, imageIds: number[]) {
  return axios.post("/aso/pollingOutputs", { projectId, imageIds });
}

export function generateRefVariants(projectId: number, sourceAssetId: number, copy: string, count: number) {
  return axios.post("/aso/generateRefVariants", { projectId, sourceAssetId, copy, count });
}

export async function generatePlansStream(
  projectId: number,
  inputText: string,
  planCount: number,
  assetIds: number[] = [],
  onEvent?: (event: string, data: any) => void,
): Promise<{ plans: any[]; workspace: any; visionFallback?: boolean }> {
  const { baseUrl } = storeToRefs(settingStore());
  const token = localStorage.getItem("token");
  const res = await fetch(`${baseUrl.value}/aso/generatePlans/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    body: JSON.stringify({ projectId, inputText, planCount, assetIds }),
  });

  if (!res.ok || !res.body) {
    throw new Error("流式连接失败");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: { plans: any[]; workspace: any; visionFallback?: boolean } = { plans: [], workspace: null };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      const lines = part.split("\n");
      let event = "message";
      let dataStr = "";
      for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        if (line.startsWith("data:")) dataStr += line.slice(5).trim();
      }
      if (!dataStr) continue;
      const data = JSON.parse(dataStr);
      onEvent?.(event, data);
      if (event === "all_done") {
        result = {
          plans: data.plans,
          workspace: data.workspace,
          visionFallback: data.visionFallback ?? false,
        };
      }
      if (event === "error") throw new Error(data.message || "生成失败");
    }
  }

  return result;
}
