import { Client, Intents, NonThreadGuildBasedChannel } from 'discord.js';

export function initDiscord(): { sendAlert: (params: { x: number; y: number }) => Promise<void> } {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });
  let channel: NonThreadGuildBasedChannel | null = null;

  client.once('ready', async () => {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    channel = await guild.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
  });

  client.login(process.env.DISCORD_BOT_TOKEN!);

  return {
    async sendAlert(params: { x: number; y: number }) {
      if (!channel?.isText()) {
        return;
      }
      const message = `Pixel changed X:${params.x} Y:${params.y}!`;
      try {
        await channel.send(message);
      } catch {
        console.error(`Failed send message "${message}" to Discord!`);
      }
    },
  };
}
