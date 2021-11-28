const db = require("../models");

// Returns a random integer from 0 to 9:
// Math.floor(Math.random() * 10);

module.exports = {
  // name of command
  name: "마니또시작",
  cooldown: 5,
  guildOnly: true,
  description: "마니또 상대 섞는 커맨드(한번만 사용할것)",
  execute(message, args) {
    db.Person.find({})
      .then((res) => {
        // console.log(res, "found");
        var allUserId = []; // array of user ids
        for (let h = 0; h < res.length; h++) {
          allUserId.push(res[h].userId);
        }
        // console.log(allUserId);

        for (let i = 0; i < res.length; i++) {
          const filter = allUserId.filter(e => e != res[i].userId);
          // console.log("filtered", filter);
          const index = Math.floor(Math.random() * filter.length);
          const userId = res[i].userId;
          const santaId = filter[index];
          // console.log("USER ID", userId, "SANTA ID", santaId);

          // if (i != index) {
          if (userId != santaId) {
            db.Person.findOneAndUpdate(
              { userId: userId },
              { $set: { santaId: santaId } },
              { new: true }
            ) 
              .then((res) => console.log("Updated", res.userId, res.santaId))
              .catch((res) => console.log("Update Failed", res));
            }
          
          const santaIdNumber = (e) => e == santaId;
          const findId = allUserId.findIndex(santaIdNumber);
          // console.log(findId);

          allUserId.splice(findId, 1);
  
          // save
          // if (userId != santaId) {

          // filter out user id
        }
      })
      .catch((err) => console.log(err));
  },
};
