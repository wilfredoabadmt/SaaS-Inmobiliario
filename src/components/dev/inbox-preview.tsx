"use client";

import { InboxClient } from "@/components/inbox/inbox-client";
import {
  SAMPLE_CONVERSATIONS,
  SAMPLE_MESSAGES,
  SAMPLE_TEMPLATES,
} from "@/lib/design/sample-data";

/**
 * Preview dev-only de la bandeja con datos mock (sin DB ni auth). Showcase completo
 * del matching en vivo usando los fixtures. El riel lo aporta el layout de /dev-preview.
 */
export function InboxPreview() {
  return (
    <InboxClient
      conversations={SAMPLE_CONVERSATIONS}
      templates={SAMPLE_TEMPLATES}
      previewMessagesByConv={SAMPLE_MESSAGES}
    />
  );
}
