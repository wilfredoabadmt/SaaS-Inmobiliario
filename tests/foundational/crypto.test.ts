import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { open, seal } from "@/lib/crypto";

describe("crypto AES-256-GCM (Principio I)", () => {
  const key = randomBytes(32);

  it("round-trip: open(seal(x)) === x", () => {
    const secret = "EAAG_token_de_meta_simulado_123";
    const sealed = seal(secret, key);
    expect(sealed.encryptedToken).not.toBe(secret);
    expect(sealed.tokenIv).toBeTruthy();
    expect(sealed.authTag).toBeTruthy();
    expect(open(sealed, key)).toBe(secret);
  });

  it("detecta manipulación del authTag", () => {
    const sealed = seal("hola", key);
    const tampered = { ...sealed, authTag: randomBytes(16).toString("base64") };
    expect(() => open(tampered, key)).toThrow();
  });

  it("falla al abrir con una clave distinta", () => {
    const sealed = seal("hola", key);
    expect(() => open(sealed, randomBytes(32))).toThrow();
  });
});
