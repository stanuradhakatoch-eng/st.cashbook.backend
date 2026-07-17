const nodemailer = require('nodemailer');

// ── Startup diagnostics ──
console.log('[EMAIL-CONFIG] ──────────────────────────────────────');
console.log('[EMAIL-CONFIG] SMTP_HOST:  ', process.env.SMTP_HOST || '(not set — default smtp.gmail.com)');
console.log('[EMAIL-CONFIG] SMTP_PORT:  ', process.env.SMTP_PORT || '(not set — default 587)');
console.log('[EMAIL-CONFIG] SMTP_USER:  ', process.env.SMTP_USER ? `SET (${process.env.SMTP_USER})` : '❌ NOT SET');
console.log('[EMAIL-CONFIG] SMTP_PASS:  ', process.env.SMTP_PASS ? 'SET (****)' : '❌ NOT SET');
console.log('[EMAIL-CONFIG] SMTP_FROM:  ', process.env.SMTP_FROM || process.env.SMTP_USER || '(not set)');
console.log('[EMAIL-CONFIG] NODE_ENV:   ', process.env.NODE_ENV || '(not set)');
console.log('[EMAIL-CONFIG] ──────────────────────────────────────');

// ── Nodemailer SMTP Transporter ───────────────────────
// Sab kuch env vars se configure hota hai:
//   SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM
// Gmail → host smtp.gmail.com, port 587, App Password
// Kisi bhi transactional SMTP provider ke host/port/credentials yahan set kar sakte ho.
const SMTP_PORT   = parseInt(process.env.SMTP_PORT, 10) || 587;
const SMTP_SECURE = process.env.SMTP_SECURE
  ? process.env.SMTP_SECURE === 'true'
  : SMTP_PORT === 465; // 465 = implicit TLS, 587/2525 = STARTTLS

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
    // Timeout ke bina, agar port block ho to request hamesha "pending" reh jaati hai.
    connectionTimeout: 10000, // TCP connect
    greetingTimeout: 10000,   // server greeting
    socketTimeout: 15000,     // inactivity
  });
  return transporter;
}

// ── Connection verify on startup (best-effort) ─────────
async function verifyConnection() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('❌ Email not configured — set SMTP_USER + SMTP_PASS (aur SMTP_HOST/PORT).');
    return;
  }
  try {
    await getTransporter().verify();
    console.log('✅ Nodemailer SMTP email service ready.');
  } catch (err) {
    console.warn('⚠️  SMTP verify failed:', err.message);
    if (/ENETUNREACH|ETIMEDOUT|Connection timeout|EDNS|ESOCKET/i.test(err.message)) {
      console.warn('   🚫 SMTP port shayad is server par block hai (jaise Render free tier SMTP block karta hai).');
      console.warn('   💡 Aisa ho to alag SMTP host/port try karein (kai providers port 2525 offer karte hain).');
    }
  }
}

