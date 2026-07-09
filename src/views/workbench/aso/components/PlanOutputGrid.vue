<template>
  <div class="planOutputGrid">
    <t-empty v-if="!displayOutputs.length" :description="$t('workbench.aso.emptyOutputs')" class="empty" />
    <div v-else class="grid">
      <div
        v-for="(out, idx) in displayOutputs"
        :key="out.imageId"
        class="card"
        :class="{ active: out.imageId === selectedImageId }"
        @click="emit('select', out.imageId)">
        <div class="cardMedia">
          <div v-if="out.state === '生成中'" class="stateBox loading f ac jc">
            <t-loading size="small" />
            <span class="stateText">{{ $t("workbench.aso.generating") }}</span>
          </div>
          <button
            v-else-if="out.filePath"
            type="button"
            class="thumbBtn"
            :title="$t('workbench.aso.outputClickPreview')"
            @click.stop="openPreview(out, idx)">
            <img :src="outputThumbUrl(out)" class="thumb" :alt="outputCardTitle(out)" />
            <span class="thumbOverlay">{{ $t("workbench.aso.outputClickPreview") }}</span>
          </button>
          <div v-else class="stateBox failed f ac jc">
            <span>{{ out.state || $t("workbench.aso.generateFailed") }}</span>
            <t-button
              v-if="out.state === '生成失败'"
              size="small"
              theme="primary"
              variant="outline"
              class="retryBtn"
              :loading="retryingImageId === out.imageId"
              :disabled="retryingImageId != null && retryingImageId !== out.imageId"
              @click.stop="emit('retry', out)">
              {{ $t("workbench.aso.regenerateOutput") }}
            </t-button>
          </div>
        </div>
        <div class="cardMeta">
          <div class="cardText">
            <div class="cardTitle" :title="outputCardTitle(out)">{{ outputCardTitle(out) }}</div>
            <div v-if="outputCardSubtitle(out)" class="cardSubtitle">{{ outputCardSubtitle(out) }}</div>
          </div>
          <div class="cardActions f ac">
            <t-button
              v-if="out.state === '已完成' && out.filePath"
              size="small"
              variant="text"
              theme="primary"
              @click.stop="emit('edit', out)">
              {{ $t("workbench.aso.outputEdit") }}
            </t-button>
            <t-tag v-if="out.state !== '已完成'" size="small" :theme="stateTheme(out.state)" variant="light">
              {{ out.state }}
            </t-tag>
          </div>
        </div>
        <div v-if="out.errorReason && out.state === '生成失败'" class="cardError">{{ out.errorReason }}</div>
      </div>
    </div>

    <t-image-viewer
      v-model:visible="previewVisible"
      :images="previewImages"
      :index="previewIndex"
      :close-on-overlay="true"
      attach="body" />
  </div>
</template>

<script setup lang="ts">
import { outputCardSubtitle, outputCardTitle, outputOriginalUrl, outputThumbUrl, sortOutputsBySlot } from "../utils/outputPreview";

const props = defineProps<{
  outputs: any[];
  selectedImageId?: number | null;
  retryingImageId?: number | null;
}>();

const emit = defineEmits<{ select: [imageId: number]; retry: [output: any]; edit: [output: any] }>();

const displayOutputs = computed(() => sortOutputsBySlot(props.outputs));

const previewVisible = ref(false);
const previewImages = ref<string[]>([]);
const previewIndex = ref(0);

function stateTheme(state: string) {
  if (state === "已完成") return "success";
  if (state === "生成失败") return "danger";
  return "primary";
}

function openPreview(out: any, idx: number) {
  const done = displayOutputs.value.filter((o) => o.filePath && o.state === "已完成");
  const urls = done.map((o) => outputOriginalUrl(o)).filter(Boolean);
  if (!urls.length) return;
  const target = outputOriginalUrl(out);
  previewImages.value = urls;
  previewIndex.value = Math.max(0, urls.indexOf(target));
  previewVisible.value = true;
}
</script>

<style scoped lang="scss">
.planOutputGrid {
  min-width: 0;
}
.empty {
  padding: 24px 0;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.card {
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;

  &:hover {
    box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14);
    transform: translateY(-2px);
  }

  &.active {
    border-color: var(--td-brand-color);
    box-shadow: 0 0 0 2px var(--td-brand-color-light), 0 10px 28px rgba(15, 23, 42, 0.14);
  }
}
.cardMedia {
  padding: 12px 12px 0;
  background: linear-gradient(165deg, #eef2ff 0%, #fdf2f8 55%, #f8fafc 100%);
}
.thumbBtn {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: #0f172a;
  cursor: zoom-in;
  position: relative;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
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
  font-size: 11px;
  color: #fff;
  text-align: center;
  background: rgba(15, 23, 42, 0.5);
  opacity: 0;
  transition: opacity 0.15s ease;
  pointer-events: none;
}
.thumb {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: #0f172a;
}
.stateBox {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  background: #0f172a;
  flex-direction: column;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.75);
  text-align: center;
  padding: 12px;
}
.stateBox.failed {
  color: #fca5a5;
}
.retryBtn {
  margin-top: 4px;
}
.stateText {
  font-size: 11px;
}
.cardMeta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 14px;
}
.cardActions {
  flex-shrink: 0;
  gap: 4px;
}
.cardText {
  flex: 1;
  min-width: 0;
}
.cardTitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--td-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cardSubtitle {
  margin-top: 2px;
  font-size: 11px;
  color: var(--td-text-color-secondary);
}
.cardError {
  padding: 0 14px 12px;
  font-size: 11px;
  line-height: 1.4;
  color: var(--td-error-color);
  word-break: break-word;
}
</style>
