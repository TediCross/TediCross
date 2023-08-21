import simpleMarkdown, { Capture, OptionalState, SingleASTNode } from "simple-markdown";
import { TelegramSettings } from "../settings/TelegramSettings";
import { escapeHTMLSpecialChars, removeCustomEmojis, replaceAtWith, replaceExcessiveSpaces } from "./helpers";
import R from "ramda";
import _ from "underscore";

/***********
 * Helpers *
 ***********/

/** Map between content types and their HTML tags */
const tagMap = new Proxy(
	{
		u: "u",
		strong: "b",
		em: "em",
		i: "i",
		del: "strike",
		inlineCode: "code",
		codeBlock: "pre",
		spoiler: "tg-spoiler"
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
const spoilerRule = {
	// Specify the order in which this rule is to be run
	order: simpleMarkdown.defaultRules.em.order - 0.5,

	// First we check whether a string matches
	match: function (source: string) {
		return /^\|\|([\s\S]+?)\|\|(?!_)/.exec(source);
	},

	// Then parse this string into a syntax node
	parse: function (capture: Capture, parse: Function, state: OptionalState) {
		return {
			content: parse(capture[1], state)
		};
	},

	// Or an html element:
	// (Note: you may only need to make one of `react:` or
	// `html:`, as long as you never ask for an outputter
	// for the other type.)
	html: function (node: SingleASTNode, output: Function) {
		return "<spoiler>" + output(node.content) + "</spoiler>";
	}
};

const rules = _.extend({}, simpleMarkdown.defaultRules, {
	// Ignore some rules which only creates trouble
	list: Object.assign({}, simpleMarkdown.defaultRules.list, {
		// order: Number.POSITIVE_INFINITY,
		match: () => null
	}),

	heading: Object.assign({}, simpleMarkdown.defaultRules.heading, {
		// order: Number.POSITIVE_INFINITY,
		match: () => null
	}),

	spoiler: spoilerRule
});

const rawBuiltParser = simpleMarkdown.parserFor(rules);
const mdParse = function (source: string) {
	const blockSource = source + "\n\n";
	return rawBuiltParser(blockSource, { inline: false });
};

// Shorthand for the parser
// const mdParse = simpleMarkdown.defaultBlockParse;

/*****************************
 * Make the parsing function *
 *****************************/

/**
 * Parse Discord's Markdown format to Telegram-accepted HTML
 *
 * @param text The markdown string to convert
 * @param settings Telegram settings objcet
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
			} else if (node.type === "link") {
				return html + `<a href='${node.target}'>${extractText(node)}</a>`;
			}

			// Turn the nodes into HTML
			// Telegram doesn't support nested tags, so only apply tags to the outer nodes
			// Get the tag type of this node
			if (node.content === "|spoiler") node.type = "spoiler";

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
