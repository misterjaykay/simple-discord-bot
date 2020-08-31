module.exports = {
	name: 'goodbye',
	description: '잘가',
	execute(message, args) {
		message.channel.send('안녕히가세요.');
	},
};