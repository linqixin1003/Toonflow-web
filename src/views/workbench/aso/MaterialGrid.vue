<template>
  <div class="materialGrid">
    <div class="header f ac jb">
      <span class="hint">{{ $t("workbench.aso.materialsHint") }}</span>
      <div class="f ac" style="gap: 8px">
        <t-upload :auto-upload="false" accept="image/*" :max="1" @change="onUpload">
          <t-button size="small" variant="outline">{{ $t("workbench.aso.uploadImage") }}</t-button>
        </t-upload>
        <t-button size="small" variant="outline" @click="showTextDialog = true">{{ $t("workbench.aso.addTextMaterial") }}</t-button>
      </div>
    </div>
    <t-empty v-if="!materials.length" :description="$t('workbench.aso.emptyMaterials')" />
    <div v-else class="grid">
      <div v-for="item in materials" :key="item.id" class="item">
        <t-checkbox :checked="referencedAssetIds.includes(item.id)" @change="(v: boolean) => toggleRef(item.id, v)">
          <div v-if="item.state === '生成中'" class="pending f ac jc">
            <t-loading size="small" />
          </div>
          <img v-else-if="item.materialKind === 'image' && item.filePath" :src="item.filePath" class="thumb" />
          <div v-else class="textCard">
            <div class="name">{{ item.name }}</div>
            <div class="desc">{{ item.describe }}</div>
          </div>
        </t-checkbox>
        <div class="itemActions f ac jb">
          <t-button
            v-if="item.materialKind === 'image' && item.state === '已完成'"
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

    <t-dialog v-model:visible="showTextDialog" :header="$t('workbench.aso.addTextMaterial')" @confirm="addText">
      <t-input v-model="textForm.name" :label="$t('workbench.aso.materialName')" />
      <t-textarea v-model="textForm.describe" :label="$t('workbench.aso.materialDescribe')" />
    </t-dialog>

    <t-dialog
      v-model:visible="showVariantDialog"
      :header="$t('workbench.aso.variantDialogTitle')"
      :confirm-btn="{ loading: variantLoading, content: $t('workbench.aso.generateVariants') }"
      @confirm="submitVariants">
      <t-textarea v-model="variantForm.copy" :label="$t('workbench.aso.variantCopy')" :autosize="{ minRows: 3, maxRows: 6 }" />
      <t-input-number v-model="variantForm.count" :min="1" :max="10" :label="$t('workbench.aso.variantCount')" />
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import {
  listMaterials,
  uploadMaterial,
  createTextMaterial,
  deleteMaterial,
  saveWorkspace,
  generateRefVariants,
  pollingOutputs,
} from "@/api/aso";
import projectStore from "@/stores/project";

const props = defineProps<{ referencedAssetIds: number[] }>();
const emit = defineEmits<{ "update:referencedAssetIds": [ids: number[]]; changed: [] }>();

const { project } = storeToRefs(projectStore());
const materials = ref<any[]>([]);
const showTextDialog = ref(false);
const showVariantDialog = ref(false);
const variantLoading = ref(false);
const textForm = ref({ name: "", describe: "" });
const variantForm = ref({ sourceAssetId: 0, copy: "", count: 4 });
let pollTimer: ReturnType<typeof setInterval> | null = null;

async function load() {
  if (!project.value?.id) return;
  const { data } = await listMaterials(Number(project.value.id));
  materials.value = data;
  schedulePoll();
}

onMounted(load);

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
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
  const { data } = await pollingOutputs(Number(project.value.id), imageIds);
  if (!data?.length) return;
  for (const item of data) {
    const idx = materials.value.findIndex((m) => m.imageId === item.imageId);
    if (idx >= 0) {
      materials.value[idx] = {
        ...materials.value[idx],
        state: item.state,
        filePath: item.filePath ?? materials.value[idx].filePath,
      };
    }
  }
  const stillPending = materials.value.some((m) => m.state === "生成中");
  if (!stillPending) {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    emit("changed");
  }
}

async function onUpload(fileList: any) {
  const list = Array.isArray(fileList) ? fileList : fileList?.fileList ?? [];
  const file = list[0]?.raw || list[0];
  if (!(file instanceof File) || !project.value?.id) return;
  const reader = new FileReader();
  reader.onload = async () => {
    await uploadMaterial(Number(project.value!.id), reader.result as string, file.name);
    await load();
    emit("changed");
    window.$message.success($t("workbench.aso.uploadOk"));
  };
  reader.readAsDataURL(file);
}

async function addText() {
  if (!project.value?.id || !textForm.value.describe.trim()) return;
  await createTextMaterial(Number(project.value.id), textForm.value.name || "文字素材", textForm.value.describe);
  showTextDialog.value = false;
  textForm.value = { name: "", describe: "" };
  await load();
  emit("changed");
}

function openVariantDialog(item: any) {
  variantForm.value = {
    sourceAssetId: item.id,
    copy: item.describe || item.name || "",
    count: 4,
  };
  showVariantDialog.value = true;
}

async function submitVariants() {
  if (!project.value?.id || !variantForm.value.copy.trim()) {
    window.$message.warning($t("workbench.aso.variantCopyRequired"));
    return false;
  }
  variantLoading.value = true;
  try {
    await generateRefVariants(
      Number(project.value.id),
      variantForm.value.sourceAssetId,
      variantForm.value.copy.trim(),
      variantForm.value.count,
    );
    showVariantDialog.value = false;
    window.$message.success($t("workbench.aso.variantsStarted"));
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
  if (project.value?.id) await saveWorkspace(Number(project.value.id), { referencedAssetIds: ids });
}

async function remove(assetId: number) {
  if (!project.value?.id) return;
  await deleteMaterial(Number(project.value.id), assetId);
  const ids = props.referencedAssetIds.filter((x) => x !== assetId);
  emit("update:referencedAssetIds", ids);
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
}
.hint {
  font-size: 12px;
  color: var(--td-text-color-secondary);
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}
.item {
  border: 1px solid var(--td-border-level-1-color);
  border-radius: 8px;
  padding: 8px;
}
.itemActions {
  margin-top: 4px;
}
.pending {
  width: 100%;
  aspect-ratio: 1;
  background: var(--td-bg-color-secondarycontainer);
  border-radius: 4px;
}
.thumb {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
}
.textCard {
  .name {
    font-weight: 600;
  }
  .desc {
    font-size: 12px;
    color: var(--td-text-color-secondary);
    word-break: break-word;
  }
}
</style>
