const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const birthdaySchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  birthday: {
    type: Date,
    // required: true,
  },
  mbti : {
    type: String,
    // required: true,
  },
  createdDate: {
    type: Date,
    default: Date.now,
  },
  // Guards the birthday points bonus (see birthday/birthdayPointsService.js)
  // against being paid out more than once in the same year.
  lastBirthdayPointsYear: {
    type: Number,
  },
});

const Birthday = mongoose.model("Birthday", birthdaySchema);

module.exports = Birthday;
