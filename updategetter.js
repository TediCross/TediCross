'use strict';

const EventEmitter = require('events').EventEmitter;

const updateGetter = function updateGetter(bot, timeout = 60) {
	const emitter = new EventEmitter();
	let stop = false;
	emitter.stop = () => stop = true;
	let offset = 0;

        const fetchUpdates = () => {
                bot.getUpdates(offset ? { timeout, offset } : { timeout })
                        .then(handleUpdates)
                        .catch(err => console.error(`${err.name}: ${err.message}`));
        };

	const handleUpdates = updates => {
		updates.forEach(update => {
			if (offset <= update.update_id)
				offset = update.update_id + 1;
			emitter.emit('update', update);
			if (!stop) setTimeout(fetchUpdates);
		});
	};

	fetchUpdates();
	return emitter;
};

module.exports = updateGetter;


