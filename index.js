const express = require("express");
const app = express();
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");

// middleware
app.use(cors());
app.use(bodyParser.json());

// DB connect
mongoose.connect("mongodb://localhost:27017/zonova_mist")
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

// Routes
app.use("/api/expense", require("./backend/routes/expenseRoutes"));

app.get("/", (req, res) => {
  res.send("Zonova Mist API Running!");
});

// Start server
app.listen(5000, () => console.log("Server running on port 5000"));
