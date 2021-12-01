const db = require("../models");

module.exports = {
    name: "소원",
    description: "시크릿 산타 & 마니또 내 선물 정보 입력",
    execute(message, args, client, mongoose) {
        const { id } = message.author;
        let sowon = "";
        for (let i = 0; i < args.length; i++) {
            const element = args[i] + " ";
            sowon += element;
        }

        db.Person.findOneAndUpdate(
            { userId: id },
            { $set: { santaGift: sowon} },
            { new: true }
        )
        .then(res => {
            console.log("Updated Sowon\n", sowon, `\n${res}`);
        })
        .catch(err => console.log(err))
    }
}