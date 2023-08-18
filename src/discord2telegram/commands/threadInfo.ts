import { SlashCommandBuilder, CommandInteraction, PermissionFlagsBits } from "discord.js";

module.exports = {
	data: new SlashCommandBuilder()
		.setName("threadinfo")
		.setDescription("Provides information about the thread.")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
	async execute(interaction: CommandInteraction) {
		if (interaction.channel?.isThread()) {
			await interaction.reply({ content: "threadId: `" + interaction.channelId + "`.", ephemeral: true });
		} else {
			await interaction.reply({
				content: "Unable to detect threadID - call /threadinfo command from target thread's chat.",
				ephemeral: true
			});
		}
	}
};
