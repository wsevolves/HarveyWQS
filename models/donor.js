
const mongoose = require("mongoose");

const donorSchema = new mongoose.Schema({
  user_unique_id:{ type: String, required: true },
  name: { type: String, required: true },
  number: { type: String, required: true },
  email: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  paymentMethod: { type: String, required: true },
  paymentRefId: { type: String, required: true },
  paymentDate: { type: Date, default: Date.now },
  status: { type: String, default: "pending" },
});

module.exports = mongoose.model("Donor", donorSchema);