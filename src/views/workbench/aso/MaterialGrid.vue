<template>
  <div class="materialGrid">
    <div class="header">
      <span class="hint">{{ $t("workbench.aso.materialsHint") }}</span>
      <div class="actions">
        <t-upload
          theme="custom"
          multiple
          :auto-upload="false"
          accept="image/*"
          :max="MAX_UPLOAD_BATCH"
          :disabled="uploading"
          @change="onUpload">
          <t-button size="small" variant="outline" :loading="uploading">
            {{ $t("workbench.aso.uploadImage") }}
          </t-button>
        </t-upload>
        <span class="uploadLimitHint">
          {{ $t("workbench.aso.uploadImageMultiHint", { max: MAX_UPLOAD_BATCH }) }}
        </span>
        <t-button size="small" variant="outline" @click="openTextDialog">{{ $t("workbench.aso.addTextMaterial") }}</t-button>
      </div>
    </div>
    <t-empty v-if="!materials.length" :description="$t('workbench.aso.emptyMaterials')" />
    <div v-else class="grid">
      <div v-for="item in materials" :key="item.id" class="item">
        <div class="itemBody">
          <t-checkbox
            class="itemCheck"
            :checked="referencedAssetIds.includes(item.id)"
            @change="(v: boolean) => toggleRef(item.id, v)" />
          <div class="itemPreview">
            <div v-if="isImageMaterial(item) && item.state === '生成中'" class="pending f ac jc">
              <t-loading size="small" />
            </div>
            <button
              v-else-if="isImageMaterial(item) && item.filePath"
              type="button"
              class="thumbBtn"
              :title="$t('workbench.aso.materialClickPreview')"
              @click="openMaterialPreview(item)">
              <img :src="item.filePath" class="thumb" :alt="item.name" />
              <span class="thumbOverlay">{{ $t("workbench.aso.materialClickPreview") }}</span>
            </button>
            <div v-else-if="isImageMaterial(item)" class="pending f ac jc failed">
              <span>{{ item.state || $t("workbench.aso.generateFailed") }}</span>
            </div>
            <div v-else class="textCard">
              <div class="slotBadge" v-if="item.promptSlot != null">[{{ item.promptSlot }}]</div>
              <div class="name">{{ item.name }}</div>
              <div class="desc">{{ item.describe }}</div>
            </div>
          </div>
        </div>
        <div class="itemMeta" :title="item.name">{{ displayName(item) }}</div>
        <div class="itemActions f ac jb">
          <t-button
            v-if="isImageMaterial(item) && item.state === '已完成' && item.filePath"
            size="small"
            variant="text"
            theme="primary"
            @click="openVariantDialog(item)">
            {{ $t("workbench.aso.generateVariants") }}
          </t-button>
          <span v-else />
          <t-button size="small" theme="danger" variant="text" @click="remove(item.id)">{{ $t("workbench.aso.delete") }}</t-button>
        </div>
      </div>
    </div>

    <t-dialog
      v-model:visible="showTextDialog"
      :header="textDialogHeader"
      :confirm-btn="{ content: $t('common.confirm') }"
      attach="body"
      @confirm="addText">
      <t-select
        v-model="textForm.promptSlot"
        :label="$t('workbench.aso.textMaterialSlot')"
        :options="textSlotOptions"
        :keys="{ value: 'value', label: 'label' }" />
      <t-textarea
        v-model="textForm.describe"
        :label="$t('workbench.aso.textMaterialContent')"
        :autosize="{ minRows: 4, maxRows: 10 }"
        :placeholder="$t('workbench.aso.textMaterialContent')" />
    </t-dialog>

    <t-dialog
      v-model:visible="showVariantDialog"
      :header="$t('workbench.aso.variantDialogTitle')"
      :confirm-btn="{ loading: variantLoading, content: $t('workbench.aso.generateVariants') }"
      attach="body"
      placement="center"
      width="520px"
      :destroy-on-close="true"
      @confirm="submitVariants">
      <div v-if="variantSource" class="variantForm">
        <div class="variantPreview">
          <button
            type="button"
            class="variantThumbBtn"
            :title="$t('workbench.aso.materialClickPreview')"
            @click="openMaterialPreview(variantSource)">
            <img :src="variantSource.filePath" class="variantThumb" :alt="variantSource.name" />
          </button>
          <div class="variantPreviewMeta">
            <span class="variantPreviewLabel">{{ $t("workbench.aso.variantSource") }}</span>
            <span class="variantPreviewName" :title="variantSource.name">{{ displayName(variantSource) }}</span>
          </div>
        </div>
        <div class="countRow">
          <div class="countLabelWrap">
            <span class="countLabel">{{ $t("workbench.aso.variantCount") }}</span>
            <span class="countHint">{{ $t("workbench.aso.variantCountHint") }}</span>
          </div>
          <t-input-number v-model="variantForm.count" :min="1" :max="10" theme="column" />
        </div>
        <div class="copyField">
          <label class="fieldLabel">{{ $t("workbench.aso.variantCopy") }}</label>
          <t-textarea
            v-model="variantForm.copy"
            :autosize="{ minRows: 4, maxRows: 8 }"
            :placeholder="$t('workbench.aso.variantCopyPlaceholder')" />
        </div>
      </div>
    </t-dialog>

    <t-image-viewer
      v-model:visible="previewVisible"
      :images="previewImages"
      :close-on-overlay="true"
      attach="body" />
  </div>
