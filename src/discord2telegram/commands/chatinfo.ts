import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";

module.exports = {
	data: new SlashCommandBuilder()
		.setName("chatinfo")
		.setDescription("Provides information about the chat.")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction: CommandInteraction) {
		await interaction.reply({ content: "channelId: `" + interaction.channelId + "`.", ephemeral: true });
	}
};
