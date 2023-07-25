"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const jimp_1 = __importDefault(require("jimp"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const discord_1 = require("./discord");
dotenv_1.default.config();
const REF_IMAGE_PATH = path_1.default.resolve(process.cwd(), 'ref-image.png');
const PARTIAL_WIDTH = 1000;
function handleFileAdded(params) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const image = yield jimp_1.default.read(params.buffer);
            image.scan(params.targetArtwork.x, params.targetArtwork.y, params.targetArtwork.width, params.targetArtwork.height, function (x, y, idx) {
                return __awaiter(this, void 0, void 0, function* () {
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
                    let renderImage = new jimp_1.default(RENDER_WIDTH, RENDER_HEIGHT);
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
                            }
                            else {
                                renderImage.bitmap.data[renderIdx + 0] = params.refImage.bitmap.data[refIdx + 0];
                                renderImage.bitmap.data[renderIdx + 1] = params.refImage.bitmap.data[refIdx + 1];
                                renderImage.bitmap.data[renderIdx + 2] = params.refImage.bitmap.data[refIdx + 2];
                                renderImage.bitmap.data[renderIdx + 3] = params.refImage.bitmap.data[refIdx + 3];
                            }
                        }
                    }
                    const SCALE_UP_PX = 100;
                    renderImage = renderImage.resize(SCALE_UP_PX, SCALE_UP_PX, jimp_1.default.RESIZE_NEAREST_NEIGHBOR);
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
                    const previewImageBuffer = yield renderImage.getBufferAsync(jimp_1.default.MIME_PNG);
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
                });
            });
        }
        catch (err) {
            console.error('Failed to read image', err);
        }
    });
}
function startBrowser(params) {
    return __awaiter(this, void 0, void 0, function* () {
        const targetStartX = Number(process.env.TARGET_ARTWORK_START_X);
        const targetStartY = Number(process.env.TARGET_ARTWORK_START_Y);
        const targetRefStartX = Number(process.env.TARGET_ARTWORK_REF_START_X);
        const targetRefStartY = Number(process.env.TARGET_ARTWORK_REF_START_Y);
        const targetWidth = Number(process.env.TARGET_ARTWORK_WIDTH);
        const targetHeight = Number(process.env.TARGET_ARTWORK_HEIGHT);
        console.log(`Scan artwork in X: ${targetStartX}, Y: ${targetStartY}, W: ${targetWidth}, H: ${targetHeight}`);
        const browser = yield puppeteer_1.default.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = yield browser.newPage();
        yield page.goto(`https://www.reddit.com/r/place/?cx=${targetStartX}&cy=${targetStartY}&px=13`);
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
        page.on('response', (event) => __awaiter(this, void 0, void 0, function* () {
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
                buffer: yield event.buffer(),
                refImage: params.refImage,
                onPixelChanged: params.onPixelChanged,
            });
        }));
    });
}
function start() {
    return __awaiter(this, void 0, void 0, function* () {
        const refImage = yield jimp_1.default.read(REF_IMAGE_PATH);
        const { sendAlert } = (0, discord_1.initDiscord)();
        yield startBrowser({
            refImage,
            onPixelChanged(params) {
                sendAlert(params);
            },
        });
    });
}
start().catch((err) => {
    console.error(err);
    process.exit(1);
});
