const express = require("express");
const stripe = require("../config/stripe");
const Donor = require("../models/donor");
const router = express.Router();

// Payment Route with Stripe Checkout Page
router.post("/create-payment", async (req, res) => {
  try {
    console.log("🔹 Incoming Payment Request:", req.body);

    const { user_unique_id, name, number, email, category, amount, paymentMethod } = req.body;

    // Validate required fields
    if (!user_unique_id || !name || !number || !email || !category || !amount || !paymentMethod) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Allowed payment methods for Stripe Checkout
    const validMethods = [
      "card", "klarna", "link", "cashapp", "amazon_pay", "paypal",
      "google_pay", "apple_pay", "afterpay"
    ];
    if (!validMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid or unsupported payment method" });
    }

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: [paymentMethod],
      mode: "payment",
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: category },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      }],
      success_url: `http://127.0.0.1:5500/public/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `http://localhost:5000/api/cancel`,
      metadata: { user_unique_id, name, number, email, category, amount, paymentMethod },
    });

    console.log("✅ Stripe Checkout Session Created:", session.id);
    res.json({ sessionId: session.id, checkoutUrl: session.url });
  } catch (error) {
    console.error("❌ Error Creating Checkout Session:", error);
    res.status(500).json({ error: "Failed to create payment session", details: error.message });
  }
});

// Route to Confirm Payment and Save Donor (Only If session_id is Unique)
router.post("/confirm-payment", async (req, res) => {
  try {
    const { session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "Session ID is required" });

    const existingDonor = await Donor.findOne({ paymentRefId: session_id });
    if (existingDonor) {
      return res.status(409).json({ error: "Payment session already processed" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    // Retrieve payment details safely
    const paymentIntent = session.payment_intent
      ? await stripe.paymentIntents.retrieve(session.payment_intent)
      : null;
    const charge = paymentIntent?.latest_charge
      ? await stripe.charges.retrieve(paymentIntent.latest_charge)
      : null;
    const receiptUrl = charge?.receipt_url || "";

    // Save donor details in MongoDB
    const metadata = session.metadata || {};
    const newDonor = new Donor({
      user_unique_id: metadata.user_unique_id,
      name: metadata.name,
      number: metadata.number,
      email: metadata.email,
      category: metadata.category,
      amount: parseFloat(metadata.amount) || session.amount_total / 100,
      paymentMethod: metadata.paymentMethod || session.payment_method_types?.[0] || "unknown",
      paymentRefId: session.payment_intent || session.id,
      paymentDate: new Date(),
      status: "success",
      receiptUrl,
    });

    await newDonor.save();
    console.log("✅ Donor Details Saved:", newDonor);
    res.json({ success: true, message: "Donor details saved successfully", donor: newDonor });
  } catch (error) {
    console.error("❌ Error Confirming Payment and Saving Donor:", error);
    res.status(500).json({ error: "Failed to confirm payment and save donor", details: error.message });
  }
});

// Get Donor Details by Session ID
router.get("/get-donators", async (req, res) => {
  try {
    const { session_id } = req.query;

    if (session_id) {
      const donor = await Donor.findOne({ paymentRefId: session_id });
      if (!donor) {
        return res.status(404).json({ status: 2, error: "Donor not found", msg: "No donor found with the provided session ID" });
      }
      return res.status(200).json({ status: 1, success: true, donor, msg: "Donor details fetched successfully" });
    }

    // Fetch all donors if no session_id is provided
    const allDonors = await Donor.find().sort({ paymentDate: -1 });
    res.status(200).json({ status: 1, success: true, allDonors, msg: "All donor details fetched successfully" });
  } catch (error) {
    console.error("❌ Error fetching donor details:", error);
    res.status(500).json({ status: 2, error: "Failed to fetch donor details", msg: "Internal server error", details: error.message });
  }
});

// Get Donor Details by user_unique_id
router.get("/get-donations-by-user", async (req, res) => {
  try {
    const { user_unique_id } = req.query;

    if (!user_unique_id) {
      return res.status(400).json({ status: 2, error: "user_unique_id is required", msg: "Please provide a valid user_unique_id" });
    }

    // Fetch all donations for the given user_unique_id
    const donations = await Donor.find({ user_unique_id }).sort({ paymentDate: -1 });
    if (!donations || donations.length === 0) {
      return res.status(404).json({ status: 2, error: "No donations found for this user", msg: "No donations found for the provided user_unique_id" });
    }

    res.status(200).json({ status: 1, success: true, donations, msg: "Donations fetched successfully" });
  } catch (error) {
    console.error("❌ Error fetching donations by user_unique_id:", error);
    res.status(500).json({ status: 2, error: "Failed to fetch donations", msg: "Internal server error", details: error.message });
  }
});

module.exports = router;