</template>

<script setup lang="ts">
import * as asoApi from "@/api/aso";
import * as uiuxApi from "@/api/uiux";
import projectStore from "@/stores/project";
import { ASO_WORKBENCH_KEY } from "./asoContext";

const props = defineProps<{ referencedAssetIds: number[] }>();
const emit = defineEmits<{ "update:referencedAssetIds": [ids: number[]]; changed: [] }>();

const ctx = inject(ASO_WORKBENCH_KEY, null);
const { project } = storeToRefs(projectStore());
const isUiuxProject = computed(() => project.value?.projectType === "uiux");
const api = computed(() => (isUiuxProject.value ? uiuxApi : asoApi));
const materials = ref<any[]>([]);
const showTextDialog = ref(false);
const showVariantDialog = ref(false);
const variantLoading = ref(false);
const textForm = ref({ promptSlot: 1, describe: "" });
const variantForm = ref({ sourceAssetId: 0, copy: "", count: 4 });
const variantSource = ref<{ id: number; name: string; filePath: string; originalFilePath?: string } | null>(null);
const previewVisible = ref(false);
const previewImages = ref<string[]>([]);
const LAST_VARIANT_COUNT_KEY = "aso_variant_count";
const MAX_UPLOAD_BATCH = 9;
const uploading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;
let remeasureTimer: ReturnType<typeof setTimeout> | null = null;

function isImageMaterial(item: any) {
  return item?.materialKind === "image";
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

const textSlotCount = computed(() => {
  const fromWorkspace = ctx?.imagePromptCount?.value ?? 0;
  if (fromWorkspace >= 1) return Math.min(fromWorkspace, 20);
  return 8;
});

const textSlotOptions = computed(() => {
  const count = textSlotCount.value;
  const plan = ctx?.plans.value?.find((p) => p.imagePrompts?.length) ?? ctx?.plans.value?.[0];
  return Array.from({ length: count }, (_, i) => {
    const slot = i + 1;
    const label = plan?.imagePrompts?.find((p: { slot: number; label?: string }) => p.slot === slot)?.label?.trim();
    return {
      value: slot,
      label: label
        ? `[${slot}] ${label}`
        : $t("workbench.aso.textMaterialSlotOption", { slot }),
    };
  });
});

const textDialogHeader = computed(() => {
  const slot = textForm.value.promptSlot;
  const opt = textSlotOptions.value.find((o) => o.value === slot);
  return opt ? `${$t("workbench.aso.addTextMaterial")} · ${opt.label}` : $t("workbench.aso.addTextMaterial");
});

function openTextDialog() {
  textForm.value = { promptSlot: 1, describe: "" };
  showTextDialog.value = true;
}

function displayName(item: any) {
  const name = String(item?.name || "");
  if (name.length <= 28) return name;
  return `${name.slice(0, 12)}…${name.slice(-8)}`;
}

function scheduleRemeasure() {
  if (!ctx?.remeasureFlowNodes) return;
  if (remeasureTimer) clearTimeout(remeasureTimer);
  remeasureTimer = setTimeout(() => {
    remeasureTimer = null;
    ctx.remeasureFlowNodes();
  }, 150);
}

async function load() {
  if (!project.value?.id) return;
  const { data } = await api.value.listMaterials(Number(project.value.id));
  materials.value = data;
  schedulePoll();
  scheduleRemeasure();
}

onMounted(load);

watch(
  () => project.value?.id,
  (id, prev) => {
    if (id && id !== prev) load();
  },
);

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
  if (remeasureTimer) clearTimeout(remeasureTimer);
});

