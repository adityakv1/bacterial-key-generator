const mongoose = require("mongoose");

const keySchema = new mongoose.Schema({
  filename: String,
  bitKey: String,
  hexKey: String,
  tests: Array,
  summary: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Key", keySchema);