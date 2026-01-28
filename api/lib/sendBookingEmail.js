import nodemailer from "nodemailer";
import { transporterConfig } from "./transporterConfig.js";

// --- Helpers ---

/**
 * Formats currency (e.g., "$100.00" or "100 EGP")
 */
function formatMoney(amount, currency = "USD") {
  const n = Number(amount || 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
    }).format(n);
  } catch (e) {
    return `${n.toFixed(2)} ${currency}`;
  }
}

/**
 * Formats date string (e.g., "Mon, Oct 25, 2023")
 */
function formatDate(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Email Builder ---

function buildBookingEmailHtml({ booking, customer, items, totals }) {
  // 1. Data Preparation
  const customerName =
    customer?.name ||
    [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") ||
    "Valued Guest";

  const branchName = booking?.branch_name || booking?.branch || "Main Branch";
  const bookingDate = formatDate(booking?.date);
  const bookingId = booking?.id ? `#${booking.id}` : "—";
  const notes = booking?.notes ? escapeHtml(booking.notes) : null;

  // Financials
  const currency = totals?.currency || items?.[0]?.currency || "USD";
  const grandTotal = formatMoney(totals?.grand_total, currency);

  // 2. Build Rows (With Prices)
  const rows = (items || [])
    .map((it) => {
      const service = escapeHtml(it.service_name || it.service || "Service");
      const qty = Number(it.quantity || 1);
      
      // Calculate prices
      const unitPrice = formatMoney(it.unit_price, it.currency || currency);
      // Use provided total or calculate it
      const rawTotal = it.item_total !== undefined ? it.item_total : (it.unit_price * qty);
      const lineTotal = formatMoney(rawTotal, it.currency || currency);

      return `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
            <div style="font-weight:600;color:#1f2937;font-size:14px;">${service}</div>
          </td>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;text-align:center;color:#6b7280;font-size:14px;">${qty}</td>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#6b7280;font-size:14px;">${unitPrice}</td>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;text-align:right;color:#1f2937;font-weight:700;font-size:14px;">${lineTotal}</td>
        </tr>
      `;
    })
    .join("");

  // 3. HTML Template
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Request Received</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f9fafb;font-family:'Helvetica Neue', Helvetica, Arial, sans-serif;-webkit-font-smoothing:antialiased;">
    
    <div style="width:100%;background-color:#f9fafb;padding:40px 0;">
      <div style="max-width:640px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <div style="background:linear-gradient(to right, #7c3aed, #6d28d9);padding:32px 40px;text-align:center;">
          <h1 style="margin:0;color:#ffffff;font-size:26px;letter-spacing:0.5px;font-weight:800;">JOYA SPA</h1>
          <p style="margin:6px 0 0;color:#e9d5ff;font-size:13px;text-transform:uppercase;letter-spacing:2px;font-weight:600;">Booking Request Details</p>
        </div>

        <div style="padding:40px 40px 30px;">
          
          <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:700;">Hi ${escapeHtml(customerName)},</h2>
          
          <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">
            We have received your request. Below are the details and estimated costs.
          </p>

          <div style="background-color:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:4px;margin-bottom:24px;">
            <div style="display:flex;align-items:start;">
              <div>
                <strong style="display:block;color:#1e40af;font-size:13px;margin-bottom:4px;text-transform:uppercase;">Next Step</strong>
                <div style="color:#1e3a8a;font-size:14px;line-height:1.5;">
                  This is a booking request. <strong>Our reservation team will contact you shortly</strong> to confirm the exact time and finalize your appointment.
                </div>
              </div>
            </div>
          </div>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;background-color:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb;">
            <tr>
              <td width="33%" style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
                <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">Date</div>
                <div style="font-size:14px;color:#111827;font-weight:700;">${bookingDate}</div>
              </td>
              <td width="34%" style="padding:16px;text-align:center;border-right:1px solid #e5e7eb;">
                <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">Branch</div>
                <div style="font-size:14px;color:#111827;font-weight:700;">${escapeHtml(branchName)}</div>
              </td>
              <td width="33%" style="padding:16px;text-align:center;">
                <div style="font-size:11px;text-transform:uppercase;color:#6b7280;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">Reference</div>
                <div style="font-size:14px;color:#111827;font-weight:700;">${bookingId}</div>
              </td>
            </tr>
          </table>

          <div style="margin-bottom:20px;">
            <div style="font-size:12px;font-weight:700;text-transform:uppercase;color:#9ca3af;border-bottom:2px solid #f3f4f6;padding-bottom:8px;margin-bottom:8px;">
              Requested Services
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <thead>
                <tr>
                  <th style="text-align:left;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;">ITEM</th>
                  <th style="text-align:center;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;">QTY</th>
                  <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;">UNIT PRICE</th>
                  <th style="text-align:right;font-size:11px;color:#9ca3af;font-weight:600;padding-bottom:8px;">TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="4" style="padding:15px 0;text-align:center;color:#9ca3af;">No services listed</td></tr>'}
              </tbody>
            </table>
          </div>

          <div style="background-color:#f9fafb;border-radius:8px;padding:16px 20px;margin-top:10px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="left" valign="middle">
                  <span style="font-size:13px;color:#6b7280;font-weight:500;">Grand Total</span>
                </td>
                <td align="right" valign="middle">
                  <span style="font-size:20px;color:#7c3aed;font-weight:800;">${grandTotal}</span>
                </td>
              </tr>
            </table>
          </div>

          ${
            notes
              ? `
            <div style="margin-top:24px;background-color:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:15px;">
              <strong style="display:block;font-size:12px;color:#b45309;margin-bottom:4px;">Your Notes:</strong>
              <span style="font-size:14px;color:#92400e;line-height:1.4;">${notes}</span>
            </div>
            `
              : ""
          }

        </div>

        <div style="background-color:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
            Questions? Reply to this email.<br>
            © ${new Date().getFullYear()} Joya Spa.
          </p>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
}

export function sendBookingEmail(payload) {
  const recipientEmail = payload?.customer?.email;
  
  if (!recipientEmail) {
    console.error("Missing customer email");
    return Promise.reject(new Error("Missing customer email"));
  }

  const transporter = nodemailer.createTransport(transporterConfig());

  const mailOptions = {
    from: `"Joya Spa" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "We received your booking request - Joya Spa",
    html: buildBookingEmailHtml(payload),
  };

  return transporter.sendMail(mailOptions);
}