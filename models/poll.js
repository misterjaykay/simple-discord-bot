const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const pollSchema = new Schema({
  pollId: {
    type: String,
  },
  choices: [
    {
      id: Number,
      name: String,
      poll: {
        type: Number,
        default: 0,
      },
    },
  ],
  pollClosed: {
    type: Boolean,
    default: false,
    required: true,
  },
  createOn: {
    type: Date,
    default: Date.now,
  },
});

const Poll = mongoose.model("Poll", pollSchema);

module.exports = Poll;
