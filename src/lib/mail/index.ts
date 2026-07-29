import nodemailer, { type Transporter } from "nodemailer";
import { getEnv, isEmailConfigured } from "@/lib/env";

/**
 * Frontera de email saliente (feature 011, US3). SMTP (Gmail + App Password) vía nodemailer,
 * remitente único temporal. Envío BEST-EFFORT: `sendMail` nunca lanza y devuelve `false` si el
 * email no está configurado o el envío falla — el agendado nunca se cae por email (FR-017).
 * NUNCA se loguea `SMTP_PASS` (Principio I).
 */

let transporter: Transporter | null = null;

function getTransport(): Transporter | null {
  if (!isEmailConfigured()) return null;
  if (transporter) return transporter;
  const env = getEnv();
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Envía un email. Devuelve `true` si se envió, `false` si está OFF o falló (sin lanzar). */
export async function sendMail(input: MailInput): Promise<boolean> {
  const tx = getTransport();
  if (!tx) return false;
  const env = getEnv();
  const from = env.SMTP_FROM || env.SMTP_USER;
  try {
    await tx.sendMail({
      from: `"${env.MAIL_FROM_NAME}" <${from}>`,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return true;
  } catch (e) {
    console.error("[mail] envío fallido:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