function schedulePoll() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    const pending = materials.value.filter((m) => m.state === "生成中" && m.imageId).map((m) => m.imageId);
    if (!pending.length || !project.value?.id) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      return;
    }
    await refreshPending(pending);
  }, 2500);
}

async function refreshPending(imageIds: number[]) {
  if (!project.value?.id) return;
  const { data } = await api.value.pollingOutputs(Number(project.value.id), imageIds);
  if (!data?.length) return;
  for (const item of data) {
    const idx = materials.value.findIndex((m) => m.imageId === item.imageId);
    if (idx >= 0) {
      materials.value[idx] = {
        ...materials.value[idx],
        state: item.state,
        filePath: item.filePath ?? materials.value[idx].filePath,
        materialKind: "image",
      };
    }
  }
  scheduleRemeasure();
  const stillPending = materials.value.some((m) => m.state === "生成中");
  if (!stillPending) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    emit("changed");
  }
}

async function onUpload(fileList: any) {
  const list = Array.isArray(fileList) ? fileList : fileList?.fileList ?? [];
  const files = list.map((item: any) => item?.raw ?? item).filter((f): f is File => f instanceof File);
  if (!files.length || !project.value?.id) return;

  const toUpload = files.slice(0, MAX_UPLOAD_BATCH);
  if (toUpload.length < files.length) {
    window.$message.warning(
      $t("workbench.aso.uploadImageLimitPartial", { max: MAX_UPLOAD_BATCH, count: toUpload.length }),
    );
  }

  uploading.value = true;
  let ok = 0;
  const projectId = Number(project.value.id);
  try {
    for (const file of toUpload) {
      const base64 = await readFileAsDataUrl(file);
      await api.value.uploadMaterial(projectId, base64, file.name);
      ok++;
    }
    await load();
    emit("changed");
    if (ok <= 1) window.$message.success($t("workbench.aso.uploadOk"));
    else window.$message.success($t("workbench.aso.uploadOkMultiple", { count: ok }));
  } catch (e: any) {
    window.$message.error(e?.message || $t("workbench.aso.uploadFailed"));
    if (ok > 0) {
      await load();
      emit("changed");
    }
  } finally {
    uploading.value = false;
  }
}

async function addText() {
  if (!project.value?.id) return false;
  const slot = Number(textForm.value.promptSlot);
  if (!Number.isFinite(slot) || slot < 1) {
    window.$message.warning($t("workbench.aso.textMaterialSlotRequired"));
    return false;
  }
  if (!textForm.value.describe.trim()) {
    window.$message.warning($t("workbench.aso.textMaterialContentRequired"));
    return false;
  }
  await api.value.createTextMaterial(Number(project.value.id), textForm.value.describe.trim(), slot);
  showTextDialog.value = false;
  textForm.value = { promptSlot: 1, describe: "" };
  await load();
  emit("changed");
  return true;
}

function isLikelyFilename(value: string) {
  const v = value.trim();
  if (!v) return false;
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(v) || /^[a-f0-9-]{20,}\.(png|jpe?g|webp)$/i.test(v);
}

function defaultVariantCopy(item: any) {
  const desc = String(item?.describe || "").trim();
  const name = String(item?.name || "").trim();
  if (desc && !isLikelyFilename(desc)) return desc;
  if (name && !isLikelyFilename(name)) return name;
  return "";
}

function materialPreviewUrl(item: { filePath?: string; originalFilePath?: string }) {
  if (item.originalFilePath) return item.originalFilePath;
  const path = item.filePath || "";
  return path.replace(/\?size=\d+$/, "");
}

function openMaterialPreview(item: { filePath?: string; originalFilePath?: string; name?: string }) {
  const url = materialPreviewUrl(item);
  if (!url) return;
  previewImages.value = [url];
  previewVisible.value = true;
}

function defaultVariantCount() {
  const fromWorkspace = ctx?.imagePromptCount?.value ?? 0;
  if (fromWorkspace >= 1 && fromWorkspace <= 10) return fromWorkspace;
  const saved = Number(localStorage.getItem(LAST_VARIANT_COUNT_KEY));
  if (Number.isFinite(saved) && saved >= 1 && saved <= 10) return saved;
  return 5;
}

