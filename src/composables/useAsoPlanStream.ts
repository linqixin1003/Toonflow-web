import { generatePlans, generatePlansStream } from "@/api/aso";

const STREAM_FALLBACK_ERRORS = /流式连接失败|Failed to fetch|Network Error|network error/i;

export function useAsoPlanStream() {
  const streaming = ref(false);
  const streamText = ref("");
  const errorMessage = ref("");

  async function run(options: {
    projectId: number;
    inputText: string;
    planCount: number;
    assetIds?: number[];
    onDelta?: (delta: string) => void;
  }) {
    streaming.value = true;
    streamText.value = "";
    errorMessage.value = "";

    try {
      return await generatePlansStream(
        options.projectId,
        options.inputText,
        options.planCount,
        options.assetIds ?? [],
        (_event, data) => {
          if (_event === "plan_delta" && data.delta) {
            streamText.value += data.delta;
            options.onDelta?.(data.delta);
          }
        },
      );
    } catch (e: unknown) {
      const code = (e as { code?: number })?.code;
      const msg = e instanceof Error ? e.message : String(e);
      if (code === 409 || !STREAM_FALLBACK_ERRORS.test(msg)) {
        errorMessage.value = msg;
        throw e;
      }
      const { data } = await generatePlans(options.projectId, options.inputText, options.planCount, options.assetIds ?? []);
      return {
        plans: data.plans,
        workspace: data.workspace,
        visionFallback: data.visionFallback ?? false,
      };
    } finally {
      streaming.value = false;
    }
  }

  return { streaming, streamText, errorMessage, run };
}
