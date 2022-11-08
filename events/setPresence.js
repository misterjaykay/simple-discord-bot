const { Events, ActivityType } = require('discord.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
        // ActivityType: Competing, Listening, Playing, Streaming, Watching
        client.user.setPresence({
            activities: [{ name: `새 명령어 개발중...`, type: ActivityType.Playing }], 
            status: 'online',
        });
	},
};