/**
 * Look for a product barcode in a photo before asking the AI anything.
 * A barcode gives exact label values for free (no AI cost, no guessing).
 */
export async function findBarcode(file: File): Promise<string | null> {
  try {
    const { BarcodeDetector } = await import("barcode-detector/ponyfill");
    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    const bitmap = await createImageBitmap(file);
    const codes = await detector.detect(bitmap);
    bitmap.close();
    return codes[0]?.rawValue ?? null;
  } catch {
    return null;
  }
}
