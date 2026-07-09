export function outputThumbUrl(output: { filePath?: string | null }) {
  return output.filePath || "";
}

export function outputOriginalUrl(output: { filePath?: string | null; originalFilePath?: string | null }) {
  if (output.originalFilePath) return output.originalFilePath;
  const path = output.filePath || "";
  return path.replace(/\?size=\d+$/, "");
}

function parseEditTagIndex(tag?: string): number {
  const m = tag?.match(/^e(\d+)$/);
  return m ? Number(m[1]) : 0;
}

export function outputCardTitle(output: {
  presetId?: string;
  width?: number;
  height?: number;
  imageId?: number;
  slot?: number;
  promptSlot?: number;
  promptLabel?: string;
  editTag?: string;
}) {
  const slot = output.promptSlot ?? output.slot;
  if (slot != null) {
    const slotPart = output.editTag ? `${slot}-${output.editTag}` : `${slot}`;
    const label = output.promptLabel?.trim();
    return label ? `[${slotPart}] ${label}` : `[${slotPart}]`;
  }
  if (output.width && output.height) return `${output.width}×${output.height}`;
  if (output.presetId) {
    return output.presetId
      .replace(/^general_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return output.imageId ? `#${output.imageId}` : "";
}

export function outputSortKey(output: { promptSlot?: number; slot?: number; imageId?: number; createdAt?: number }) {
  const slot = output.promptSlot ?? output.slot;
  if (slot != null) return slot;
  return Number.MAX_SAFE_INTEGER;
}

export function sortOutputsBySlot<
  T extends { promptSlot?: number; slot?: number; imageId?: number; createdAt?: number; editTag?: string },
>(outputs: T[]): T[] {
  return [...outputs].sort((a, b) => {
    const keyDiff = outputSortKey(a) - outputSortKey(b);
    if (keyDiff !== 0) return keyDiff;
    const editDiff = parseEditTagIndex(a.editTag) - parseEditTagIndex(b.editTag);
    if (editDiff !== 0) return editDiff;
    const timeA = a.createdAt ?? a.imageId ?? 0;
    const timeB = b.createdAt ?? b.imageId ?? 0;
    return timeA - timeB;
  });
}

export function outputCardSubtitle(output: { createdAt?: number; state?: string }) {
  if (output.createdAt) {
    try {
      return new Date(output.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    } catch {
      /* ignore */
    }
  }
  if (output.state && output.state !== "已完成") return output.state;
  return "";
}
