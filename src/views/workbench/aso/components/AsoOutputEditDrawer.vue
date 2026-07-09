<template>
  <t-drawer
    v-model:visible="visible"
    :header="$t('workbench.aso.outputEditTitle')"
    size="480px"
    attach="body"
    :close-on-overlay-click="!generating"
    :close-btn="!generating"
    destroy-on-close
    @close="onClose">
    <div v-if="output" class="editDrawer">
      <div class="previewBlock">
        <div class="previewLabel">{{ $t("workbench.aso.outputEditCurrent") }}</div>
        <img v-if="previewUrl" :src="previewUrl" class="previewImg" :alt="outputCardTitle(output)" />
      </div>

      <t-form label-align="top">
        <t-form-item :label="$t('workbench.aso.outputEditInstruction')">
          <t-textarea
            v-model="instruction"
            :placeholder="$t('workbench.aso.outputEditInstructionPh')"
            :autosize="{ minRows: 4, maxRows: 10 }"
            :disabled="generating" />
        </t-form-item>
        <t-form-item :label="$t('workbench.aso.outputEditModel')">
          <modelSelect v-model="model" type="image" :disabled="generating" />
        </t-form-item>
        <t-form-item :label="$t('workbench.aso.outputEditQuality')">
          <t-select v-model="quality" :disabled="generating">
            <t-option value="1K" label="1K" />
            <t-option value="2K" label="2K" />
            <t-option value="4K" label="4K" />
          </t-select>
        </t-form-item>
        <t-form-item :label="$t('workbench.aso.outputEditRatio')">
          <t-select v-model="ratio" :disabled="generating">
            <t-option value="9:16" label="9:16" />
            <t-option value="16:9" label="16:9" />
            <t-option value="1:1" label="1:1" />
          </t-select>
        </t-form-item>
        <t-form-item v-if="referencedAssetIds.length">
          <t-checkbox v-model="includeRefs" :disabled="generating">
            {{ $t("workbench.aso.outputEditIncludeRefs", { count: referencedAssetIds.length }) }}
          </t-checkbox>
        </t-form-item>
      </t-form>

      <div v-if="previewResultUrl" class="previewBlock result">
        <div class="previewLabel">{{ $t("workbench.aso.outputEditPreview") }}</div>
        <img :src="previewResultUrl" class="previewImg" alt="preview" />
      </div>
    </div>

    <template #footer>
      <div class="footerActions f ac je">
        <t-button variant="outline" :disabled="generating" @click="visible = false">
          {{ $t("common.cancel") }}
        </t-button>
        <t-button theme="primary" variant="outline" :loading="generating" :disabled="!canSubmit" @click="runEdit(false)">
          {{ $t("workbench.aso.outputEditPreviewBtn") }}
        </t-button>
        <t-button theme="primary" :loading="generating" :disabled="!canSubmit" @click="runEdit(true)">
          {{ $t("workbench.aso.outputEditApplyBtn") }}
        </t-button>
      </div>
    </template>
  </t-drawer>
</template>

<script setup lang="ts">
import modelSelect from "@/components/modelSelect.vue";
import projectStore from "@/stores/project";
import * as asoApi from "@/api/aso";
import * as uiuxApi from "@/api/uiux";
import { outputCardTitle, outputOriginalUrl } from "../utils/outputPreview";

const props = defineProps<{
  output: any | null;
  referencedAssetIds: number[];
}>();

const visible = defineModel<boolean>("visible", { default: false });

const emit = defineEmits<{
  applied: [payload: { imageId: number; sourceImageId?: number; editTag?: string; filePath?: string; originalFilePath?: string }];
}>();

const { project } = storeToRefs(projectStore());
const isUiuxProject = computed(() => project.value?.projectType === "uiux");
const api = computed(() => (isUiuxProject.value ? uiuxApi : asoApi));

const instruction = ref("");
const model = ref("");
const quality = ref<"1K" | "2K" | "4K">("2K");
const ratio = ref("9:16");
const includeRefs = ref(true);
const generating = ref(false);
const previewResultUrl = ref("");

