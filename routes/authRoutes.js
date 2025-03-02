const express = require("express");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const UsersCollection = require("../models/UsersCollection"); 
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const upload = require("../middleware/upload");
const router = express.Router();


const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, 
    port: process.env.SMTP_PORT, 
    secure: process.env.SMTP_PORT == 465, 
    auth: {
        user: process.env.SMTP_USER, 
        pass: process.env.SMTP_PASS, 
    },
});
transporter.verify((error, success) => {
    if (error) {
        console.error("❌ SMTP Connection Failed:", error);
    } else {
        console.log("✅ SMTP Server is Ready to Send Emails");
    }
});

// Helper function to send success response
const sendSuccessResponse = (res, msg, data = {}) => {
    res.status(200).json({ status: 1, msg, ...data });
};

// Helper function to send error response
const sendErrorResponse = (res, statusCode, msg) => {
    res.status(statusCode).json({ status: 2, msg });
};


// Signup Route
router.post("/signup", async (req, res) => {
    try {
        const { full_name, email, phone, password, photo } = req.body;

        let userCollection = await UsersCollection.findOne();
        if (!userCollection) {
            userCollection = new UsersCollection({ users: [] });
        }

        const existingUser = userCollection.users.find(
            (u) => u.email === email || u.phone === phone
        );
        if (existingUser) return sendErrorResponse(res, 400, "Email or phone already in use");

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            unique_id: uuidv4(),
            full_name,
            email,
            phone,
            password_hash: hashedPassword,
            photo: photo || "",
            session_active: true,
        };

        userCollection.users.push(newUser);
        await userCollection.save();

        req.session.user = {
            id: newUser.unique_id,
            full_name: newUser.full_name,
            email: newUser.email,
            phone: newUser.phone,
            photo: newUser.photo,
            role: newUser.role,
        };

        sendSuccessResponse(res, "Signup successful", { user: req.session.user });
    } catch (error) {
        console.error(error);
        sendErrorResponse(res, 500, "Server Error");
    }
})


// Login Route
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const userCollection = await UsersCollection.findOne();
        if (!userCollection) return sendErrorResponse(res, 404, "No users found");

        const user = userCollection.users.find((u) => u.email === email);
        if (!user) return sendErrorResponse(res, 400, "Invalid Credentials");

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return sendErrorResponse(res, 400, "Invalid Credentials");

        user.session_active = true;
        await userCollection.save();

        req.session.user = {
            id: user.unique_id,
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            photo: user.photo,
            role: user.role,
        };

        sendSuccessResponse(res, "Login successful", { user: req.session.user });
    } catch (error) {
        console.error("❌ Login Error:", error);
        sendErrorResponse(res, 500, "Server Error");
    }
});



// Update User Profile Route with Photo Upload
router.put("/update-profile", upload.single("photo"), async (req, res) => {
    try {
      const { email, full_name, phone } = req.body;
      if (!email) return sendErrorResponse(res, 400, "Email is required");
  
      const userCollection = await UsersCollection.findOne();
      if (!userCollection) return sendErrorResponse(res, 404, "No users found");
  
      const userIndex = userCollection.users.findIndex((u) => u.email === email);
      if (userIndex === -1) {
        return sendErrorResponse(res, 404, "User not found");
      }
  
      if (full_name) userCollection.users[userIndex].full_name = full_name;
      if (phone) userCollection.users[userIndex].phone = phone;
  
      // Handle photo upload
      if (req.file) {
        const photoUrl = `/uploads/${req.file.filename}`; // Generate the URL for the uploaded photo
        userCollection.users[userIndex].photo = photoUrl;
      }
  
      userCollection.users[userIndex].updated_at = new Date();
  
      await userCollection.save();
  
      const updatedUser = userCollection.users[userIndex];
      const responseUser = {
        id: updatedUser.unique_id,
        full_name: updatedUser.full_name,
        email: updatedUser.email,
        phone: updatedUser.phone,
        photo: updatedUser.photo,
        role: updatedUser.role,
      };
  
      sendSuccessResponse(res, "Profile updated successfully", { user: responseUser });
    } catch (error) {
      console.error("❌ Error updating profile:", error);
      sendErrorResponse(res, 500, "Server Error");
    }
  });

