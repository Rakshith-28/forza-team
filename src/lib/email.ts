import { Resend } from "resend";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Email transport.
 *
 * Sends via Resend when RESEND_API_KEY is set; otherwise degrades gracefully —
 * the message (including any action link) is logged to the console so invite /
 * password-reset flows work end-to-end in local dev without an email provider.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plaintext fallback; also what gets logged in dev. */
  text: string;
}

let resendClient: Resend | null = null;
let warnedNoProvider = false;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(env.RESEND_API_KEY);
  return resendClient;
}

export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  const resend = getResend();

  if (!resend) {
    if (!warnedNoProvider) {
      logger.warn("RESEND_API_KEY not set — emails are logged to the console, not sent");
      warnedNoProvider = true;
    }
    // eslint-disable-next-line no-console -- intentional dev fallback so links are visible
    console.log(
      [
        "",
        "──────────── EMAIL (dev fallback, not sent) ────────────",
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        "",
        message.text,
        "────────────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { delivered: false };
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    logger.error("email send failed", { to: message.to, subject: message.subject, error });
    throw new Error(`Failed to send email: ${error.message}`);
  }
  return { delivered: true };
}

function layout(heading: string, bodyHtml: string, cta: { url: string; label: string }): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#171717">
  <h2>${heading}</h2>
  ${bodyHtml}
  <p style="margin:24px 0">
    <a href="${cta.url}" style="background:#2f6d3b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta.label}</a>
  </p>
  <p style="color:#666;font-size:13px">If the button doesn't work, paste this link into your browser:<br>${cta.url}</p>
  </body></html>`;
}

/** Password-reset email (called from Better Auth's sendResetPassword). */
export function passwordResetEmail(params: { url: string }): { subject: string; html: string; text: string } {
  const subject = "Reset your Forza Team password";
  return {
    subject,
    html: layout(
      "Reset your password",
      "<p>We received a request to reset your Forza Team password. This link expires shortly.</p>",
      { url: params.url, label: "Reset password" },
    ),
    text: `Reset your Forza Team password:\n${params.url}\n\nIf you didn't request this, you can ignore this email.`,
  };
}

/** Invitation email (called from the invitation service). */
export function invitationEmail(params: {
  url: string;
  clubName: string;
  roleLabel: string;
}): { subject: string; html: string; text: string } {
  const subject = `You're invited to ${params.clubName} on Forza Team`;
  return {
    subject,
    html: layout(
      `Join ${params.clubName}`,
      `<p>You've been invited to ${params.clubName} as <strong>${params.roleLabel}</strong>. Accept to set up your account.</p>`,
      { url: params.url, label: "Accept invitation" },
    ),
    text: `You've been invited to ${params.clubName} as ${params.roleLabel}.\nAccept your invitation:\n${params.url}`,
  };
}
