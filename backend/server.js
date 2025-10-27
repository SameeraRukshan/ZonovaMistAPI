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

// Handle OPTIONS preflight for all routes
app.options('*', cors(), (req, res) => {
  res.sendStatus(200);
});

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

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get("/", (req, res) => res.send("Backend is running 🚀"));

app.get('/invoice/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    const checkIn = new Date(booking.checkin_date).toLocaleDateString();
    const checkOut = new Date(booking.checkout_date).toLocaleDateString();
    const total = parseFloat(booking.total_price?.toString() || '0');
    const advance = parseFloat(booking.advance_amount?.toString() || '0');
    const food = parseFloat(booking.food?.toString() || '0');
    const balance = total - advance;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${booking.guest_name}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #2c3e50; }
          .section { margin: 20px 0; }
          .section h3 { background: #3498db; color: white; padding: 10px; margin: 0; }
          .details { padding: 15px; border: 1px solid #ddd; }
          .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
          .row:last-child { border-bottom: none; }
          .label { font-weight: bold; color: #555; }
          .total { background: #2ecc71; color: white; padding: 15px; text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px; }
          @media print { .no-print { display: none; } }
          .print-btn { background: #3498db; color: white; padding: 10px 20px; border: none; cursor: pointer; font-size: 16px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Zonova Mist Guest House</h1>
          <p>Invoice for Booking</p>
        </div>

        <div class="section">
          <h3>Guest Information</h3>
          <div class="details">
            <div class="row"><span class="label">Name:</span><span>${booking.guest_name}</span></div>
            <div class="row"><span class="label">NIC:</span><span>${booking.guest_nic}</span></div>
            <div class="row"><span class="label">Phone:</span><span>${booking.phone_no}</span></div>
            <div class="row"><span class="label">Address:</span><span>${booking.guest_address}</span></div>
          </div>
        </div>

        <div class="section">
          <h3>Booking Details</h3>
          <div class="details">
            <div class="row"><span class="label">Room No:</span><span>${booking.booked_room_no}</span></div>
            <div class="row"><span class="label">Check-in:</span><span>${checkIn}</span></div>
            <div class="row"><span class="label">Check-out:</span><span>${checkOut}</span></div>
            <div class="row"><span class="label">Adults:</span><span>${booking.adult_count}</span></div>
            <div class="row"><span class="label">Children:</span><span>${booking.child_count}</span></div>
          </div>
        </div>

        <div class="section">
          <h3>Payment Details</h3>
          <div class="details">
            <div class="row"><span class="label">Room Charges:</span><span>Rs. ${(total - food).toFixed(2)}</span></div>
            <div class="row"><span class="label">Food Charges:</span><span>Rs. ${food.toFixed(2)}</span></div>
            <div class="row"><span class="label">Total Amount:</span><span>Rs. ${total.toFixed(2)}</span></div>
            <div class="row"><span class="label">Advance Paid:</span><span>Rs. ${advance.toFixed(2)}</span></div>
            <div class="row"><span class="label">Balance Due:</span><span>Rs. ${balance.toFixed(2)}</span></div>
          </div>
        </div>

        ${booking.special_notes ? `
        <div class="section">
          <h3>Notes</h3>
          <div class="details">
            <p>${booking.special_notes}</p>
          </div>
        </div>
        ` : ''}

        <div class="total">
          Total Amount: Rs. ${total.toFixed(2)}
        </div>

        <button class="print-btn no-print" onclick="window.print()">Print Invoice</button>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice');
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
