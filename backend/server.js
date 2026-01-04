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
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/staff', require('./routes/staffRoutes')); 
app.use('/api/todos', require('./routes/todoRoutes'));

// Swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Root route
app.get("/", (req, res) => res.send("Backend is running 🚀"));

// Invoice route
app.get('/invoice/:bookingId', async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).send('Booking not found');

    const checkIn = new Date(booking.checkin_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const checkOut = new Date(booking.checkout_date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculate number of nights
    const checkInDate = new Date(booking.checkin_date);
    const checkOutDate = new Date(booking.checkout_date);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

    // Parse values safely
    const totalPrice = parseFloat(booking.total_price?.toString() || '0');
    const advanceAmount = parseFloat(booking.advance_amount?.toString() || '0');
    const foodCharges = parseFloat(booking.food?.toString() || '0');
    
    // Calculate room charges (total - food)
    const roomCharges = totalPrice - foodCharges;
    
    // Calculate balance
    const balanceDue = totalPrice - advanceAmount;

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${booking.guest_name}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            max-width: 900px; 
            margin: 20px auto; 
            padding: 20px;
            background: #f5f5f5;
          }
          .invoice-container {
            background: white;
            padding: 40px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header { 
            text-align: center; 
            border-bottom: 3px solid #2c3e50; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
          }
          .header h1 { 
            margin: 0; 
            color: #2c3e50; 
            font-size: 32px;
            margin-bottom: 5px;
          }
          .header .subtitle {
            color: #7f8c8d;
            font-size: 18px;
          }
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 5px;
          }
          .invoice-info div {
            font-size: 14px;
          }
          .invoice-info strong {
            color: #2c3e50;
          }
          .section { 
            margin: 25px 0; 
          }
          .section h3 { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 12px 15px; 
            margin: 0 0 15px 0;
            border-radius: 5px;
            font-size: 18px;
          }
          .details { 
            padding: 20px; 
            border: 2px solid #ecf0f1;
            border-radius: 5px;
            background: #fafafa;
          }
          .row { 
            display: flex; 
            justify-content: space-between; 
            padding: 12px 0; 
            border-bottom: 1px solid #e0e0e0; 
          }
          .row:last-child { 
            border-bottom: none; 
          }
          .label { 
            font-weight: 600; 
            color: #555;
            font-size: 15px;
          }
          .value {
            color: #2c3e50;
            font-size: 15px;
          }
          .charges-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          .charges-table th {
            background: #34495e;
            color: white;
            padding: 12px;
            text-align: left;
            font-size: 14px;
          }
          .charges-table td {
            padding: 12px;
            border-bottom: 1px solid #ecf0f1;
            font-size: 15px;
          }
          .charges-table tr:hover {
            background: #f8f9fa;
          }
          .charges-table .amount {
            text-align: right;
            font-weight: 600;
          }
          .total-section {
            margin-top: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            font-size: 16px;
          }
          .total-row.grand-total {
            border-top: 2px solid rgba(255,255,255,0.3);
            margin-top: 10px;
            padding-top: 15px;
            font-size: 22px;
            font-weight: bold;
          }
          .balance-due {
            background: ${balanceDue > 0 ? '#e74c3c' : '#27ae60'};
            padding: 20px;
            margin-top: 20px;
            text-align: center;
            border-radius: 8px;
            color: white;
          }
          .balance-due h2 {
            margin: 0 0 10px 0;
            font-size: 18px;
            opacity: 0.9;
          }
          .balance-due .amount {
            font-size: 32px;
            font-weight: bold;
          }
          .notes-section {
            background: #fff9e6;
            border-left: 4px solid #f39c12;
            padding: 15px;
            margin-top: 20px;
            border-radius: 4px;
          }
          .notes-section h4 {
            color: #e67e22;
            margin-bottom: 8px;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ecf0f1;
            color: #7f8c8d;
            font-size: 14px;
          }
          .print-btn { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
            padding: 12px 30px; 
            border: none; 
            cursor: pointer; 
            font-size: 16px; 
            margin: 20px auto;
            display: block;
            border-radius: 5px;
            transition: transform 0.2s;
          }
          .print-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
          }
          @media print { 
            .no-print { display: none; }
            body { background: white; }
            .invoice-container { box-shadow: none; }
          }
          @media (max-width: 600px) {
            body { padding: 10px; }
            .invoice-container { padding: 20px; }
            .invoice-info { flex-direction: column; gap: 10px; }
            .header h1 { font-size: 24px; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <h1>Zonova Mist Guest House</h1>
            <p class="subtitle">Tax Invoice</p>
          </div>

          <div class="invoice-info">
            <div>
              <strong>Invoice No:</strong> INV-${booking._id.toString().slice(-8).toUpperCase()}
            </div>
            <div>
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>

          <div class="section">
            <h3>Guest Information</h3>
            <div class="details">
              <div class="row">
                <span class="label">Name:</span>
                <span class="value">${booking.guest_name}</span>
              </div>
              <div class="row">
                <span class="label">NIC:</span>
                <span class="value">${booking.guest_nic}</span>
              </div>
              <div class="row">
                <span class="label">Phone:</span>
                <span class="value">${booking.phone_no}</span>
              </div>
              <div class="row">
                <span class="label">Address:</span>
                <span class="value">${booking.guest_address}</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Booking Details</h3>
            <div class="details">
              <div class="row">
                <span class="label">Room No:</span>
                <span class="value">${booking.booked_room_no}</span>
              </div>
              <div class="row">
                <span class="label">Check-in:</span>
                <span class="value">${checkIn}</span>
              </div>
              <div class="row">
                <span class="label">Check-out:</span>
                <span class="value">${checkOut}</span>
              </div>
              <div class="row">
                <span class="label">Number of Nights:</span>
                <span class="value">${nights} ${nights === 1 ? 'Night' : 'Nights'}</span>
              </div>
              <div class="row">
                <span class="label">Guests:</span>
                <span class="value">${booking.adult_count} Adult(s), ${booking.child_count} Child(ren)</span>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Charges Breakdown</h3>
            <table class="charges-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Details</th>
                  <th class="amount">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Room Charges</td>
                  <td>${nights} ${nights === 1 ? 'Night' : 'Nights'} - Room ${booking.booked_room_no}</td>
                  <td class="amount">${roomCharges.toFixed(2)}</td>
                </tr>
                ${foodCharges > 0 ? `
                <tr>
                  <td>Food & Beverages</td>
                  <td>Additional charges</td>
                  <td class="amount">${foodCharges.toFixed(2)}</td>
                </tr>
                ` : ''}
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>Rs. ${totalPrice.toFixed(2)}</span>
            </div>
            <div class="total-row">
              <span>Advance Paid:</span>
              <span>- Rs. ${advanceAmount.toFixed(2)}</span>
            </div>
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>Rs. ${totalPrice.toFixed(2)}</span>
            </div>
          </div>

          ${balanceDue !== 0 ? `
          <div class="balance-due">
            <h2>${balanceDue > 0 ? 'Balance Due' : 'Overpaid Amount'}</h2>
            <div class="amount">Rs. ${Math.abs(balanceDue).toFixed(2)}</div>
          </div>
          ` : `
          <div class="balance-due">
            <h2>✓ Fully Paid</h2>
            <div class="amount">Rs. 0.00</div>
          </div>
          `}

          ${booking.special_notes ? `
          <div class="notes-section">
            <h4>Special Notes</h4>
            <p>${booking.special_notes}</p>
          </div>
          ` : ''}

          <div class="footer">
            <p><strong>Thank you for choosing Zonova Mist Guest House!</strong></p>
            <p style="margin-top: 10px;">For inquiries, please contact us at the number provided above.</p>
          </div>

          <button class="print-btn no-print" onclick="window.print()">
            🖨️ Print / Save as PDF
          </button>
        </div>

        <script>
          // Auto-focus for print dialog on mobile
          if (window.matchMedia('(max-width: 768px)').matches) {
            document.querySelector('.print-btn').addEventListener('click', function() {
              setTimeout(() => window.print(), 100);
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .error { color: #e74c3c; font-size: 18px; }
        </style>
      </head>
      <body>
        <h1>⚠️ Error</h1>
        <p class="error">Unable to generate invoice. Please try again later.</p>
        <p style="color: #7f8c8d; margin-top: 20px;">${error.message}</p>
      </body>
      </html>
    `);
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
console.log('⏰ Initializing cron jobs...');
require('./jobs/discountJob');
require('./jobs/reminderJob');
console.log('✅ Cron jobs initialized');