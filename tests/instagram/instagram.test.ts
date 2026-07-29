import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

/**
 * Self-test de la lógica VERIFICABLE de Instagram (feature 008) sin actor externo ni
 * cuentas reales de Meta: firma del proxy de media, `state` OAuth, ventana de 24 h, caption
 * determinista, firma de webhook y validación Zod. Lo live (OAuth real, publicar, DM/comentario
 * real, render) lo verifica el dueño — ver quickstart.md (pendiente de verificación humana).
 */

// Env mínimo válido para que getEnv() pase (se lee de forma perezosa dentro de las funciones).
Object.assign(process.env, {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  BETTER_AUTH_SECRET: "x".repeat(16),
  BETTER_AUTH_URL: "http://localhost:3000",
  APP_BASE_URL: "https://inmox-dev.example.com",
  ENCRYPTION_KEY: Buffer.alloc(32).toString("base64"),
  META_APP_ID: "meta_app",
  META_APP_SECRET: "meta_secret",
  META_CONFIG_ID: "cfg",
  META_SYSTEM_USER_TOKEN: "sut",
  META_SOLUTION_PARTNER_ID: "spi",
  META_WEBHOOK_VERIFY_TOKEN: "wvt",
  META_GRAPH_API_VERSION: "v21.0",
  S3_ENDPOINT: "https://s3.example.com",
  S3_REGION: "auto",
  S3_BUCKET: "bucket",
  S3_ACCESS_KEY_ID: "key",
  S3_SECRET_ACCESS_KEY: "secret",
  IG_APP_ID: "ig_app",
  IG_APP_SECRET: "ig_secret_test",
  IG_REDIRECT_URI: "https://inmox-dev.example.com/api/instagram/callback",
  IG_WEBHOOK_VERIFY_TOKEN: "ig_verify",
  IG_GRAPH_VERSION: "v25.0",
  MEDIA_PROXY_SIGNING_SECRET: "media_secret_test",
  CRON_SECRET: "cron_secret",
});

import { verifyIgWebhookSignature } from "@/lib/instagram";
import {
  buildPublicImageUrl,
  signMediaToken,
  verifyMediaToken,
} from "@/lib/instagram/media-token";
import { publishSchema } from "@/lib/instagram/schemas";
import { signState, verifyState } from "@/server/instagram/oauth";
import { isWithinWindow } from "@/server/instagram/messaging";
import { captionFromProperty } from "@/server/instagram/publish";

const nowSec = () => Math.floor(Date.now() / 1000);

describe("media proxy token (DV-IG-4)", () => {
  const key = "instagram/org_123/abc.jpg";

  it("acepta un token válido y no expirado", () => {
    const exp = nowSec() + 3600;
    expect(verifyMediaToken(key, exp, signMediaToken(key, exp))).toBe(true);
  });

  it("rechaza un token manipulado", () => {
    const exp = nowSec() + 3600;
    expect(verifyMediaToken(key, exp, signMediaToken(key, exp) + "00")).toBe(false);
  });

  it("rechaza un token para otra key", () => {
    const exp = nowSec() + 3600;
    expect(verifyMediaToken("instagram/org_123/otra.jpg", exp, signMediaToken(key, exp))).toBe(
      false,
    );
  });

  it("rechaza un token expirado", () => {
    const exp = nowSec() - 10;
    expect(verifyMediaToken(key, exp, signMediaToken(key, exp))).toBe(false);
  });

  it("buildPublicImageUrl arma una URL absoluta con exp y token", () => {
    const url = buildPublicImageUrl(key);
    expect(url).toContain("https://inmox-dev.example.com/api/public/media/");
    expect(url).toMatch(/exp=\d+/);
    expect(url).toMatch(/token=[a-f0-9]+/);
  });
});

describe("OAuth state anti-CSRF (DV-IG-2)", () => {
  it("firma y verifica devolviendo la agencia", () => {
    const state = signState("org_abc");
    expect(verifyState(state)).toEqual({ organizationId: "org_abc" });
  });

  it("rechaza un state manipulado", () => {
    const state = signState("org_abc");
    expect(verifyState(state + "x")).toBeNull();
  });

  it("rechaza un state expirado", () => {
    const state = signState("org_abc", -10);
    expect(verifyState(state)).toBeNull();
  });

  it("rechaza basura", () => {
    expect(verifyState("no-es-un-state")).toBeNull();
  });
});

describe("ventana de 24 h (FR-020)", () => {
  const now = new Date("2026-06-23T12:00:00Z");

  it("sin mensaje entrante previo → fuera de ventana", () => {
    expect(isWithinWindow(null, now)).toBe(false);
  });

  it("hace 23 h → dentro", () => {
    expect(isWithinWindow(new Date("2026-06-22T13:00:00Z"), now)).toBe(true);
  });

  it("hace 25 h → fuera", () => {
    expect(isWithinWindow(new Date("2026-06-22T11:00:00Z"), now)).toBe(false);
  });

  it("exactamente 24 h → dentro (límite inclusivo)", () => {
    expect(isWithinWindow(new Date("2026-06-22T12:00:00Z"), now)).toBe(true);
  });
});

describe("caption desde propiedad (DV-IG-5, determinista)", () => {
  const prop = {
    operationType: "venta",
    propertyType: "casa",
    title: "Casa en Polanco",
    price: "2500000",
    currency: "MXN",
    neighborhood: "Polanco",
    city: "CDMX",
    bedrooms: 3,
    bathrooms: "2.5",
    builtAreaM2: "120",
  } as unknown as Parameters<typeof captionFromProperty>[0];

  it("incluye título, operación, precio y ubicación", () => {
    const caption = captionFromProperty(prop);
    expect(caption).toContain("Casa en Polanco");
    expect(caption).toContain("Venta");
    expect(caption).toContain("2,500,000 MXN");
    expect(caption).toContain("Polanco, CDMX");
  });

  it("es determinista (misma entrada → misma salida)", () => {
    expect(captionFromProperty(prop)).toBe(captionFromProperty(prop));
  });
});

describe("firma del webhook de IG (FR-022, con IG_APP_SECRET)", () => {
  const body = JSON.stringify({ object: "instagram", entry: [] });
  const sign = (b: string) =>
    "sha256=" + createHmac("sha256", "ig_secret_test").update(b, "utf8").digest("hex");

  it("acepta firma válida", () => {
    expect(verifyIgWebhookSignature(body, sign(body))).toBe(true);
  });

  it("rechaza firma inválida", () => {
    expect(verifyIgWebhookSignature(body, "sha256=deadbeef")).toBe(false);
  });

  it("rechaza body manipulado", () => {
    expect(verifyIgWebhookSignature(body + "x", sign(body))).toBe(false);
  });

  it("rechaza si falta el header", () => {
    expect(verifyIgWebhookSignature(body, null)).toBe(false);
  });
});

describe("validación Zod de publish", () => {
  it("acepta modo manual", () => {
    expect(
      publishSchema.safeParse({ source: "manual", storageKey: "instagram/org/x.jpg" }).success,
    ).toBe(true);
  });

  it("acepta modo propiedad", () => {
    expect(publishSchema.safeParse({ source: "property", propertyId: "prop_1" }).success).toBe(
      true,
    );
  });

  it("rechaza manual sin storageKey", () => {
    expect(publishSchema.safeParse({ source: "manual" }).success).toBe(false);
  });

  it("rechaza source desconocido", () => {
    expect(publishSchema.safeParse({ source: "video", url: "x" }).success).toBe(false);
  });
});
