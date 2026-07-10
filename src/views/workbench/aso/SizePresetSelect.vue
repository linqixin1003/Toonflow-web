<template>
  <div class="sizePresetSelect">
    <t-select v-model="selected" :label="ct('sizePreset')" @change="onChange">
      <t-option-group v-for="group in groups" :key="group.label" :label="group.label">
        <t-option v-for="id in group.ids" :key="id" :value="id" :label="labelFor(id)" />
      </t-option-group>
    </t-select>
  </div>
</template>

<script setup lang="ts">
import { useCreativeApi } from "@/composables/useCreativeApi";
import { useCreativeI18n } from "@/composables/useCreativeI18n";
import { storeToRefs } from "pinia";
import projectStore from "@/stores/project";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [id: string] }>();

const { api, isUiuxProject } = useCreativeApi();
const { ct } = useCreativeI18n();
const presetMap = ref<Record<string, any>>({});
const groups = ref<{ label: string; ids: string[] }[]>([]);
const selected = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => {
    selected.value = v;
  },
);

async function loadPresets() {
  const { data } = await api.value.getSizePresets();
  presetMap.value = {};
  for (const p of data.presets) presetMap.value[p.id] = p;
  const groupEntries: { label: string; ids: string[] }[] = [];
  if (data.grouped.ios?.length) {
    groupEntries.push({ label: "iOS", ids: data.grouped.ios });
  }
  if (data.grouped.android?.length) {
    groupEntries.push({ label: "Android", ids: data.grouped.android });
  }
  if (data.grouped.general?.length) {
    groupEntries.push({ label: $t("workbench.aso.general") as string, ids: data.grouped.general });
  }
  groups.value = groupEntries;
  if (!selected.value || !presetMap.value[selected.value]) {
    const def = data.presets.find((p: any) => p.default);
    if (def) {
      selected.value = def.id;
      emit("update:modelValue", def.id);
    }
  }
}

onMounted(loadPresets);

watch(isUiuxProject, () => {
  void loadPresets();
});

function labelFor(id: string) {
  const p = presetMap.value[id];
  return p ? `${p.label} (${p.width}×${p.height})` : id;
}

async function onChange(val: string) {
  emit("update:modelValue", val);
  const { project } = storeToRefs(projectStore());
  if (project.value?.id) {
    await api.value.saveWorkspace(Number(project.value.id), { outputSizePreset: val });
  }
}
</script>
