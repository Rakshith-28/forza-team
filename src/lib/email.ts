import { Resend } from "resend";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Email delivery.
 *
 * Mirrors the `StorageProvider` pattern (src/modules/files/storage.ts): a small
 * `EmailProvider` interface with provider implementations selected by env.
 *   • Dev / default: ConsoleEmailProvider — logs the message (incl. action link)
 *     so invite / password-reset flows work end-to-end locally without a vendor.
 *   • Production: ResendEmailProvider when RESEND_API_KEY is set.
 *
 * Sends are BEST-EFFORT: the invitation / reset DB record is already persisted
 * before we email, so a delivery failure is logged and reported via the returned
 * flag — it never throws and never corrupts the record.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  /** Plaintext fallback; also what gets logged by the console provider. */
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/** Dev fallback — prints the email (and its link) to the server console. */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage): Promise<void> {
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
  }
}

/** Production provider — delivers through Resend (fits the Vercel stack). */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  private client: Resend;
  constructor(apiKey: string) {
    this.client = new Resend(apiKey);
  }
  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: env.EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
    if (error) throw new Error(error.message);
  }
}

let provider: EmailProvider | null = null;
let warnedNoProvider = false;

/** The active email provider (memoized). Resend in prod, console fallback otherwise. */
export function getEmailProvider(): EmailProvider {
  if (provider) return provider;
  if (env.RESEND_API_KEY) {
    provider = new ResendEmailProvider(env.RESEND_API_KEY);
  } else {
    if (!warnedNoProvider) {
      logger.warn("RESEND_API_KEY not set — emails are logged to the console, not sent");
      warnedNoProvider = true;
    }
    provider = new ConsoleEmailProvider();
  }
  return provider;
}

/**
 * Best-effort send. Returns `{ delivered }` — never throws — so callers (invite,
 * reset) can proceed even if the provider fails. Failures are logged.
 */
export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  const p = getEmailProvider();
  try {
    await p.send(message);
    return { delivered: true };
  } catch (error) {
    logger.error("email send failed", {
      to: message.to,
      subject: message.subject,
      provider: p.name,
      error: error instanceof Error ? error.message : String(error),
    });
    return { delivered: false };
  }
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
