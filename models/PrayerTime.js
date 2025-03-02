const mongoose = require("mongoose");

const PrayerSchema = new mongoose.Schema({
  month: { type: String, required: true },
  year: { type: String, required: true },
  days: [
    {
      date: { type: String, required: true },
      day: { type: String, required: true }, 
      Fajr: { azanTime: { type: String, required: true }, salatTime: { type: String, required: true } },
      Dhuhr: { azanTime: { type: String, required: true }, salatTime: { type: String, required: true } },
      Asr: { azanTime: { type: String, required: true }, salatTime: { type: String, required: true } },
      Maghrib: { azanTime: { type: String, required: true }, salatTime: { type: String, required: true } },
      Isha: { azanTime: { type: String, required: true }, salatTime: { type: String, required: true } },
      Jumma: { azanTime: { type: String }, salatTime: { type: String } }, // Optional for Jumma
    },
  ],
});

module.exports = mongoose.model("PrayerTime", PrayerSchema);