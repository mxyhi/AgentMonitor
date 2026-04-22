export function isDataUrlImageSource(source: string) {
  return source.startsWith("data:image/");
}

export async function createObjectUrlFromDataUrl(source: string) {
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

function scaleDimensions(width: number, height: number, maxEdge: number) {
  const largestEdge = Math.max(width, height);
  if (largestEdge <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / largestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function createPreviewObjectUrl(source: string, maxEdge = 2200) {
  try {
    const response = await fetch(source);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const target = scaleDimensions(bitmap.width, bitmap.height, maxEdge);
    if (target.width === bitmap.width && target.height === bitmap.height) {
      bitmap.close();
      return URL.createObjectURL(blob);
    }
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return URL.createObjectURL(blob);
    }
    context.drawImage(bitmap, 0, 0, target.width, target.height);
    bitmap.close();
    const previewBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, blob.type || "image/jpeg", 0.92);
    });
    if (!previewBlob) {
      return URL.createObjectURL(blob);
    }
    return URL.createObjectURL(previewBlob);
  } catch {
    return null;
  }
}