// ── Professional OTP Email Template ───────────────────
function buildOtpHtml({ otp, recipient, expiryMins = 5 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Your CashBook OTP</title>
</head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#2563EB 0%,#1D4ED8 100%);padding:28px 40px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:rgba(255,255,255,0.2);border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                    <span style="color:#FFFFFF;font-size:18px;font-weight:900;line-height:36px;">C</span>
                  </td>
                  <td style="padding-left:10px;vertical-align:middle;">
                    <span style="color:#FFFFFF;font-size:20px;font-weight:800;letter-spacing:1px;">CASHBOOK</span>
                  </td>
                </tr>
              </table>
              <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:8px 0 0;letter-spacing:0.3px;">
                Business Expense Management
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">

              <h2 style="font-size:22px;font-weight:700;color:#111827;margin:0 0 10px;">
                Your Login OTP
              </h2>
              <p style="font-size:14px;color:#6B7280;margin:0 0 28px;line-height:1.6;">
                Hi <strong style="color:#374151;">${recipient}</strong>,<br/>
                Please use the OTP below to verify your identity and login to CashBook.
              </p>

              <!-- OTP Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:#EFF6FF;border:2px dashed #93C5FD;border-radius:14px;padding:22px 48px;">
                      <p style="font-size:11px;color:#6B7280;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">
                        One-Time Password
                      </p>
                      <p style="font-size:40px;font-weight:900;color:#2563EB;letter-spacing:14px;margin:0;font-family:'Courier New',monospace;">
                        ${otp}
                      </p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Expiry info -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                <tr>
                  <td style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:14px 18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:18px;vertical-align:top;padding-right:10px;">&#9201;</td>
                        <td style="font-size:13px;color:#92400E;line-height:1.6;">
                          <strong>Valid for ${expiryMins} minutes only.</strong><br/>
                          Please do not share this OTP with anyone.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Security warning -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:14px 18px;">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:18px;vertical-align:top;padding-right:10px;">&#128737;</td>
                        <td style="font-size:13px;color:#991B1B;line-height:1.6;">
                          <strong>Security Alert:</strong> CashBook kabhi bhi aapka OTP phone, email ya
                          WhatsApp pe nahi maangega. Kisi ke saath share mat karo.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 24px;"/>

              <p style="font-size:13px;color:#9CA3AF;margin:0;line-height:1.6;">
                Agar aapne login request nahi ki thi, toh is email ko ignore karein.
                Aapka account safe hai.<br/><br/>
                Need help?
                <a href="mailto:support@cashbook.in" style="color:#2563EB;text-decoration:none;">support@cashbook.in</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#F9FAFB;border-top:1px solid #E5E7EB;padding:20px 40px;text-align:center;">
              <p style="font-size:12px;color:#9CA3AF;margin:0 0 6px;">
                &copy; 2024 CashBook &mdash; Powered by OBOPAY
              </p>
              <p style="font-size:11px;color:#D1D5DB;margin:0;">
                <a href="#" style="color:#D1D5DB;text-decoration:none;">Privacy Policy</a> &nbsp;&bull;&nbsp;
                <a href="#" style="color:#D1D5DB;text-decoration:none;">Terms of Service</a>
              </p>
            </td>
          </tr>

        </table>

        <p style="font-size:11px;color:#9CA3AF;margin:16px 0 0;text-align:center;">
          This is an automated email. Please do not reply.
        </p>
      </td>
    </tr>
  </table>

</body>
</html>
  `.trim();
}

function buildOtpText({ otp, recipient, expiryMins = 5 }) {
  return `CashBook - Login OTP\n\nHi ${recipient},\n\nYour OTP: ${otp}\n\nValid for ${expiryMins} minutes. Do NOT share this OTP.\n\n-- CashBook Team`.trim();
}

// ── Main send function (Nodemailer only) ───────────────
async function sendOtpEmail({ to, otp }) {
  console.log(`[EMAIL] ── Sending OTP to: ${to} via SMTP (${process.env.SMTP_HOST || 'smtp.gmail.com'}:${SMTP_PORT}) ──`);

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('Email not configured — SMTP_USER / SMTP_PASS missing.');
  }

  const recipient = to;
  const subject   = `${otp} is your CashBook OTP — valid for 5 minutes`;
  const text      = buildOtpText({ otp, recipient });
  const html      = buildOtpHtml({ otp, recipient });

  try {
    const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
    const info = await getTransporter().sendMail({
      from: `"CashBook" <${fromAddr}>`,
      to,
      subject,
      text,
      html,
      replyTo: fromAddr,
      // Deliverability hints — spam-score thoda kam karte hain
      headers: {
        'X-Entity-Ref-ID': `otp-${Date.now()}`,
        'X-Auto-Response-Suppress': 'All',
      },
    });
    console.log(`[EMAIL] ✅ OTP sent via Nodemailer to ${to} | MessageId: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`[EMAIL] ❌ SMTP send failed:`, err.message);
    if (/ENETUNREACH|ETIMEDOUT|Connection timeout|EDNS|ESOCKET/i.test(err.message)) {
      console.error(`[EMAIL] 🚫 SMTP port shayad is server par block hai (Render free tier SMTP block karta hai).`);
      console.error(`[EMAIL] 💡 Alag SMTP host/port try karein (kai providers port 2525 offer karte hain).`);
    }
    throw err;
  }
}

module.exports = { sendOtpEmail, verifyConnection };