// Get all Users
router.get("/users", async (req, res) => {
    try {
        const userCollection = await UsersCollection.findOne();
        if (!userCollection || userCollection.users.length === 0) {
            return sendErrorResponse(res, 404, "No users found");
        }

        sendSuccessResponse(res, "Users fetched successfully", { users: userCollection.users });
    } catch (error) {
        console.error("❌ Error fetching users:", error);
        sendErrorResponse(res, 500, "Internal Server Error");
    }
});

// Logout Route
router.get("/logout/:userId", (req, res) => {
    const userId = req.params.userId;

    req.session.destroy((err) => {
        if (err) {
            return sendErrorResponse(res, 500, "Logout failed");
        }

        UsersCollection.findOneAndUpdate(
            { "users.unique_id": userId },
            { $set: { "users.$.session_active": false } },
            { new: true }
        )
        .then(() => {
            sendSuccessResponse(res, "Logout successful");
        })
        .catch((error) => {
            console.error("Error updating user session status:", error);
            sendErrorResponse(res, 500, "Logout successful, but failed to update session status");
        });
    });
})

router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return sendErrorResponse(res, 400, "Email is required");

    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return sendErrorResponse(res, 404, "No users found");

    const userIndex = userCollection.users.findIndex((u) => u.email === email);
    if (userIndex === -1) {
        return sendErrorResponse(res, 404, "No account found with this email");
    }

    const otp = Math.floor(100000 + Math.random() * 900000); 
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); 

    const mailOptions = {
        from: `"Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset OTP",
        html: `<p>Your OTP for password reset is: <strong>${otp}</strong></p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ OTP Sent Successfully:", otp);

        userCollection.users[userIndex].otp = otp;
        userCollection.users[userIndex].otpExpires = otpExpires;

        await userCollection.save();

        sendSuccessResponse(res, "OTP sent successfully");
    } catch (error) {
        console.error("❌ Error sending OTP:", error);
        sendErrorResponse(res, 500, "Error sending OTP");
    }
});

// ✅ Verify OTP before resetting password
router.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) return sendErrorResponse(res, 400, "Email and OTP are required");

    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return sendErrorResponse(res, 404, "No users found");

    const user = userCollection.users.find((u) => u.email === email);
    if (!user || user.otp !== otp) {
        return sendErrorResponse(res, 400, "Invalid OTP");
    }

    if (user.otpExpires < Date.now()) {
        return sendErrorResponse(res, 400, "OTP has expired");
    }

    sendSuccessResponse(res, "OTP verified successfully");
});

// ✅ Reset Password with OTP
router.post("/reset-password", async (req, res) => {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
        return sendErrorResponse(res, 400, "All fields are required");
    }

    const userCollection = await UsersCollection.findOne();
    if (!userCollection) return sendErrorResponse(res, 404, "No users found");

    const userIndex = userCollection.users.findIndex((u) => u.email === email);
    if (userIndex === -1) {
        return sendErrorResponse(res, 400, "Invalid OTP");
    }

    const user = userCollection.users[userIndex];

    if (user.otp !== otp) {
        return sendErrorResponse(res, 400, "Invalid OTP");
    }

    if (user.otpExpires < Date.now()) {
        return sendErrorResponse(res, 400, "OTP has expired");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    userCollection.users[userIndex].password_hash = hashedPassword;
    userCollection.users[userIndex].otp = null;
    userCollection.users[userIndex].otpExpires = null;

    await userCollection.save();

    const confirmationMailOptions = {
        from: `"Support" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Password Reset Successful",
        html: `<p>Your password has been successfully reset.</p>`,
    };

    try {
        await transporter.sendMail(confirmationMailOptions);
        console.log("✅ Password Reset Confirmation Sent");

        sendSuccessResponse(res, "Password reset successful");
    } catch (error) {
        console.error("❌ Error sending confirmation email:", error);
        sendErrorResponse(res, 500, "Password reset successful, but failed to send confirmation email");
    }
});



module.exports = router;
