const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const http = require("http");
const connectDB = require("./config/db");
const setupSocket = require("./socket");
const categoryRoutes = require("./routes/categoryRoutes");
const path = require("path");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
const io = setupSocket(server);

app.use(
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:5500"],
    credentials: true,
  })
);

app.use(bodyParser.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);
app.use("/api", donorRoutes);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/payments", require("./routes/paymentRoutes"));
app.use("/api/prayer", require("./routes/prayerRoutes"));
app.use("/api/category", categoryRoutes(io));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
