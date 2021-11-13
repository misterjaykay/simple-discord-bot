module.exports = {
    name: "마니또",
    description: "시크릿 산타 & 마니또 같은부류의 게임",
    execute(message, args) {
        var user = message.author;
        console.log(user);
        // User {
        //     id: '234086876061892608',
        //     username: 'rikimaru',
        //     bot: false,
        //     discriminator: '7054',
        //     avatar: '270edc3dadf25f40cbe0b95145638543',
        //     flags: UserFlags { bitfield: 64 },
        //     lastMessageID: '908944046582542346',
        //     lastMessageChannelID: '639853557226668052'
        // }
    }
}