import { generatePlans, generatePlansStream } from "@/api/aso";

const STREAM_FALLBACK_ERRORS = /流式连接失败|Failed to fetch|Network Error|network error/i;

export function useAsoPlanStream() {
  const streaming = ref(false);
  const streamText = ref("");
  const errorMessage = ref("");
  let activeAbort: AbortController | null = null;

  function abort() {
    activeAbort?.abort();
    activeAbort = null;
    streaming.value = false;
  }

  async function run(options: {
    projectId: number;
    inputText: string;
    planCount: number;
    imagePromptCount?: number;
    appendPlans?: boolean;
    assetIds?: number[];
    onDelta?: (delta: string) => void;
    onEvent?: (event: string, data: any) => void;
  }) {
    abort();
    const controller = new AbortController();
    activeAbort = controller;
    streaming.value = true;
    streamText.value = "";
    errorMessage.value = "";

    try {
      return await generatePlansStream(
        options.projectId,
        options.inputText,
        options.planCount,
        options.assetIds ?? [],
        (event, data) => {
          if (controller.signal.aborted) return;
          if (event === "plan_start" && data.batched) {
            streamText.value = "";
          }
          if (event === "plan_delta" && data.delta) {
            streamText.value += data.delta;
            options.onDelta?.(data.delta);
          }
          options.onEvent?.(event, data);
        },
        options.imagePromptCount,
        options.appendPlans,
        controller.signal,
      );
    } catch (e: unknown) {
      if (controller.signal.aborted) {
        throw e;
      }
      const code = (e as { code?: number })?.code;
      const msg = e instanceof Error ? e.message : String(e);
      if (code === 409 || !STREAM_FALLBACK_ERRORS.test(msg)) {
        errorMessage.value = msg;
        throw e;
      }
      const { data } = await generatePlans(
        options.projectId,
        options.inputText,
        options.planCount,
        options.assetIds ?? [],
        options.imagePromptCount,
        options.appendPlans,
      );
      return {
        plans: data.plans,
        workspace: data.workspace,
        visionFallback: data.visionFallback ?? false,
      };
    } finally {
      // Only clear state if this run is still the active one; otherwise a
      // stale request would wipe out the loading state of a newer run.
      if (activeAbort === controller) {
        activeAbort = null;
        streaming.value = false;
      }
    }
  }

  return { streaming, streamText, errorMessage, run, abort };
}
