"use strict";

/**
 * Function which does 'console.log' to its arguments if its 'doDebug' property is true
 */
function debug() {
	if (debug.doDebug) {
		console.log.apply(console, arguments);
	}
}

/**
 * If true, the debug function will log its arguments
 */
debug.doDebug = false;

// Export the debug function
module.exports = debug;
