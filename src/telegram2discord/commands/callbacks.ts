import { TediCrossContext } from "../endwares";

/**
 * Callback handler registry for organizing and routing Telegram callback queries
 */
interface CallbackHandler {
	pattern: RegExp | string;
	handler: (ctx: TediCrossContext) => Promise<void>;
}

// Registry of callback handlers
const callbackHandlers: CallbackHandler[] = [];

/**
 * Register a callback handler
 *
 * @param pattern - RegExp or string pattern to match against callback data
 * @param handler - Handler function to call when pattern matches
 */
export function registerCallbackHandler(pattern: RegExp | string, handler: (ctx: TediCrossContext) => Promise<void>) {
	callbackHandlers.push({ pattern, handler });
}

/**
 * Process a callback query by routing it to the appropriate handler
 *
 * @param ctx - The Telegram context containing the callback query
 * @returns Promise resolving when the callback is handled
 */
export async function processCallback(ctx: TediCrossContext): Promise<void> {
	if (!ctx.callbackQuery) return;

	// Telegraf has different types of callback queries
	const callbackQuery = ctx.callbackQuery as any;
	if (!callbackQuery.data) return;

	const data = callbackQuery.data as string;
	const logger = ctx.TediCross.logger;

	logger.info(`Processing callback: ${data}`);

	// Find matching handler
	for (const { pattern, handler } of callbackHandlers) {
		const matches = typeof pattern === "string" ? data === pattern || data.startsWith(pattern) : pattern.test(data);

		if (matches) {
			try {
				await handler(ctx);
				return;
			} catch (error: any) {
				logger.error(`Error in callback handler for pattern ${pattern}: ${error.message}`);
				logger.error(error.stack);
				try {
					await ctx.answerCbQuery("An error occurred");
				} catch (err) {
					// Ignore error answering callback query
				}
				return;
			}
		}
	}

	// No handler found
	logger.warn(`No handler found for callback query: ${data}`);
	await ctx.answerCbQuery("Unknown command");
}
