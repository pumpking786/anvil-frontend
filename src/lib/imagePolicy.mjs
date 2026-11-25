// Shared verbatim with backend/server/imagePolicy.mjs for independent deployments.
export const cloudImagePattern =
  /^https:\/\/res\.cloudinary\.com\/[\w-]+\/image\/upload\/(?:[\w,./=-]+\/)*[\w.-]+\.(?:png|jpe?g|webp)(?:\?[\w=&%-]*)?$/i;
export function isImageSource(value) {
  return (
    typeof value === 'string' &&
    (!value ||
      cloudImagePattern.test(value) ||
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))
  );
}
export const safeImageSource = (value) => (isImageSource(value) ? value : '');
export function validImageData(value) {
  if (value === '' || cloudImagePattern.test(value)) return true;
  if (typeof value !== 'string' || value.length > 2_000_000) return false;
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  try {
    const b = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
    const v = new DataView(b.buffer);
    const text = (from, count) => String.fromCharCode(...b.subarray(from, from + count));
    const dims = (w, h) => w > 0 && h > 0 && w <= 8192 && h <= 8192 && w * h <= 16777216;
    if (match[1] === 'png') {
      if (
        b.length < 45 ||
        [...b.subarray(0, 8)].join(',') !== '137,80,78,71,13,10,26,10' ||
        text(12, 4) !== 'IHDR' ||
        v.getUint32(8) !== 13 ||
        !dims(v.getUint32(16), v.getUint32(20))
      )
        return false;
      let at = 8,
        data = false;
      while (at + 12 <= b.length) {
        const size = v.getUint32(at),
          type = text(at + 4, 4);
        if (at + size + 12 > b.length) return false;
        if (type === 'IDAT') data = true;
        if (type === 'IEND') return size === 0 && at + 12 === b.length && data;
        at += size + 12;
      }
      return false;
    }
    if (match[1] === 'jpeg') {
      if (b[0] !== 255 || b[1] !== 216 || b.at(-2) !== 255 || b.at(-1) !== 217) return false;
      for (let at = 2; at + 4 < b.length;) {
        if (b[at++] !== 255) return false;
        while (b[at] === 255) at++;
        const marker = b[at++];
        if (marker === 218 || marker === 217) return false;
        const size = v.getUint16(at);
        if (size < 2 || at + size > b.length) return false;
        if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
          return size >= 8 && dims(v.getUint16(at + 5), v.getUint16(at + 3));
        at += size;
      }
      return false;
    }
    if (
      b.length < 30 ||
      text(0, 4) !== 'RIFF' ||
      text(8, 4) !== 'WEBP' ||
      v.getUint32(4, true) + 8 !== b.length
    )
      return false;
    const kind = text(12, 4);
    if (kind === 'VP8X')
      return dims(
        1 + b[24] + (b[25] << 8) + (b[26] << 16),
        1 + b[27] + (b[28] << 8) + (b[29] << 16),
      );
    if (kind === 'VP8L')
      return (
        b[20] === 47 &&
        dims(
          1 + b[21] + ((b[22] & 63) << 8),
          1 + ((b[22] & 192) >> 6) + (b[23] << 2) + ((b[24] & 15) << 10),
        )
      );
    return (
      kind === 'VP8 ' &&
      b[23] === 157 &&
      b[24] === 1 &&
      b[25] === 42 &&
      dims(v.getUint16(26, true) & 16383, v.getUint16(28, true) & 16383)
    );
  } catch {
    return false;
  }
}