function openVariantDialog(item: any) {
  variantSource.value = {
    id: item.id,
    name: item.name || "",
    filePath: item.filePath || "",
    originalFilePath: item.originalFilePath,
  };
  variantForm.value = {
    sourceAssetId: item.id,
    copy: defaultVariantCopy(item),
    count: defaultVariantCount(),
  };
  showVariantDialog.value = true;
}

async function submitVariants() {
  if (!project.value?.id || !variantForm.value.copy.trim()) {
    window.$message.warning($t("workbench.aso.variantCopyRequired"));
    return false;
  }
  const count = Number(variantForm.value.count);
  if (!Number.isFinite(count) || count < 1 || count > 10) {
    window.$message.warning($t("workbench.aso.variantCountInvalid"));
    return false;
  }
  variantLoading.value = true;
  try {
    await api.value.generateRefVariants(
      Number(project.value.id),
      variantForm.value.sourceAssetId,
      variantForm.value.copy.trim(),
      count,
    );
    localStorage.setItem(LAST_VARIANT_COUNT_KEY, String(count));
    showVariantDialog.value = false;
    window.$message.success($t("workbench.aso.variantsStartedCount", { count }));
    await load();
    emit("changed");
    return true;
  } catch (e: any) {
    window.$message.error(
      e?.code === 409 ? $t("workbench.aso.variantDuplicateGenerating") : e?.message || $t("workbench.aso.generateFailed"),
    );
    return false;
  } finally {
    variantLoading.value = false;
  }
}

async function toggleRef(id: number, checked: boolean) {
  let ids = [...props.referencedAssetIds];
  if (checked && !ids.includes(id)) ids.push(id);
  if (!checked) ids = ids.filter((x) => x !== id);
  emit("update:referencedAssetIds", ids);
  if (project.value?.id) await api.value.saveWorkspace(Number(project.value.id), { referencedAssetIds: ids });
}

async function remove(assetId: number) {
  if (!project.value?.id) return;
  await api.value.deleteMaterial(Number(project.value.id), assetId);
  const ids = props.referencedAssetIds.filter((x) => x !== assetId);
  emit("update:referencedAssetIds", ids);
  await api.value.saveWorkspace(Number(project.value.id), { referencedAssetIds: ids });
  await load();
  emit("changed");
}

defineExpose({ reload: load });
</script>

<style scoped lang="scss">
.materialGrid {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.hint {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.5;
  white-space: normal;
  word-break: break-word;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.uploadLimitHint {
  font-size: 11px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
  max-width: 220px;
}
.uploadLimitHint.warn {
  color: var(--td-warning-color);
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.item {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 8px;
  min-width: 0;
}
.itemBody {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
.itemCheck {
  flex: 0 0 auto;
  margin-top: 4px;
}
.itemPreview {
  flex: 1 1 auto;
  min-width: 0;
}
.itemMeta {
  margin-top: 6px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.itemActions {
  margin-top: 4px;
}
.pending {
  width: 100%;
  aspect-ratio: 1;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 4px;
  font-size: 12px;
  color: var(--td-text-color-secondary);
  text-align: center;
  padding: 8px;
}
.pending.failed {
  color: var(--td-error-color);
}
.thumbBtn {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  position: relative;
  border-radius: 4px;
  overflow: hidden;
}
.thumbBtn:hover .thumbOverlay {
  opacity: 1;
}
.thumbOverlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  font-size: 12px;
  color: #fff;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}
.variantThumbBtn {
  flex: 0 0 72px;
  width: 72px;
  height: 72px;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  border-radius: 6px;
  overflow: hidden;
}
.textCard {
  min-height: 96px;
  .slotBadge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 22px;
    padding: 0 6px;
    margin-bottom: 6px;
    border-radius: 4px;
    background: var(--td-brand-color-light);
    color: var(--td-brand-color);
    font-size: 11px;
    font-weight: 700;
  }
  .name {
    font-weight: 600;
    word-break: break-word;
  }
  .desc {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    word-break: break-word;
  }
}
.variantForm {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0 8px;
}
.variantPreview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
  border: 1px solid var(--td-border-level-1-color);
}
.variantThumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.variantPreviewMeta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.variantPreviewLabel {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
.variantPreviewName {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.countRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--td-bg-color-secondarycontainer);
}
.countLabelWrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.countLabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
.countHint {
  font-size: 12px;
  color: var(--td-text-color-secondary);
  line-height: 1.4;
}
.copyField {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fieldLabel {
  font-size: 14px;
  font-weight: 600;
  color: var(--td-text-color-primary);
}
</style>
