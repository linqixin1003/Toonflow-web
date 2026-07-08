<template>
  <div class="sizePresetSelect">
    <t-select v-model="selected" :label="$t('workbench.aso.sizePreset')" @change="onChange">
      <t-option-group v-for="group in groups" :key="group.label" :label="group.label">
        <t-option v-for="id in group.ids" :key="id" :value="id" :label="labelFor(id)" />
      </t-option-group>
    </t-select>
  </div>
</template>

<script setup lang="ts">
import { getSizePresets, saveWorkspace } from "@/api/aso";
import projectStore from "@/stores/project";

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits<{ "update:modelValue": [id: string] }>();

const { project } = storeToRefs(projectStore());
const presetMap = ref<Record<string, any>>({});
const groups = ref<{ label: string; ids: string[] }[]>([]);
const selected = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => {
    selected.value = v;
  },
);

onMounted(async () => {
  const { data } = await getSizePresets();
  for (const p of data.presets) presetMap.value[p.id] = p;
  groups.value = [
    { label: "iOS", ids: data.grouped.ios },
    { label: "Android", ids: data.grouped.android },
    { label: $t("workbench.aso.general") as string, ids: data.grouped.general },
  ];
  if (!selected.value) {
    const def = data.presets.find((p: any) => p.default);
    if (def) {
      selected.value = def.id;
      emit("update:modelValue", def.id);
    }
  }
});

function labelFor(id: string) {
  const p = presetMap.value[id];
  return p ? `${p.label} (${p.width}×${p.height})` : id;
}

async function onChange(val: string) {
  emit("update:modelValue", val);
  if (project.value?.id) await saveWorkspace(Number(project.value.id), { outputSizePreset: val });
}
</script>
