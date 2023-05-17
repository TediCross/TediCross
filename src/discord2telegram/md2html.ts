import simpleMarkdown, { SingleASTNode } from "simple-markdown";
import { TelegramSettings } from "../settings/TelegramSettings";
import { escapeHTMLSpecialChars, removeCustomEmojis, replaceAtWith, replaceExcessiveSpaces } from "./helpers";
import R from "ramda";

/***********
 * Helpers *
 ***********/

/** Map between content types and their HTML tags */
const tagMap = new Proxy(
	{
		u: "u",
		strong: "b",
		em: "em",
		inlineCode: "code",
		codeBlock: "pre"
	},
	{
		get(target: Record<string, any>, prop: string) {
			// Default to not having any tags
			const tags = {
				start: "",
				end: ""
			};
			// Check if tags are defined for this type
			if (prop in target) {
				// Create the proper tags
				tags.start = `<${target[prop]}>`;
				tags.end = `</${target[prop]}>`;
			}
			return tags;
		}
	}
);

/** Syntax tree node representing a newline */
const newlineNode = { content: "\n", type: "text" };

/**
 * Extracts pure texts from a node and its child nodes
 *
 * @param node	The syntax tree node to extract text from
 *
 * @return The concatenated text from all leaf nodes of this node
 */
function extractText(node: Record<string, any>) {
	// Extract the text from the node
	let text = node.content;
	if (node.content instanceof Array) {
		// The content was apparently not text... Recurse downward
		text = node.content.map(extractText).join("");
	}
	return text;
}

/*********************
 * Set up the parser *
 *********************/

// Ignore some rules which only creates trouble
["list", "heading"].forEach(type => {
	//@ts-ignore TODO: As per the documentation the defaultRules are only allowed to be read, not written, check for alternative way.
	simpleMarkdown.defaultRules[type] = {
		order: Number.POSITIVE_INFINITY,
		match: () => null // Never match anything in order to ignore this rule
	};
});

// Shorthand for the parser
const mdParse = simpleMarkdown.defaultBlockParse;

/*****************************
 * Make the parsing function *
 *****************************/

/**
 * Parse Discord's Markdown format to Telegram-accepted HTML
 *
 * @param text The markdown string to convert
 *
 * @return Telegram-friendly HTML
 */
export function md2html(text: string, settings: TelegramSettings) {
	// XXX Some users get a space after @ in mentions bridged to Telegram. See #148
	// This is compensation for that discord error
	text = R.replace("@\u200B", "@", R.defaultTo("", text));

	// Escape HTML in the input
	const processedText = escapeHTMLSpecialChars(text);

	// Parse the markdown and build HTML out of it
	const html = mdParse(processedText)
		.map(rootNode => {
			// Do some node preprocessing
			let content = rootNode; // Default to just keeping the node
			if (rootNode.type === "paragraph") {
				// Remove the outer paragraph, if one exists
				content = rootNode.content;
			}
			return content;
		})
		// Flatten the resulting structure
		.reduce((flattened: any, nodes) => flattened.concat([newlineNode, newlineNode], nodes), [])
		// Remove the two initial newlines created by the previous line
		.slice(2)
		.reduce((html: string, node: SingleASTNode) => {
			if (node.type === "br") {
				return html + "\n";
			} else if (node.type === "hr") {
				return html + "---";
			}

			// Turn the nodes into HTML
			// Telegram doesn't support nested tags, so only apply tags to the outer nodes
			// Get the tag type of this node
			const tags = tagMap[node.type];

			// Build the HTML
			return html + `${tags.start}${extractText(node)}${tags.end}`;
		}, "");
	return htmlCleanup(html, settings);
}

function htmlCleanup(input: string, settings: TelegramSettings) {
	if (settings.useCustomEmojiFilter) {
		input = removeCustomEmojis(input);
	}

	if (settings.replaceAtWithHash) {
		input = replaceAtWith(input, "#");
	}

	if (settings.replaceExcessiveSpaces) {
		input = replaceExcessiveSpaces(input);
	}
	return input;
}
