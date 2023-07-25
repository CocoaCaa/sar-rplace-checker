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
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDiscord = void 0;
const discord_js_1 = require("discord.js");
function initDiscord() {
    const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS] });
    let channel = null;
    client.once('ready', () => __awaiter(this, void 0, void 0, function* () {
        const guild = yield client.guilds.fetch(process.env.DISCORD_GUILD_ID);
        channel = yield guild.channels.fetch(process.env.DISCORD_CHANNEL_ID);
    }));
    client.login(process.env.DISCORD_BOT_TOKEN);
    return {
        sendAlert(params) {
            return __awaiter(this, void 0, void 0, function* () {
                if (!(channel === null || channel === void 0 ? void 0 : channel.isText())) {
                    return;
                }
                const file = new discord_js_1.MessageAttachment(params.previewImageBuffer, 'colour.png');
                const embed = new discord_js_1.MessageEmbed();
                embed
                    .setTitle('Pixel changed!')
                    .setURL(`https://www.reddit.com/r/place/?cx=${params.x}&cy=${params.y}&px=26`)
                    .addField('X', `${params.x}`, true)
                    .addField('Y', `${params.y}`, true)
                    .setImage('attachment://colour.png');
                try {
                    yield channel.send({ embeds: [embed], files: [file] });
                }
                catch (err) {
                    const message = `Pixel changed X:${params.x} Y:${params.y}!\nNow the colour is rgb(${params.afterColor.r}, ${params.afterColor.g}, ${params.afterColor.b})`;
                    console.error(`Failed send message "${message}" to Discord!`);
                    console.error(err);
                }
            });
        },
    };
}
exports.initDiscord = initDiscord;
