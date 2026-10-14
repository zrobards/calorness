/**
 * Shrink a phone photo (often 4000px, 3+ MB) to 1024px JPEG before upload.
 * Faster to send, cheaper for the AI, and plenty of detail to recognize food.
 */
export async function resizeImage(file: File, maxSide = 1024): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg" };
}
