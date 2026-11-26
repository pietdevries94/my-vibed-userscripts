// Compares two screenshots of the same size pixel by pixel, in the browser. Dev file only.
import type { Page } from "playwright";

/** How far apart two pixels' red, green and blue may be, summed, and still count as the same. */
const SAME_PIXEL_DISTANCE = 48;
const PERCENT = 100;
/** Red, green, blue and alpha. */
const CHANNELS = 4;
/** Percentages keep two decimals. */
const DECIMALS = 100;

interface PixelDiff {
  /** The share of pixels that differ, in percent, to two decimals. */
  percent: number;
  pixels: number;
  /** Set when the two screenshots differ in size; then nothing else is compared. */
  sizes?: [string, string];
}

/** What the browser found: both sizes, and how many pixels differ when they match. */
interface Comparison {
  sizes: [string, string];
  pixels: number;
}

/** Both PNGs' pixels, drawn in the browser. */
interface Drawn {
  design: ImageData;
  site: ImageData;
}

/**
 * Draws both PNGs and counts the pixels whose red, green and blue differ by more than
 * `distance`, summed. Runs in the browser, so only the count comes back: a tall screenshot has
 * millions of values, too many to send to Node. Self-contained, as the browser gets only this
 * function.
 */
async function compareInBrowser([designSrc, siteSrc, distance, channels]: [
  string,
  string,
  number,
  number,
]): Promise<Comparison> {
  // oxlint-disable-next-line unicorn/consistent-function-scoping -- the browser gets only this function, so its helper lives in it
  const pixelsOf = async (src: string): Promise<ImageData> => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = new OffscreenCanvas(image.width, image.height).getContext("2d");
    canvas?.drawImage(image, 0, 0);
    return canvas?.getImageData(0, 0, image.width, image.height) ?? new ImageData(1, 1);
  };
  const [design, site]: Drawn[keyof Drawn][] = await Promise.all([
    pixelsOf(designSrc),
    pixelsOf(siteSrc),
  ]);
  const sizes: [string, string] = [
    `${design?.width}x${design?.height}`,
    `${site?.width}x${site?.height}`,
  ];
  let pixels = 0;
  for (
    let index = 0;
    sizes[0] === sizes[1] && index < (design?.data.length ?? 0);
    index += channels
  ) {
    const apart = [0, 1, 2].reduce(
      (sum, channel) =>
        sum + Math.abs((design?.data[index + channel] ?? 0) - (site?.data[index + channel] ?? 0)),
      0,
    );
    pixels += apart > distance ? 1 : 0;
  }
  return { pixels, sizes };
}

const dataUrl = (png: Buffer): string => `data:image/png;base64,${png.toString("base64")}`;

/** How much two PNG screenshots differ. `page` is any page; it is used as a canvas. */
async function pixelDiff(page: Page, design: Buffer, site: Buffer): Promise<PixelDiff> {
  await page.setContent("<p>");
  const { pixels, sizes } = await page.evaluate(compareInBrowser, [
    dataUrl(design),
    dataUrl(site),
    SAME_PIXEL_DISTANCE,
    CHANNELS,
  ] as [string, string, number, number]);
  if (sizes[0] !== sizes[1]) {
    return { percent: PERCENT, pixels: 0, sizes };
  }
  const [width, height] = sizes[0].split("x").map(Number);
  const share = pixels / ((width ?? 1) * (height ?? 1));
  return { percent: Math.round(share * PERCENT * DECIMALS) / DECIMALS, pixels };
}

export { pixelDiff };
export type { PixelDiff };
