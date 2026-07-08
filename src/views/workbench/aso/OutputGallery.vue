<template>

  <div class="outputGallery">

    <t-empty v-if="!outputs.length" :description="$t('workbench.aso.emptyOutputs')" />

    <div v-else class="grid" :class="{ vertical }">
      <div
        v-for="out in display"
        :key="out.imageId"
        class="outItem"
        :class="{ active: out.imageId === selectedImageId }"
        @click="emit('select', out.imageId)">

        <div class="meta f ac jb">

          <t-tag size="small" variant="light">{{ out.presetId }}</t-tag>

          <t-tag size="small" :theme="stateTheme(out.state)" variant="light">{{ out.state }}</t-tag>

        </div>

        <div v-if="out.state === '生成中'" class="loading f ac jc">

          <t-loading size="small" />

        </div>

        <img v-else-if="out.filePath" :src="out.filePath" class="preview" />

        <div v-else-if="out.errorReason" class="error">{{ out.errorReason }}</div>

      </div>

    </div>

  </div>

</template>



<script setup lang="ts">

import { pollingOutputs } from "@/api/aso";

import projectStore from "@/stores/project";



const props = defineProps<{ outputs: any[]; vertical?: boolean; selectedImageId?: number | null }>();
const emit = defineEmits<{ select: [imageId: number] }>();

const { project } = storeToRefs(projectStore());

const display = ref<any[]>([]);

let pollTimer: ReturnType<typeof setInterval> | null = null;



watch(

  () => props.outputs,

  async (val) => {

    display.value = [...val];

    schedulePoll();

  },

  { immediate: true, deep: true },

);



onUnmounted(() => {

  if (pollTimer) clearInterval(pollTimer);

});



const outputs = computed(() => display.value);



function stateTheme(state: string) {

  if (state === "已完成") return "success";

  if (state === "生成失败") return "danger";

  return "primary";

}



function schedulePoll() {

  if (pollTimer) clearInterval(pollTimer);

  const pending = display.value.filter((o) => o.state === "生成中").map((o) => o.imageId);

  if (!pending.length || !project.value?.id) return;

  pollTimer = setInterval(() => refreshPending(pending), 2500);

}



async function refreshPending(imageIds: number[]) {

  if (!project.value?.id || !imageIds.length) return;

  const { data } = await pollingOutputs(Number(project.value.id), imageIds);

  let stillPending = false;

  for (const item of data) {

    const idx = display.value.findIndex((o) => o.imageId === item.imageId);

    if (idx >= 0) display.value[idx] = { ...display.value[idx], ...item };

    if (item.state === "生成中") stillPending = true;

  }

  if (!stillPending && pollTimer) {

    clearInterval(pollTimer);

    pollTimer = null;

  }

}



defineExpose({

  refresh: () => refreshPending(display.value.filter((o) => o.state === "生成中").map((o) => o.imageId)),

});

</script>



<style scoped lang="scss">

.grid {

  display: grid;

  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));

  gap: 12px;

  &.vertical {

    grid-template-columns: 1fr;

  }

}

.outItem {

  border: 1px solid var(--td-border-level-1-color);

  border-radius: 8px;

  padding: 8px;

  cursor: pointer;

  &.active {

    border-color: var(--td-brand-color);

    box-shadow: 0 0 0 2px var(--td-brand-color-light);

  }

}

.meta {

  margin-bottom: 8px;

  gap: 8px;

}

.preview {

  width: 100%;

  border-radius: 6px;

  display: block;

}

.loading {

  min-height: 120px;

}

.error {

  font-size: 12px;

  color: var(--td-error-color);

  word-break: break-word;

}

</style>

