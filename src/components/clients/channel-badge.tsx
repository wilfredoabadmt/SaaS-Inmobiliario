import { Instagram, MessageCircle, Pencil } from "lucide-react";
import type { Channel } from "@/lib/clients/types";
import { cn } from "@/lib/utils";

/**
 * Badge del canal de origen, superpuesto en la esquina del avatar de un contacto
 * (feature 009, US3/FR-012). WhatsApp hoy; Instagram/Messenger preparados; "manual" =
 * indicador neutro. El logo de WhatsApp va como SVG inline (lucide no trae logos de marca).
 */

const LABELS: Record<Channel, string> = {
  whatsapp: "Llegó por WhatsApp",
  instagram: "Llegó por Instagram",
  messenger: "Llegó por Messenger",
  manual: "Agregado manualmente",
};

function WhatsAppGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.073-.124-.271-.198-.569-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.437-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}

export function ChannelBadge({ channel, className }: { channel: Channel; className?: string }) {
  const base =
    "pointer-events-none absolute -bottom-1 -right-1 flex h-[15px] w-[15px] items-center justify-center rounded-full ring-2 ring-bg-panel";

  if (channel === "whatsapp")
    return (
      <span title={LABELS.whatsapp} className={cn(base, "bg-[#25D366] text-white", className)}>
        <WhatsAppGlyph size={9} />
      </span>
    );
  if (channel === "instagram")
    return (
      <span title={LABELS.instagram} className={cn(base, "bg-[#E1306C] text-white", className)}>
        <Instagram size={9} />
      </span>
    );
  if (channel === "messenger")
    return (
      <span title={LABELS.messenger} className={cn(base, "bg-[#0084FF] text-white", className)}>
        <MessageCircle size={9} />
      </span>
    );
  return (
    <span
      title={LABELS.manual}
      className={cn(base, "border border-border bg-bg-hover text-text-4", className)}
    >
      <Pencil size={8} />
    </span>
  );
}
