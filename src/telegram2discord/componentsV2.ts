import { AttachmentBuilder, MessageFlags, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder } from "discord.js";

const avatarCache = new Map<string, { avatar: Buffer | null; expiresAt: number }>();
const avatarFilename = "telegram-sender-avatar.jpg";
const avatarCacheTtlMs = 30 * 60 * 1000;

async function getSenderAvatar(ctx: any, message: any): Promise<Buffer | undefined> {
	const userId = message.from?.id;
	const senderChatId = message.sender_chat?.id;
	const cacheKey = senderChatId ? `chat:${senderChatId}` : userId ? `user:${userId}` : undefined;
	if (!cacheKey) return undefined;

	const cached = avatarCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) return cached.avatar ?? undefined;
	avatarCache.delete(cacheKey);
	let avatar: Buffer | undefined;
	try {
		let fileId: string | undefined;
		if (senderChatId) {
			const chat = await ctx.telegram.getChat(senderChatId);
			fileId = chat.photo?.big_file_id;
		} else if (userId) {
			const profile = await ctx.telegram.getUserProfilePhotos(userId, 0, 1);
			fileId = profile.photos[0]?.at(-1)?.file_id;
		}

		if (fileId) {
			const fileUrl = await ctx.telegram.getFileLink(fileId);
			const response = await fetch(fileUrl);
			if (response.ok) {
				const bytes = Buffer.from(await response.arrayBuffer());
				if (bytes.length <= 1_000_000) avatar = bytes;
			}
		}
	} catch {
		// A missing or inaccessible profile photo must not stop message delivery.
	}
	avatarCache.set(cacheKey, { avatar: avatar ?? null, expiresAt: Date.now() + avatarCacheTtlMs });
	if (avatarCache.size > 256) avatarCache.delete(avatarCache.keys().next().value!);

	return avatar ?? undefined;
}

function chunkText(text: string, maxLength: number): string[] {
	const chunks: string[] = [];
	for (let offset = 0; offset < text.length; offset += maxLength) {
		chunks.push(text.slice(offset, offset + maxLength));
	}
	return chunks;
}

/** Build a Components V2 message for Telegram-originated bridge messages. */
export async function createComponentsV2Message(ctx: any, prepared: any, includeMedia = true) {
	const content = prepared.text || "\u200b";
	const header = prepared.header || (prepared.grouped ? "" : `**${prepared.senderName}**`);
	const avatar = header ? await getSenderAvatar(ctx, ctx.tediCross.message) : undefined;
	const components: Array<SectionBuilder | TextDisplayBuilder> = [];

	if (header) {
		const firstChunkLength = Math.max(1, 4000 - header.length - 1);
		const [first = "", ...remaining] = chunkText(content, firstChunkLength);
		if (avatar) {
			const section = new SectionBuilder().addTextDisplayComponents(
				new TextDisplayBuilder().setContent(`${header}${first ? `\n${first}` : ""}`)
			);
			section.setThumbnailAccessory(
				new ThumbnailBuilder()
					.setURL(`attachment://${avatarFilename}`)
					.setDescription(`${prepared.senderName}'s avatar`)
			);
			components.push(section);
		} else {
			components.push(new TextDisplayBuilder().setContent(`${header}${first ? `\n${first}` : ""}`));
		}
		components.push(...remaining.map(chunk => new TextDisplayBuilder().setContent(chunk)));
	} else {
		components.push(...chunkText(content, 4000).map(chunk => new TextDisplayBuilder().setContent(chunk)));
	}

	const files: AttachmentBuilder[] = [];
	if (includeMedia) {
		const mediaFiles = prepared.files?.length ? prepared.files : prepared.file ? [prepared.file] : [];
		files.push(...mediaFiles);
	}
	if (avatar) files.push(new AttachmentBuilder(avatar, { name: avatarFilename }));

	return {
		components,
		flags: [MessageFlags.IsComponentsV2],
		...(files.length ? { files } : {})
	};
}
