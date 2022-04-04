import { Client, Intents, MessageAttachment, MessageEmbed, NonThreadGuildBasedChannel } from 'discord.js';
import { OnPixelChanged } from './types';

export function initDiscord(): { sendAlert: (params: OnPixelChanged) => Promise<void> } {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
  let channel: NonThreadGuildBasedChannel | null = null;

  client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
  });

  client.login(process.env.DISCORD_BOT_TOKEN!);

  return {
    async sendAlert(params: OnPixelChanged) {
      if (!channel?.isText()) {
        return;
      }

      const file = new MessageAttachment(params.previewImageBuffer, 'colour.png');
      const embed = new MessageEmbed();
      embed
        .setTitle('Pixel changed!')
        .setURL(`https://www.reddit.com/r/place/?cx=${params.x}&cy=${params.y}&px=26`)
        .addField('X', `${params.x}`, true)
        .addField('Y', `${params.y}`, true)
        .setImage('attachment://colour.png');
      try {
        await channel.send({ embeds: [embed], files: [file] });
      } catch (err) {
        const message = `Pixel changed X:${params.x} Y:${params.y}!\nNow the colour is rgb(${params.afterColor.r}, ${params.afterColor.g}, ${params.afterColor.b})`;
        console.error(`Failed send message "${message}" to Discord!`);
        console.error(err);
      }
    },
  };
}
