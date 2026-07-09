<template>
  <t-dialog
    v-model:visible="visible"
    :header="dialogTitle"
    attach="body"
    width="560px"
    :confirm-btn="{ content: $t('common.confirm'), loading: saving }"
    :cancel-btn="{ content: $t('common.cancel') }"
    @confirm="onConfirm"
    @close="onClose">
    <t-form label-align="top">
      <t-form-item :label="$t('workbench.aso.editImagePromptLabel')">
        <t-input v-model="form.label" :placeholder="$t('workbench.aso.editImagePromptLabelPh')" />
      </t-form-item>
      <t-form-item :label="$t('workbench.aso.editImagePromptBody')">
        <t-textarea
          v-model="form.prompt"
          :autosize="{ minRows: 6, maxRows: 16 }"
          :placeholder="$t('workbench.aso.editImagePromptBodyPh')" />
      </t-form-item>
    </t-form>
  </t-dialog>
</template>

<script setup lang="ts">
const props = defineProps<{
  slot: number;
  label?: string;
  prompt: string;
}>();

const visible = defineModel<boolean>("visible", { default: false });

const saving = defineModel<boolean>("saving", { default: false });

const emit = defineEmits<{
  save: [payload: { slot: number; label: string; prompt: string }];
}>();

const form = ref({ label: "", prompt: "" });

const dialogTitle = computed(() => $t("workbench.aso.editImagePromptTitle", { slot: props.slot }));

watch(
  () => [visible.value, props.slot, props.label, props.prompt] as const,
  ([open]) => {
    if (!open) return;
    form.value = {
      label: props.label?.trim() ?? "",
      prompt: props.prompt ?? "",
    };
  },
);

function onClose() {
  saving.value = false;
}

function onConfirm() {
  const prompt = form.value.prompt.trim();
  if (!prompt) {
    window.$message.warning($t("workbench.aso.editImagePromptRequired"));
    return false;
  }
  emit("save", {
    slot: props.slot,
    label: form.value.label.trim(),
    prompt,
  });
  return false;
}
</script>
