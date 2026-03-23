import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM =
  process.env.EMAIL_FROM || "App <noreply@example.com>";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const APP_NAME = process.env.APP_NAME || "App";
const BRAND = process.env.APP_BRAND_COLOR || "#2563eb";
const SUPPORT_EMAIL =
  EMAIL_FROM.match(/<(.+)>/)?.[1] ?? "support@example.com";

export const resend =
  RESEND_API_KEY && RESEND_API_KEY !== "re_xxxxxxxxxxxx"
    ? new Resend(RESEND_API_KEY)
    : null;

export const isEmailConfigured = resend !== null;

const FONT =
  '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
const S = {
  text: `font-family:${FONT};`,
  h2: `margin:0;font-family:${FONT};font-size:24px;font-weight:700;color:#111;line-height:1.3;`,
  p: `margin:0;font-family:${FONT};font-size:15px;color:#555;line-height:1.6;`,
} as const;

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${APP_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
    ${body}
  </table>
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin-top:16px;">
<tr><td style="padding:20px 40px;text-align:center;">
  <p style="${S.text}font-size:13px;color:#888;margin:0;">Questions? <a href="mailto:${SUPPORT_EMAIL}" style="color:${BRAND};text-decoration:none;">${SUPPORT_EMAIL}</a></p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function brandBar(): string {
  return `<tr><td style="background:${BRAND};padding:28px 40px;text-align:center;">
  <span style="${S.text}font-size:18px;font-weight:700;color:#fff;">${APP_NAME}</span>
</td></tr>`;
}

function heading(title: string, subtitle?: string): string {
  return `<tr><td style="padding:36px 40px 20px;text-align:center;">
  <h2 style="${S.h2}">${title}</h2>
  ${subtitle ? `<p style="${S.p}margin-top:10px;">${subtitle}</p>` : ""}
</td></tr>`;
}

function cta(text: string, url: string): string {
  return `<tr><td style="padding:8px 40px 36px;text-align:center;">
  <a href="${url}" target="_blank" style="display:inline-block;background:${BRAND};color:#fff;${S.text}font-size:15px;font-weight:600;padding:14px 36px;text-decoration:none;border-radius:8px;">${text}</a>
</td></tr>`;
}

function note(html: string): string {
  return `<tr><td style="padding:8px 40px 16px;">
  <p style="${S.p}">${html}</p>
</td></tr>`;
}

function verificationEmailHtml(url: string): string {
  return layout(
    [
      brandBar(),
      heading(
        "Verify your email",
        "Confirm your email address to finish setting up your account.",
      ),
      cta("Verify email", url),
      note(
        `If the button does not work, copy and paste this link:<br><a href="${url}" style="color:${BRAND};word-break:break-all;font-size:13px;">${url}</a>`,
      ),
      `<tr><td style="padding:0 40px 32px;">
        <p style="${S.text}font-size:12px;color:#999;margin:0;">If you did not sign up, you can ignore this email.</p>
      </td></tr>`,
    ].join(""),
  );
}

function passwordResetHtml(url: string): string {
  return layout(
    [
      brandBar(),
      heading("Reset your password", "Use the link below to choose a new password."),
      cta("Reset password", url),
      note(
        `If the button does not work, copy and paste this link:<br><a href="${url}" style="color:${BRAND};word-break:break-all;font-size:13px;">${url}</a>`,
      ),
      `<tr><td style="padding:0 40px 32px;">
        <p style="${S.text}font-size:12px;color:#999;margin:0;">If you did not request this, you can ignore this email.</p>
      </td></tr>`,
    ].join(""),
  );
}

async function send(to: string, subject: string, html: string): Promise<void> {
  if (!resend) {
    console.warn(`[email] Resend not configured; skipping "${subject}" to ${to}`);
    return;
  }
  await resend.emails.send({ from: EMAIL_FROM, to, subject, html });
}

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  await send(email, `Verify your ${APP_NAME} account`, verificationEmailHtml(url));
}

export async function sendPasswordResetEmail(email: string, url: string): Promise<void> {
  await send(email, `Reset your ${APP_NAME} password`, passwordResetHtml(url));
}

export { FRONTEND_URL };
