export interface LastMessageSender {
	senderId: string;
	timestamp: number;
}

const groupingWindowMs = 5 * 60 * 1000;

/** Decide whether to suppress the sender header for a consecutive message. */
export function groupSenderMessage(
	lastSenderByStream: Map<string, LastMessageSender>,
	streamKey: string,
	senderId: string | undefined,
	enabled: boolean,
	startsNewGroup: boolean,
	now = Date.now()
): boolean {
	if (!enabled || startsNewGroup || !senderId) {
		lastSenderByStream.delete(streamKey);
		return false;
	}

	const previous = lastSenderByStream.get(streamKey);
	const grouped =
		previous?.senderId === senderId && now >= previous.timestamp && now - previous.timestamp <= groupingWindowMs;

	lastSenderByStream.set(streamKey, { senderId, timestamp: now });
	return grouped;
}
