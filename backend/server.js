const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const connectDB = require('./config/db');


dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Route mounting
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const roomsRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomsRoutes);

app.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
