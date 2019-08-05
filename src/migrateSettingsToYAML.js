"use strict";

/**************************
 * Import important stuff *
 **************************/

const fs = require("fs");
const jsYaml = require("js-yaml");

/**************************
 * The migration function *
 **************************/

function migrateSettingsToYAML(jsonPath, yamlPath) {
	try {
		// Read the file and parse it
		const settings = JSON.parse(fs.readFileSync(jsonPath));

		// Save it back as YAML
		fs.writeFileSync(yamlPath, jsYaml.safeDump(settings));

		// Remove settings.json
		fs.unlinkSync(jsonPath);
	} catch (err) {
		// Could not read it. Check if it exists
		if (err.code !== "ENOENT") {
			// It does exist, but can't be read... Pass on the error
			throw err;
		}
		// else it doesn't exist, and has probably already been migrated. Don't do anything
	}
}

/*************
 * Export it *
 *************/

module.exports = migrateSettingsToYAML;
