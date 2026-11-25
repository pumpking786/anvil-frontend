/** Recolor neutral dark lettering only. Colored brand marks keep their original RGB. */
export function lightenLogoInk(pixels: Uint8ClampedArray, width: number, height: number) {
  const neutral = (at: number) =>
    Math.max(pixels[at], pixels[at + 1], pixels[at + 2]) -
      Math.min(pixels[at], pixels[at + 1], pixels[at + 2]) <=
    24;
  // Already-white logos must not be inverted or disappear in dark mode.
  let darkInk = false;
  for (let at = 0; at < pixels.length; at += 4) {
    if (pixels[at + 3] > 32 && neutral(at) && pixels[at] < 160) {
      darkInk = true;
      break;
    }
  }
  if (!darkInk) return false;
  const corners = [0, (width - 1) * 4, (height - 1) * width * 4, (width * height - 1) * 4];
  const whiteBackground = corners.every(
    (at) =>
      pixels[at + 3] > 250 &&
      neutral(at) &&
      Math.min(pixels[at], pixels[at + 1], pixels[at + 2]) > 245,
  );
  for (let at = 0; at < pixels.length; at += 4) {
    if (!pixels[at + 3] || !neutral(at)) continue;
    const lightness = (pixels[at] + pixels[at + 1] + pixels[at + 2]) / 3;
    if (whiteBackground) {
      // Unmatte a white canvas, including the antialiased edges of black text.
      pixels[at + 3] = Math.round(pixels[at + 3] * (1 - lightness / 255));
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
    } else if (lightness < 160) {
      pixels[at] = pixels[at + 1] = pixels[at + 2] = 255;
    }
  }
  return true;
}
