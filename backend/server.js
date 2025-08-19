const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser'); // or just express.json()
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase body size limit for images

const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Route mounting
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

const roomsRoutes = require('./routes/roomRoutes');
app.use('/api/rooms', roomsRoutes);

const bookingRoutes = require('./routes/bookingRoutes');
app.use('/api/bookings', bookingRoutes);

const userRoutes = require('./routes/userRoutes');
app.use('/api/users', userRoutes);

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profile', profileRoutes);

// Mount the new image routes
const imageRoutes = require('./routes/imageRoutes');
app.use('/api/images', imageRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});