import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({
	baseDirectory: dirname(fileURLToPath(import.meta.url)),
	recommendedConfig: js.configs.recommended
});

export default compat.config({
	root: true,
	env: {
		es6: true,
		jest: true,
		node: true
	},
	parser: "@typescript-eslint/parser",
	extends: ["eslint:recommended", "plugin:prettier/recommended"],
	parserOptions: {
		ecmaVersion: 2020,
		sourceType: "script"
	},
	plugins: ["prettier"],
	rules: {
		"no-var": "error",
		"prefer-const": "warn",
		eqeqeq: "error",
		"class-methods-use-this": "warn",
		"prettier/prettier": "error",
		"no-eval": "error",
		"no-multi-spaces": "error"
	}
}).map(config => ({ files: ["**/*.ts"], ...config }));
