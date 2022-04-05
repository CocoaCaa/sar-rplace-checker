# SAR r/Place Checker

Check any block changes from original and send alert to Discord.

Although it could be general use, but at first I was especially made for the Super Animal Royale (a.k.a. SAR) community. So this project name included the word "SAR".

## Preview

![Messages preview](/docs/messages-preview.png)

## How it's works?

So below is the steps the bot does:

- This chat bot will start a headless browser (puppeteer) to load the [Reddit r/Place](https://www.reddit.com/r/place/) around the target image coordinates.
- After loaded it will start read the response message with filtered only the images come from https://hot-potato.reddit.com/media/canvas-images/*.png, and load it to buffer.
- There is a local manually updated image [ref-image.png](/ref-image.png) to compare with the buffer.
- The bot will compare the buffer with the target region with the ref-image.pbg, and send the message to Discord if there is any different.

## Credits

The project develop by [CocoaCaa](https://twitter.com/cocoa_caa)

[ref-image.png](/ref-image.png) is owned by multiple community

## Disclaimer

Super Animal Royale is copyright Pixile, Inc and is not affiliated with this project.
