import dotenv from 'dotenv';
import path from 'path';
import Jimp from 'jimp';
import puppeteer from 'puppeteer';
import { initDiscord } from './discord';
import { OnPixelChanged } from './types';

dotenv.config();

const REF_IMAGE_PATH = path.resolve(process.cwd(), 'ref-image.png');
const PARTIAL_WIDTH = 1000;

async function handleFileAdded(params: {
  targetArtwork: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  buffer: Buffer;
  refImage: Jimp;
  onPixelChanged: (params: OnPixelChanged) => unknown;
}) {
  try {
    const image = await Jimp.read(params.buffer);

    image.scan(
      params.targetArtwork.x,
      params.targetArtwork.y,
      params.targetArtwork.width,
      params.targetArtwork.height,
      async function (x, y, idx) {
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

        const RENDER_WIDTH = 7;
        const RENDER_HEIGHT = 7;
        let renderImage = new Jimp(RENDER_WIDTH, RENDER_HEIGHT);

        const renderStartX = x - Math.floor(RENDER_WIDTH / 2);
        const renderStartY = y - Math.floor(RENDER_HEIGHT / 2);
        for (let iX = 0; iX < RENDER_WIDTH; iX++) {
          for (let iY = 0; iY < RENDER_HEIGHT; iY++) {
            const refX = renderStartX + iX;
            const refY = renderStartY + iY;
            const refIdx = params.refImage.getPixelIndex(refX, refY);
            const renderIdx = renderImage.getPixelIndex(iX, iY);

            if (refX === x && refY === y) {
              renderImage.bitmap.data[renderIdx + 0] = image.bitmap.data[refIdx + 0];
              renderImage.bitmap.data[renderIdx + 1] = image.bitmap.data[refIdx + 1];
              renderImage.bitmap.data[renderIdx + 2] = image.bitmap.data[refIdx + 2];
              renderImage.bitmap.data[renderIdx + 3] = image.bitmap.data[refIdx + 3];
            } else {
              renderImage.bitmap.data[renderIdx + 0] = params.refImage.bitmap.data[refIdx + 0];
              renderImage.bitmap.data[renderIdx + 1] = params.refImage.bitmap.data[refIdx + 1];
              renderImage.bitmap.data[renderIdx + 2] = params.refImage.bitmap.data[refIdx + 2];
              renderImage.bitmap.data[renderIdx + 3] = params.refImage.bitmap.data[refIdx + 3];
            }
          }
        }

        const SCALE_UP_PX = 100;
        renderImage = renderImage.resize(SCALE_UP_PX, SCALE_UP_PX, Jimp.RESIZE_NEAREST_NEIGHBOR);

        const oneBlockSize = Math.ceil(SCALE_UP_PX / RENDER_WIDTH) + 2;
        const boarderStartX = Math.floor(Math.floor(RENDER_WIDTH / 2) * (SCALE_UP_PX / RENDER_WIDTH));
        const boarderStartY = Math.floor(Math.floor(RENDER_HEIGHT / 2) * (SCALE_UP_PX / RENDER_HEIGHT));

        for (let iX = 0; iX < oneBlockSize; iX++) {
          for (let iY = 0; iY < oneBlockSize; iY++) {
            if (iX > 0 && iY > 0 && iX < oneBlockSize - 1 && iY < oneBlockSize - 1) {
              continue;
            }
            renderImage.setPixelColour(0xff00ffff, boarderStartX + iX, boarderStartY + iY);
          }
        }

        const previewImageBuffer = await renderImage.getBufferAsync(Jimp.MIME_PNG);

        params.onPixelChanged({
          x: x + PARTIAL_WIDTH,
          y,
          previewImageBuffer,
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
      },
    );
  } catch (err) {
    console.error('Failed to read image', err);
  }
}

async function startBrowser(params: { refImage: Jimp; onPixelChanged: (params: OnPixelChanged) => void }) {
  const targetStartX = Number(process.env.TARGET_ARTWORK_START_X);
  const targetStartY = Number(process.env.TARGET_ARTWORK_START_Y);
  const targetRefStartX = Number(process.env.TARGET_ARTWORK_REF_START_X);
  const targetRefStartY = Number(process.env.TARGET_ARTWORK_REF_START_Y);
  const targetWidth = Number(process.env.TARGET_ARTWORK_WIDTH);
  const targetHeight = Number(process.env.TARGET_ARTWORK_HEIGHT);
  console.log(`Scan artwork in X: ${targetStartX}, Y: ${targetStartY}, W: ${targetWidth}, H: ${targetHeight}`);

  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.goto(`https://www.reddit.com/r/place/?cx=${targetStartX}&cy=${targetStartY}&px=13`);
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
    if (!event.url().startsWith('https://garlic-bread.reddit.com/media/canvas-images/')) {
      return;
    }

    lastTime = Date.now();

    handleFileAdded({
      targetArtwork: {
        x: targetRefStartX,
        y: targetRefStartY,
        width: targetWidth,
        height: targetHeight,
      },
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
      // console.log(params);
    },
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
