import R from "ramda";
import { Bridge } from "./Bridge";

/** Map between chat IDs and bridges */
export class BridgeMap {
	public bridges: Bridge[];
	private _discordToBridge: Map<number, Bridge[]>;
	private _telegramToBridge: Map<number, Bridge[]>;

	/**
	 * Creates a new bridge map
	 *
	 * @param bridges	The bridges to map
	 */
	constructor(bridges: Bridge[]) {
		/** List of all bridges */
		this.bridges = [...bridges];

		/** Map between Discord channel IDs and bridges */
		this._discordToBridge = new Map();

		/** Map between Telegram chat IDs and bridges */
		this._telegramToBridge = new Map();

		// Populate the maps and set
		bridges.forEach(bridge => {
			const d = this._discordToBridge.get(Number(bridge.discord.channelId)) || [];
			const t = this._telegramToBridge.get(bridge.telegram.chatId) || [];
			this._discordToBridge.set(Number(bridge.discord.channelId), [...d, bridge]);
			if (bridge.threadMap) {
				for (const trMap of bridge.threadMap) {
					const upBridge = {
						...bridge,
						tgThread: trMap.telegram
					};
					this._discordToBridge.set(Number(trMap.discord), [...d, upBridge]);
				}
			}
			this._telegramToBridge.set(bridge.telegram.chatId, [...t, bridge]);
		});
	}

	/**
	 * Gets a bridge from Telegram chat ID
	 *
	 * @param telegramChatId ID of the Telegram chat to get the bridge for
	 *
	 * @returns The bridges corresponding to the chat ID
	 */
	fromTelegramChatId(telegramChatId: number) {
		return R.defaultTo([], this._telegramToBridge.get(telegramChatId));
	}

	/**
	 * Gets a bridge from Discord channel ID
	 *
	 * @param discordChannelId ID of the Discord channel to get the bridge for
	 *
	 * @returns The bridges corresponding to the channel ID
	 */
	fromDiscordChannelId(discordChannelId: number) {
		return R.defaultTo([], this._discordToBridge.get(discordChannelId));
	}
}
