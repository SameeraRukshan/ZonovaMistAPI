const { sendInvoiceSMS } = require('../models/smsService');

exports.sendInvoiceNotification = async (req, res) => {
  try {
    const { phone, name, total, invoiceUrl } = req.body;
    const response = await sendInvoiceSMS(phone, name, total, invoiceUrl);
    res.json({ success: true, response });
  } catch (error) {
    console.error('Error sending invoice SMS:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};
