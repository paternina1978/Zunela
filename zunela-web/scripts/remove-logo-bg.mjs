import sharp from "sharp";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = resolve(root, "public/logo-zunela.png");
const output = source;

const { data, info } = await sharp(source)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width, height, channels } = info;

for (let i = 0; i < data.length; i += channels) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];

  const maxDiff = Math.max(255 - r, 255 - g, 255 - b);

  if (maxDiff <= 10) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    continue;
  }

  const alpha = Math.min(255, Math.round((maxDiff / 255) * 255 * 1.08));
  data[i] = Math.min(255, Math.round(255 - ((255 - r) * 255) / alpha));
  data[i + 1] = Math.min(255, Math.round(255 - ((255 - g) * 255) / alpha));
  data[i + 2] = Math.min(255, Math.round(255 - ((255 - b) * 255) / alpha));
  data[i + 3] = alpha;
}

let minX = width;
let minY = height;
let maxX = 0;
let maxY = 0;

for (let y = 0; y < height; y += 1) {
  for (let x = 0; x < width; x += 1) {
    const a = data[(y * width + x) * channels + 3];
    if (a > 12) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
}

const pad = 16;
minX = Math.max(0, minX - pad);
minY = Math.max(0, minY - pad);
maxX = Math.min(width - 1, maxX + pad);
maxY = Math.min(height - 1, maxY + pad);

await sharp(data, {
  raw: { width, height, channels },
})
  .extract({
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  })
  .png()
  .toFile(output);

console.log(
  `Logo sin fondo: ${maxX - minX + 1}x${maxY - minY + 1} desde ${width}x${height}`,
);
