/** Reads an image file and returns a (downscaled) JPEG/PNG data URL suitable for embedding in projects. */
export async function imageFileToDataUrl(file: File, maxDim = 2048): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Il file selezionato non è un’immagine.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Impossibile leggere l’immagine.'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    const keepAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/svg+xml';
    return keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}
