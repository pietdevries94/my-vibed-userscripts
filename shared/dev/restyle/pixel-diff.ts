// Compares two screenshots of the same size pixel by pixel, in the browser. Dev file only.
import type { Page } from "playwright";

/** How far apart two pixels' red, green and blue may be, summed, and still count as the same. */
const SAME_PIXEL_DISTANCE = 48;
const CHANNELS = 4;
const PERCENT = 100;
/** Percentages keep two decimals. */
const DECIMALS = 100;

interface PixelDiff {
  /** The share of pixels that differ, in percent, to two decimals. */
  percent: number;
  pixels: number;
  /** Set when the two screenshots differ in size; then nothing else is compared. */
  sizes?: [string, string];
}

interface Pixels {
  width: number;
  height: number;
  data: number[];
}

/** Draws a PNG and reads its pixels. Runs in the browser. */
async function pixelsOf(src: string): Promise<Pixels> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d");
  canvas?.drawImage(image, 0, 0);
  const data = canvas?.getImageData(0, 0, image.width, image.height).data ?? [];
  return { data: [...data], height: image.height, width: image.width };
}

function sizeOf(pixels: Pixels): string {
  return `${pixels.width}x${pixels.height}`;
}

/** How many pixels differ by more than SAME_PIXEL_DISTANCE. */
function differingPixels(design: Pixels, site: Pixels): number {
  let count = 0;
  for (let index = 0; index < design.data.length; index += CHANNELS) {
    const distance =
      Math.abs(design.data[index] - site.data[index]) +
      Math.abs(design.data[index + 1] - site.data[index + 1]) +
      Math.abs(design.data[index + 2] - site.data[index + 2]);
    if (distance > SAME_PIXEL_DISTANCE) {
      count += 1;
    }
  }
  return count;
}

/** How much two PNG screenshots differ. `page` is any page; it is used as a canvas. */
async function pixelDiff(page: Page, design: Buffer, site: Buffer): Promise<PixelDiff> {
  await page.setContent("<p>");
  const [designPixels, sitePixels] = await Promise.all(
    [design, site].map(async (png) =>
      page.evaluate(pixelsOf, `data:image/png;base64,${png.toString("base64")}`),
    ),
  );
  if (sizeOf(designPixels) !== sizeOf(sitePixels)) {
    return { percent: PERCENT, pixels: 0, sizes: [sizeOf(designPixels), sizeOf(sitePixels)] };
  }
  const pixels = differingPixels(designPixels, sitePixels);
  const share = pixels / (designPixels.width * designPixels.height);
  return { percent: Math.round(share * PERCENT * DECIMALS) / DECIMALS, pixels };
}

export { pixelDiff };
export type { PixelDiff };
