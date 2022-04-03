import dotenv from 'dotenv';
import path from 'path';
import Jimp from 'jimp';
import puppeteer from 'puppeteer';
import { initDiscord } from './discord';

dotenv.config();

const REF_IMAGE_PATH = path.resolve(process.cwd(), 'ref-image.png');
const REF_IMAGE_FULL_PATH = path.resolve(process.cwd(), 'ref-image-full.png');
const PARTIAL_WIDTH = 1000;
const START_X = 1365;
const START_Y = 712;

async function handleFileAdded(params: {
  buffer: Buffer;
  refImage: Jimp;
  refImageFull: Jimp;
  onPixelChanged: (params: { x: number; y: number }) => unknown;
}) {
  try {
    const image = await Jimp.read(params.buffer);
    const isFullWidthImage = image.bitmap.width > PARTIAL_WIDTH;
    if (isFullWidthImage) {
      console.log('Full width image');
    }
    image.scan(START_X - (isFullWidthImage ? 0 : PARTIAL_WIDTH), START_Y, 21, 31, function (x, y, idx) {
      const red = image.bitmap.data[idx + 0];
      const green = image.bitmap.data[idx + 1];
      const blue = image.bitmap.data[idx + 2];
      const alpha = image.bitmap.data[idx + 3];
      if (alpha === 0) {
        return;
      }

      let refImageRed = 0;
      let refImageGreen = 0;
      let refImageBlue = 0;

      if (isFullWidthImage) {
        // Full width image
        refImageRed = params.refImageFull.bitmap.data[idx + 0];
        refImageGreen = params.refImageFull.bitmap.data[idx + 1];
        refImageBlue = params.refImageFull.bitmap.data[idx + 2];
      } else {
        // Partial width image
        refImageRed = params.refImage.bitmap.data[idx + 0];
        refImageGreen = params.refImage.bitmap.data[idx + 1];
        refImageBlue = params.refImage.bitmap.data[idx + 2];
      }

      if (red === refImageRed && green === refImageGreen && blue === refImageBlue) {
        return;
      }

      // For debug only
      // console.log(`rgb(${red}, ${green}, ${blue}) vs rgb(${refImageRed}, ${refImageGreen}, ${refImageBlue})`);
      // void fs.promises.writeFile(path.resolve(IMAGE_PATH, `${Date.now()}_${x}_${y + 1}.png`), params.buffer);

      params.onPixelChanged({ x: x + (isFullWidthImage ? 0 : PARTIAL_WIDTH), y });
    });
  } catch (err) {
    console.error('Failed to read image', err);
  }
}

async function startBrowser(params: {
  refImage: Jimp;
  refImageFull: Jimp;
  onPixelChanged: (params: { x: number; y: number }) => void;
}) {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://www.reddit.com/r/place/?cx=1365&cy=712&px=13');
  let lastTime = Date.now();

  let healthCheckIntervalId = setInterval(() => {
    console.log(`${(lastTime - startTime) / 1000}s`);
    if (Date.now() - lastTime > 30000) {
      clearInterval(healthCheckIntervalId);
      void browser.close();
      void startBrowser(params);
      console.error('Cannot get new image event a long time, restarting browser...');
    }
  }, 5000);

  const startTime = Date.now();
  page.on('response', async (event) => {
    if (!event.url().startsWith('https://hot-potato.reddit.com/media/canvas-images/')) {
      return;
    }

    lastTime = Date.now();

    handleFileAdded({
      buffer: await event.buffer(),
      refImage: params.refImage,
      refImageFull: params.refImageFull,
      onPixelChanged: params.onPixelChanged,
    });
  });
}

async function start() {
  const refImage = await Jimp.read(REF_IMAGE_PATH);
  const refImageFull = await Jimp.read(REF_IMAGE_FULL_PATH);
  const { sendAlert } = initDiscord();

  await startBrowser({
    refImage,
    refImageFull,
    onPixelChanged({ x, y }) {
      sendAlert({ x, y });
    },
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
