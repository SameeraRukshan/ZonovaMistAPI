// backend/controllers/contactController.js
// Public contact endpoint: delivers inquiries as WhatsApp messages via the
// self-hosted OpenWA gateway (behind Cloudflare Access).
//
// Secrets are read ONLY from environment variables:
//   OPENWA_API_KEY, OPENWA_CF_CLIENT_ID, OPENWA_CF_CLIENT_SECRET
// They must never be committed, logged, or sent to the browser.

const OPENWA_BASE_URL = 'https://openwa.zonova.lk';
const OPENWA_SESSION_ID = 'e4165710-7c95-4e07-a830-ef65b7d08ca2';
const CONTACT_CHAT_ID = '94710433228@c.us';
const SITE_LABEL = 'Zonova Mist';

// POST /api/contact  (public — no auth)
exports.sendContact = async (req, res) => {
  const data = req.body || {};

  // Honeypot: silently drop spam without sending.
  if (data.botcheck) {
    return res.status(200).json({ ok: true });
  }

  const name = (data.name ?? '').toString().trim();
  const email = (data.email ?? '').toString().trim();
  const phone = (data.phone ?? '').toString().trim();
  const message = (data.message ?? '').toString().trim();

  // Validation
  if (name.length < 2) {
    return res.status(400).json({ ok: false, error: 'Please enter your name.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (message.length < 10) {
    return res.status(400).json({ ok: false, error: 'Please tell us a bit more about your project.' });
  }
  if (name.length > 200 || email.length > 200 || phone.length > 50 || message.length > 3000) {
    return res.status(400).json({ ok: false, error: 'One of the fields is too long.' });
  }

  // Credentials from environment.
  const apiKey = process.env.OPENWA_API_KEY;
  const cfId = process.env.OPENWA_CF_CLIENT_ID;
  const cfSecret = process.env.OPENWA_CF_CLIENT_SECRET;
  if (!apiKey || !cfId || !cfSecret) {
    console.error('contact: missing OpenWA credentials in environment');
    return res.status(500).json({
      ok: false,
      error: 'Server is not configured yet. Please contact us on WhatsApp.',
    });
  }

  const text = [
    `🆕 New inquiry — ${SITE_LABEL}`,
    '',
    `👤 Name: ${name}`,
    `📧 Email: ${email}`,
    `📞 Phone: ${phone || '—'}`,
    '',
    '💬 Message:',
    message,
  ].join('\n');

  try {
    const response = await fetch(
      `${OPENWA_BASE_URL}/api/sessions/${OPENWA_SESSION_ID}/messages/send-text`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
          'CF-Access-Client-Id': cfId,
          'CF-Access-Client-Secret': cfSecret,
        },
        body: JSON.stringify({ chatId: CONTACT_CHAT_ID, text }),
        // First send after idle can take ~15-20s; allow 45s.
        signal: AbortSignal.timeout(45000),
      },
    );

    if (response.status === 201 || response.ok) {
      return res.status(200).json({ ok: true });
    }

    // Log status/body only — never the request headers (they contain secrets).
    const bodyText = await response.text().catch(() => '');
    console.error('contact: OpenWA responded', response.status, bodyText);
    return res.status(502).json({
      ok: false,
      error: 'Could not deliver your message. Please try WhatsApp instead.',
    });
  } catch (err) {
    console.error('contact: OpenWA request failed', err && err.message ? err.message : err);
    return res.status(502).json({
      ok: false,
      error: 'Could not deliver your message. Please try WhatsApp instead.',
    });
  }
};
