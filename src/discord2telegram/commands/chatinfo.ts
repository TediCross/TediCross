import { SlashCommandBuilder, CommandInteraction } from "discord.js";

module.exports = {
	data: new SlashCommandBuilder().setName("chatinfo").setDescription("Provides information about the chat."),
	async execute(interaction: CommandInteraction) {
		await interaction.reply({ content: "channelId: `" + interaction.channelId + "`.", ephemeral: true });
	}
};
