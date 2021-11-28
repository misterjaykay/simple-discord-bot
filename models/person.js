const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const personSchema = new Schema({
  userId: {
    type: String,
    required: true,
  },
  userName: {
    type: String,
    required: true,
  },
  userMessage: {
    type: String,
    required: true,
  },
  santaId: {
    type: String,
  },
  santaMessage: {
    type: String,
  },
  santaGift: {
    type: String,
  },
  userApplyDate: {
    type: Date,
    default: Date.now,
  }
});

const Person = mongoose.model("Person", personSchema);

module.exports = Person;
