module.exports = {
	name: 'join-voice',
	description: 'Join Voice Channel with Command',
	execute(message, args) {
        console.log("working");
        const VCchannel = message.guild.channels.cache.find(channel => channel.name === 'voice');

        message.member.voice.setChannel(VCchannel).catch(err => console.log(err));
        if (message.author.bot) return;
        client.on('message', message => {
            if (message.author.bot) return;
        
            if (message.content == 'password') {
                message.delete();
                const VCchannel = message.guild.channels.cache.find(channel => channel.name === 'The Grind 3');
                message.member.voice.setChannel(VCchannel).catch(err => console.log(err));
            }
        })
	},
};