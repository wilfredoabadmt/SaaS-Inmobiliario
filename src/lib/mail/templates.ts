/**
 * Plantillas de email al asesor (feature 011, US3). HTML simple + texto plano. Ver
 * specs/011-visit-scheduling/contracts/api.md.
 */

export type MailKind = "confirmation" | "reschedule" | "cancellation" | "reminder";

export interface ShowingMailData {
  kind: MailKind;
  clientName: string;
  propertyTitle: string;
  /** Fecha/hora legible en la timezone del asesor. */
  whenLabel: string;
  /** Deep-link a la conversación en la bandeja (o null). */
  inboxUrl: string | null;
}

const HEADLINE: Record<MailKind, string> = {
  confirmation: "Nueva visita agendada",
  reschedule: "Visita reprogramada",
  cancellation: "Visita cancelada",
  reminder: "Recordatorio: visita en 1 hora",
};

export function renderShowingMail(d: ShowingMailData): {
  subject: string;
  html: string;
  text: string;
} {
  const headline = HEADLINE[d.kind];
  const subject =
    d.kind === "reminder"
      ? `⏰ ${headline} — ${d.clientName}`
      : `${headline} — ${d.clientName} · ${d.whenLabel}`;

  const lines = [
    `${headline}.`,
    `Cliente: ${d.clientName}`,
    `Propiedad: ${d.propertyTitle}`,
    `Cuándo: ${d.whenLabel}`,
  ];
  if (d.inboxUrl) lines.push(`Abrir conversación: ${d.inboxUrl}`);
  const text = lines.join("\n");

  const button = d.inboxUrl
    ? `<p style="margin:20px 0"><a href="${d.inboxUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">Abrir en la bandeja</a></p>`
    : "";
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <h2 style="font-size:18px;margin:0 0 12px">${headline}</h2>
    <table style="font-size:14px;line-height:1.6;border-collapse:collapse">
      <tr><td style="color:#64748b;padding-right:12px">Cliente</td><td><strong>${d.clientName}</strong></td></tr>
      <tr><td style="color:#64748b;padding-right:12px">Propiedad</td><td>${d.propertyTitle}</td></tr>
      <tr><td style="color:#64748b;padding-right:12px">Cuándo</td><td>${d.whenLabel}</td></tr>
    </table>
    ${button}
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Homya · gestión de visitas</p>
  </div>`;

  return { subject, html, text };
}

/**
 * Email de invitación a un equipo (feature 013, US4). Best-effort: si el envío falla, el owner
 * obtiene igualmente el `acceptUrl` para compartir manualmente (FR-020).
 */
export interface InvitationMailData {
  agencyName: string;
  inviterName: string;
  /** Rol legible al que se invita ("dueño" / "agente"). */
  roleLabel: string;
  acceptUrl: string;
}

export function renderInvitationMail(d: InvitationMailData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${d.inviterName} te invitó a ${d.agencyName} en Homya`;
  const text = [
    `${d.inviterName} te invitó a unirte a ${d.agencyName} como ${d.roleLabel} en Homya.`,
    ``,
    `Acepta la invitación aquí:`,
    d.acceptUrl,
  ].join("\n");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <h2 style="font-size:18px;margin:0 0 12px">Te invitaron a ${d.agencyName}</h2>
    <p style="font-size:14px;line-height:1.6;margin:0 0 4px">
      <strong>${d.inviterName}</strong> te invitó a unirte a <strong>${d.agencyName}</strong>
      como <strong>${d.roleLabel}</strong> en Homya.
    </p>
    <p style="margin:20px 0">
      <a href="${d.acceptUrl}" style="background:#0f172a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-size:14px">Aceptar invitación</a>
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:8px">
      Si el botón no funciona, copia y pega este enlace:<br />${d.acceptUrl}
    </p>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Homya · gestión inmobiliaria</p>
  </div>`;

  return { subject, html, text };
}
