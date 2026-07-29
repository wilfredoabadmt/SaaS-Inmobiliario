"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type FbLoginResponse = { authResponse?: { code?: string } | null };

interface FbSdk {
  init(params: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(cb: (resp: FbLoginResponse) => void, opts: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

interface Props {
  appId: string;
  configId: string;
  graphVersion: string;
}

/**
 * Lanza el Embedded Signup de Meta (FR-001). Captura el `code` + datos del número y
 * los envía a POST /api/whatsapp/connect (que cifra y guarda el token, FR-006).
 * Requiere la app de Meta real para completarse (pendiente de verificación humana).
 */
export function EmbeddedSignupButton({ appId, configId, graphVersion }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const sessionRef = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      try {
        const data = JSON.parse(typeof event.data === "string" ? event.data : "{}") as {
          type?: string;
          data?: { waba_id?: string; phone_number_id?: string };
        };
        if (data.type === "WA_EMBEDDED_SIGNUP" && data.data) {
          sessionRef.current = {
            wabaId: data.data.waba_id,
            phoneNumberId: data.data.phone_number_id,
          };
        }
      } catch {
        /* mensajes no-JSON: ignorar */
      }
    };
    window.addEventListener("message", onMessage);

    if (!window.FB) {
      window.fbAsyncInit = () => {
        window.FB?.init({ appId, autoLogAppEvents: true, xfbml: true, version: graphVersion });
      };
      const script = document.createElement("script");
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
    return () => window.removeEventListener("message", onMessage);
  }, [appId, graphVersion]);

  const connect = () => {
    if (!window.FB) {
      setStatus("El SDK de Meta aún no está disponible (requiere app real).");
      return;
    }
    window.FB.login(
      (resp) => {
        const code = resp.authResponse?.code;
        const { wabaId, phoneNumberId } = sessionRef.current;
        if (!code || !wabaId || !phoneNumberId) {
          setStatus("No se completó el Embedded Signup.");
          return;
        }
        setStatus("Conectando…");
        fetch("/api/whatsapp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, wabaId, phoneNumberId }),
        })
          .then((r) => r.json())
          .then((d: { status?: string; displayPhoneNumber?: string | null }) =>
            setStatus(
              d.status === "connected"
                ? `Conectado: ${d.displayPhoneNumber ?? ""}`
                : "No se pudo conectar.",
            ),
          )
          .catch(() => setStatus("Error de red al conectar."));
      },
      { config_id: configId, response_type: "code", override_default_response_type: true },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={connect}>Conectar WhatsApp</Button>
      {status && <p className="text-sm text-text-3">{status}</p>}
    </div>
  );
}
