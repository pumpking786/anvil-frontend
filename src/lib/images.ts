export async function readImage(file: File, maxDimension = 1000, photo = false): Promise<string> {
  if (!/\.(png|jpe?g|webp)$/i.test(file.name)) throw new Error('Choose a PNG, JPG or WebP file.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Choose an image smaller than 5 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be read. Try a different PNG, JPG, or WebP file.');
  }
  if (
    !bitmap.width ||
    !bitmap.height ||
    bitmap.width * bitmap.height > 16777216 ||
    bitmap.width > 8192 ||
    bitmap.height > 8192
  ) {
    bitmap.close();
    throw new Error('Choose an image up to 16 megapixels and 8192 pixels per side.');
  }
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Your browser could not prepare this image.');
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // Portraits retain more pixels for high-density displays. WebP avoids inflating
  // photographic uploads into huge PNGs; logos and document artwork remain lossless.
  let image = canvas.toDataURL(photo ? 'image/webp' : 'image/png', 0.96);
  if (photo && image.length > 2_000_000) image = canvas.toDataURL('image/webp', 0.9);
  if (image.length > 2_000_000)
    throw new Error('This image is too detailed. Please choose a smaller image.');
  return image;
}

export async function readIcon(file: File) {
  if (!/\.(ico|png|svg)$/i.test(file.name) || file.size > 1024 * 1024)
    throw new Error('Choose an ICO, PNG or SVG image up to 1 MB.');
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read this image.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new Error('This image could not be opened. Try another ICO, PNG or SVG.'));
    img.src = data;
  });
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    image.naturalWidth > 10000 ||
    image.naturalHeight > 10000
  )
    throw new Error('Choose an image with dimensions smaller than 10,000 pixels.');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not prepare the icon.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const scale = Math.min(256 / image.naturalWidth, 256 / image.naturalHeight),
    w = image.naturalWidth * scale,
    h = image.naturalHeight * scale;
  ctx.drawImage(image, (256 - w) / 2, (256 - h) / 2, w, h);
  return canvas.toDataURL('image/png');
}
