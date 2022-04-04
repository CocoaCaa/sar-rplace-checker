import dotenv from 'dotenv';
import path from 'path';
import Jimp from 'jimp';
import puppeteer from 'puppeteer';
import { initDiscord } from './discord';
import { OnPixelChanged } from './types';

dotenv.config();

const REF_IMAGE_PATH = path.resolve(process.cwd(), 'ref-image.png');
const PARTIAL_WIDTH = 1000;
const START_X = 1365 - PARTIAL_WIDTH;
const START_Y = 712;

async function handleFileAdded(params: {
  buffer: Buffer;
  refImage: Jimp;
  onPixelChanged: (params: OnPixelChanged) => unknown;
}) {
  try {
    const image = await Jimp.read(params.buffer);
    image.scan(START_X, START_Y, 21, 31, function (x, y, idx) {
      const red = image.bitmap.data[idx + 0];
      const green = image.bitmap.data[idx + 1];
      const blue = image.bitmap.data[idx + 2];
      const alpha = image.bitmap.data[idx + 3];
      if (alpha === 0) {
        return;
      }

      const refImageRed = params.refImage.bitmap.data[idx + 0];
      const refImageGreen = params.refImage.bitmap.data[idx + 1];
      const refImageBlue = params.refImage.bitmap.data[idx + 2];

      if (red === refImageRed && green === refImageGreen && blue === refImageBlue) {
        return;
      }

      params.onPixelChanged({
        x: x + PARTIAL_WIDTH,
        y,
        beforeColor: {
          r: refImageRed,
          g: refImageGreen,
          b: refImageBlue,
        },
        afterColor: {
          r: red,
          g: green,
          b: blue,
        },
      });
    });
  } catch (err) {
    console.error('Failed to read image', err);
  }
}

async function startBrowser(params: { refImage: Jimp; onPixelChanged: (params: OnPixelChanged) => void }) {
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
      onPixelChanged: params.onPixelChanged,
    });
  });
}

async function start() {
  const refImage = await Jimp.read(REF_IMAGE_PATH);
  const { sendAlert } = initDiscord();

  await startBrowser({
    refImage,
    onPixelChanged(params) {
      sendAlert(params);
    },
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
