const express = require("express");
const PrayerTime = require("../models/PrayerTime"); // Ensure this path is correct
const router = express.Router();
// Helper function to send success response
const sendSuccessResponse = (res, msg, data = {}) => {
  res.status(200).json({ status: 1, msg, ...data });
};

// Helper function to send error response
const sendErrorResponse = (res, statusCode, msg) => {
  res.status(statusCode).json({ status: 2, msg });
};


// Get all prayers
router.get("/get", async (req, res) => {
  try {
    const prayers = await PrayerTime.find();
    sendSuccessResponse(res, "Prayers fetched successfully", { prayers });
  } catch (err) {
    console.error("Error fetching prayers:", err);
    sendErrorResponse(res, 500, "Server error. Try again later.");
  }
});

// Add or update prayer times for a month
router.post("/addPrayerTime", async (req, res) => {
  try {
    const { month, year, days } = req.body;
    console.log("Request Body:", req.body);

    let existingRecord = await PrayerTime.findOne({ month, year });

    if (existingRecord) {
      const existingDates = existingRecord.days.map(day => day.date);

      const newDays = days.filter(day => !existingDates.includes(day.date));

      if (newDays.length === 0) {
        return sendErrorResponse(res, 400, "All dates already exist for this month.");
      }

      existingRecord.days.push(...newDays);
      await existingRecord.save();
      console.log("Updated Record:", existingRecord);
      return sendSuccessResponse(res, "New prayer times added successfully.", { data: existingRecord });
    } else {
      const newRecord = new PrayerTime({ month, year, days });
      await newRecord.save();

      return sendSuccessResponse(res, "Prayer times added successfully.", { data: newRecord });
    }
  } catch (error) {
    console.error("Error adding/updating prayer times:", error);
    sendErrorResponse(res, 500, "Server error. Failed to add/update prayer times.");
  }
});

// Update a specific prayer time for a date
router.put("/updatePrayerTime", async (req, res) => {
  try {
    const { month, year, date, updatedTimes } = req.body;

    let existingRecord = await PrayerTime.findOne({ month, year });

    if (!existingRecord) {
      return sendErrorResponse(res, 404, "No prayer times found for this month.");
    }

    let dayEntry = existingRecord.days.find(day => day.date === date);

    if (!dayEntry) {
      return sendErrorResponse(res, 404, `No prayer times found for date ${date}.`);
    }

    Object.keys(updatedTimes).forEach(prayer => {
      if (dayEntry[prayer]) {
        dayEntry[prayer] = updatedTimes[prayer];
      }
    });

    // Save the updated document
    await existingRecord.save();

    return sendSuccessResponse(res, "Prayer time updated successfully.", { data: existingRecord });
  } catch (error) {
    console.error("Error updating prayer time:", error);
    sendErrorResponse(res, 500, "Server error. Failed to update prayer time.");
  }
});

// Get prayer times for a specific month and year
router.get("/getPrayerTimes", async (req, res) => {
  try {
    const { month, year } = req.query;

    const prayerTimes = await PrayerTime.findOne({ month, year });

    if (!prayerTimes) {
      return sendErrorResponse(res, 404, "No prayer times found for this month.");
    }

    return sendSuccessResponse(res, "Prayer times fetched successfully.", { data: prayerTimes });
  } catch (error) {
    console.error("Error fetching prayer times:", error);
    sendErrorResponse(res, 500, "Server error. Failed to fetch prayer times.");
  }
});

// Delete a prayer
router.delete("/:id", async (req, res) => {
  try {
    const deletedPrayer = await PrayerTime.findByIdAndDelete(req.params.id);
    if (!deletedPrayer) return sendErrorResponse(res, 404, "Prayer not found");

    return sendSuccessResponse(res, "Prayer deleted successfully.");
  } catch (err) {
    console.error("Error deleting prayer:", err);
    sendErrorResponse(res, 500, "Server error. Failed to delete prayer.");
  }
});

module.exports = router;