const previewUrl = computed(() => {
  if (!props.output) return "";
  return outputOriginalUrl(props.output) || props.output.filePath || "";
});

const canSubmit = computed(() => Boolean(instruction.value.trim() && model.value && props.output?.imageId));

function inferQuality(width?: number, height?: number): "1K" | "2K" | "4K" {
  const maxEdge = Math.max(width ?? 0, height ?? 0);
  if (maxEdge <= 1080) return "1K";
  if (maxEdge <= 2048) return "2K";
  return "4K";
}

function inferRatio(width?: number, height?: number): string {
  if (!width || !height) return "9:16";
  const g = (a: number, b: number): number => (b === 0 ? a : g(b, a % b));
  const d = g(width, height);
  return `${width / d}:${height / d}`;
}

function resetForm() {
  instruction.value = "";
  previewResultUrl.value = "";
  includeRefs.value = true;
  if (props.output) {
    quality.value = inferQuality(props.output.width, props.output.height);
    ratio.value = inferRatio(props.output.width, props.output.height);
  }
}

watch(
  () => [visible.value, props.output?.imageId] as const,
  ([open]) => {
    if (!open) return;
    resetForm();
    if (project.value?.imageModel) model.value = project.value.imageModel;
    if (project.value?.imageQuality) quality.value = project.value.imageQuality as "1K" | "2K" | "4K";
  },
);

function onClose() {
  if (generating.value) return;
  previewResultUrl.value = "";
}

async function pollEditOutput(projectId: number, imageId: number) {
  const deadline = Date.now() + 5 * 60 * 1000;
  while (Date.now() < deadline) {
    const { data } = await api.value.pollingOutputs(projectId, [imageId]);
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }
    if (row.state === "已完成") return row;
    if (row.state === "生成失败") throw new Error(row.errorReason || $t("workbench.aso.outputEditFailed"));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error($t("workbench.aso.outputEditFailed"));
}

async function runEdit(apply: boolean) {
  if (!project.value?.id || !props.output?.imageId || !canSubmit.value) return;
  generating.value = true;
  const projectId = Number(project.value.id);
  try {
    const { data } = await api.value.editAsoOutput({
      projectId,
      imageId: props.output.imageId,
      prompt: instruction.value.trim(),
      model: model.value,
      quality: quality.value,
      aspectRatio: ratio.value,
      assetIds: includeRefs.value ? props.referencedAssetIds : [],
      apply,
    });

    if (data.state === "生成中") {
      if (apply) {
        emit("applied", {
          imageId: data.imageId,
          sourceImageId: data.sourceImageId ?? props.output.imageId,
          editTag: data.editTag,
        });
        window.$message.success($t("workbench.aso.generating"));
        visible.value = false;
        return;
      }
      const row = await pollEditOutput(projectId, data.imageId);
      previewResultUrl.value = row.originalFilePath || row.filePath || "";
      window.$message.success($t("workbench.aso.outputEditPreviewDone"));
      return;
    }

    previewResultUrl.value = data.originalFilePath || data.filePath || "";
    if (apply) {
      emit("applied", {
        imageId: data.imageId,
        sourceImageId: data.sourceImageId ?? props.output.imageId,
        editTag: data.editTag,
        filePath: data.filePath,
        originalFilePath: data.originalFilePath,
      });
      window.$message.success($t("workbench.aso.outputEditApplied"));
      visible.value = false;
    } else {
      window.$message.success($t("workbench.aso.outputEditPreviewDone"));
    }
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.aso.outputEditFailed"));
  } finally {
    generating.value = false;
  }
}
</script>

<style scoped lang="scss">
.editDrawer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.previewBlock {
  border-radius: 12px;
  overflow: hidden;
  background: #0f172a;
  border: 1px solid rgba(148, 163, 184, 0.25);
}
.previewBlock.result {
  border-color: var(--td-brand-color-light);
}
.previewLabel {
  padding: 8px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(15, 23, 42, 0.85);
}
.previewImg {
  display: block;
  width: 100%;
  max-height: 320px;
  object-fit: contain;
  background: #0f172a;
}
.footerActions {
  gap: 8px;
  width: 100%;
}
</style>
