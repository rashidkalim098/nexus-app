import nodemailer from "nodemailer";

const isMailConfigured = !!(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS
);

let transporter = null;
if (isMailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const PURPOSE_COPY = {
  verify: {
    subject: "Verify your NEXUS account",
    heading: "Confirm your email",
    body: "Enter this code in NEXUS to finish creating your account.",
  },
  login: {
    subject: "Your NEXUS sign-in code",
    heading: "Sign-in verification",
    body: "Enter this code to finish signing in to NEXUS.",
  },
  reset: {
    subject: "Reset your NEXUS password",
    heading: "Reset your password",
    body: "Enter this code in NEXUS to set a new password.",
  },
};

function otpEmailHtml(code, purpose) {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.verify;
  return `
  <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;background:#0E0E14;border-radius:16px;color:#F0EFF8;">
    <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;margin-bottom:24px;">
      <span style="background:linear-gradient(135deg,#7B6EF6,#E2608A);-webkit-background-clip:text;background-clip:text;color:transparent;">NEXUS</span>
    </div>
    <h1 style="font-size:18px;margin:0 0 8px;">${copy.heading}</h1>
    <p style="font-size:13px;color:#9B98B8;margin:0 0 24px;">${copy.body}</p>
    <div style="background:#1E1E2A;border-radius:12px;padding:20px;text-align:center;letter-spacing:8px;font-size:32px;font-weight:800;color:#F0EFF8;margin-bottom:20px;">
      ${code}
    </div>
    <p style="font-size:12px;color:#5A5875;margin:0;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
  </div>`;
}

/**
 * Sends the OTP email. Returns { sent: boolean, debugCode?: string }.
 * If SMTP isn't configured, it logs the code to the server console instead
 * of throwing, so the app is still usable while you're setting email up.
 */
export async function sendOtpEmail(to, code, purpose = "verify") {
  const copy = PURPOSE_COPY[purpose] || PURPOSE_COPY.verify;

  if (!transporter) {
    console.log(
      `\n[DEV MODE — no SMTP configured] OTP for ${to} (${purpose}): ${code}\n` +
        `Set SMTP_HOST / SMTP_USER / SMTP_PASS in server/.env to send real emails.\n`
    );
    return { sent: false };
  }

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: copy.subject,
    html: otpEmailHtml(code, purpose),
  });
  return { sent: true };
}

export const mailDebugEnabled = String(process.env.MAIL_DEBUG || "false") === "true";
