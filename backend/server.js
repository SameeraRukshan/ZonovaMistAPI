const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const cron = require('node-cron');
const Booking = require('./models/booking'); 
const { sendReminderSMS } = require('./models/smsService');
const { swaggerUi, swaggerSpec } = require("./swagger");
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

dotenv.config();
connectDB();

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ CORS setup: allow all origins, handle preflight
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options('*', cors(), (req, res) => res.sendStatus(200));

// ✅ Body parser
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ✅ Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/hotels', require('./routes/hotelRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/images', require('./routes/imageRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));

// ✅ New Expense Route
app.use("/api/expense", require("./routes/expenseRoutes"));

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get("/", (req, res) => res.send("Backend is running 🚀"));

// Invoice route (unchanged)
app.get('/invoice/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    const checkIn = new Date(booking.checkin_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const checkOut = new Date(booking.checkout_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const nights = Math.ceil((new Date(booking.checkout_date) - new Date(booking.checkin_date)) / (1000 * 60 * 60 * 24));
    
    const totalPrice = parseFloat(booking.total_price?.toString() || '0');
    const advanceAmount = parseFloat(booking.advance_amount?.toString() || '0');
    const foodCharges = parseFloat(booking.food?.toString() || '0');
    const roomCharges = totalPrice - foodCharges;
    const balanceDue = totalPrice - advanceAmount;

    res.send(`... HTML invoice code remains unchanged ...`);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send(`... HTML error page ...`);
  }
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket connected');

  ws.on('message', (msg) => {
    console.log(`📩 Received: ${msg}`);
    ws.send(`Echo: ${msg}`);
  });

  ws.on('close', () => console.log('❌ WebSocket closed'));
});

// Cron Job: daily check-in reminder
cron.schedule('0 8 * * *', async () => {
  console.log('⏰ Running daily check-in reminder job...');
  const today = new Date().toISOString().split('T')[0];
  try {
    const bookings = await Booking.find({ checkInDate: today });
    console.log(`Found ${bookings.length} bookings for today.`);
    for (const booking of bookings) {
      await sendReminderSMS(
        booking.clientPhone,
        booking.clientName,
        booking.roomNo,
        new Date(booking.checkInDate)
      );
    }
  } catch (err) {
    console.error('Error in reminder job:', err.message);
  }
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// Include any additional jobs
require('./jobs/reminderJob');
