require("dotenv").config(); // ⬅️ මේක උඩම තියෙන්න ඕන

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

// middleware
app.use(cors());
app.use(bodyParser.json());

// DB connect
mongoose.connect(process.env.MONGO_URI) // ⬅️ MONGO_URI use කරන්න
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log("❌ MongoDB Error:", err));

// Routes
app.use("/api/expense", require("./backend/routes/expenseRoutes"));

app.get("/", (req, res) => {
  res.send("Zonova Mist API Running! 🚀");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));