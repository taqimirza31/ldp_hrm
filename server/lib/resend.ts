/**
 * Resend.com email sending. Used for recruitment application emails (two-way thread).
 * Set RESEND_API_KEY and RESEND_FROM (e.g. "Recruitment <careers@yourdomain.com>") in .env.
 * Verify your domain at https://resend.com/domains.
 */

import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let envLoaded = false;
function ensureEnv() {
  if (!envLoaded) {
    config({ path: path.resolve(__dirname, "../../.env") });
    envLoaded = true;
  }
}

export type SendEmailParams = {
  from?: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  /** Custom headers (e.g. Message-ID for reply threading). */
  headers?: Record<string, string>;
  /** Attachments: content as Buffer. Resend max 40MB per email. */
  attachments?: Array<{ filename: string; content: Buffer }>;
};

export type SendEmailResult = { ok: true; id: string } | { ok: false; message: string };

/**
 * Send an email via Resend. Uses RESEND_FROM if from is not provided.
 * Returns { ok: true, id } on success, { ok: false, message } on failure.
 * Reads env at call time so RESEND_API_KEY is available after dotenv loads.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  ensureEnv();
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  const fromAddress = (process.env.RESEND_FROM ?? "Recruitment <onboarding@resend.dev>").trim();
  if (!apiKey) {
    return { ok: false, message: "RESEND_API_KEY is not set" };
  }
  const resend = new Resend(apiKey);
  const from = params.from ?? fromAddress;
  const to = Array.isArray(params.to) ? params.to : [params.to];
  const html = params.html ?? (params.text ? params.text.replace(/\n/g, "<br>") : "<p></p>");
  const text = params.text ?? (params.html ? params.html.replace(/<[^>]+>/g, "").trim() : "");

  const payload = {
    from,
    to,
    subject: params.subject,
    html,
    text: text || undefined,
    cc: params.cc,
    bcc: params.bcc,
    replyTo: params.replyTo,
    headers: params.headers,
    ...(params.attachments && params.attachments.length > 0 && {
      attachments: params.attachments.map((a) => ({ filename: a.filename, content: a.content })),
    }),
  };
  const { data, error } = await resend.emails.send(payload);

  if (error) {
    return { ok: false, message: (error as { message?: string }).message ?? String(error) };
  }
  if (data?.id) {
    return { ok: true, id: data.id };
  }
  return { ok: false, message: "No response id from Resend" };
}

export function isResendConfigured(): boolean {
  ensureEnv();
  const apiKey = (process.env.RESEND_API_KEY ?? "").trim();
  return apiKey.length > 0;
}
