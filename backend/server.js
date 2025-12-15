// backend/server.js
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
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ✅ Serve static files (uploads folder)
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
app.use('/api/expense', require('./routes/expenseRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route with API documentation
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Zonova Mist API</title>
        <style>
          body { font-family: Arial; margin: 40px; }
          h1 { color: #2c3e50; }
          .endpoint { background: #ecf0f1; padding: 10px; margin: 10px 0; border-radius: 5px; }
          .method { font-weight: bold; color: #27ae60; }
        </style>
      </head>
      <body>
        <h1>🚀 Zonova Mist API - Running</h1>
        <h2>📋 Available Endpoints:</h2>
        
        <div class="endpoint">
          <span class="method">POST</span> /api/auth/login - Login
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> /api/bookings - Get all bookings
        </div>
        
        <div class="endpoint">
          <span class="method">POST</span> /api/expense - Create expense
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> /api/expense - Get all expenses
        </div>
        
        <div class="endpoint">
          <span class="method">GET</span> /api/expense/:id - Get single expense
        </div>
        
        <div class="endpoint">
          <span class="method">PUT</span> /api/expense/:id - Update expense
        </div>
        
        <div class="endpoint">
          <span class="method">DELETE</span> /api/expense/:id - Delete expense
        </div>
        
        <h3>📚 <a href="/api-docs">View Swagger Documentation</a></h3>
      </body>
    </html>
  `);
});

// Invoice route
app.get('/invoice/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    const checkIn = new Date(booking.checkin_date).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
    const checkOut = new Date(booking.checkout_date).toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });
    const nights = Math.ceil(
      (new Date(booking.checkout_date) - new Date(booking.checkin_date)) / (1000 * 60 * 60 * 24)
    );
    
    const totalPrice = parseFloat(booking.total_price?.toString() || '0');
    const advanceAmount = parseFloat(booking.advance_amount?.toString() || '0');
    const foodCharges = parseFloat(booking.food?.toString() || '0');
    const roomCharges = totalPrice - foodCharges;
    const balanceDue = totalPrice - advanceAmount;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${booking.booking_id}</title>
        <style>
          body { font-family: Arial; margin: 40px; }
          .invoice-box { max-width: 800px; margin: auto; padding: 30px; border: 1px solid #eee; }
          .invoice-header { text-align: center; margin-bottom: 30px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="invoice-header">
            <h1>INVOICE</h1>
            <p>Booking ID: ${booking.booking_id}</p>
          </div>
          <table>
            <tr><th>Guest Name:</th><td>${booking.guest_name}</td></tr>
            <tr><th>Check-in:</th><td>${checkIn}</td></tr>
            <tr><th>Check-out:</th><td>${checkOut}</td></tr>
            <tr><th>Nights:</th><td>${nights}</td></tr>
            <tr><th>Room Charges:</th><td>Rs. ${roomCharges.toFixed(2)}</td></tr>
            <tr><th>Food Charges:</th><td>Rs. ${foodCharges.toFixed(2)}</td></tr>
            <tr><th>Total:</th><td><strong>Rs. ${totalPrice.toFixed(2)}</strong></td></tr>
            <tr><th>Advance Paid:</th><td>Rs. ${advanceAmount.toFixed(2)}</td></tr>
            <tr><th>Balance Due:</th><td><strong>Rs. ${balanceDue.toFixed(2)}</strong></td></tr>
          </table>
        </div>
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

// Cron Job: daily check-in reminder at 8:00 AM
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

// ✅ Global error handler
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 API available at http://localhost:${PORT}/api`);
  console.log(`💾 Expense API: http://localhost:${PORT}/api/expense`);
});