"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";
import { organizationSlug } from "@/lib/auth/slug";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Introduce un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  agencyName: z.string().trim().min(1, "Escribe el nombre de tu agencia"),
});

type FieldName = "email" | "password" | "agencyName";
type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Formulario de registro del dueño (US1). Crea cuenta + agencia, deja al usuario como
 * dueño con la agencia activa y navega al panel (FR-003/FR-004). Valida por campo
 * antes de enviar (FR-002), comunica el correo duplicado (FR-005) y deshabilita el
 * envío mientras la operación está en curso (FR-013).
 */
export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse({ email, password, agencyName });
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string" && !(key in errs)) {
          errs[key as FieldName] = issue.message;
        }
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      // 1) Crear cuenta (Better Auth auto-inicia sesión por defecto).
      const signUp = await authClient.signUp.email({
        email: parsed.data.email,
        password: parsed.data.password,
        // v1 no pide nombre personal: usamos la agencia como display name del dueño.
        name: parsed.data.agencyName,
      });
      if (signUp.error) {
        const err = signUp.error;
        const duplicate =
          err.status === 422 ||
          (err.code ?? "").includes("ALREADY_EXISTS") ||
          /exist/i.test(err.message ?? "");
        if (duplicate) {
          setFormError("Ese correo ya está registrado. Inicia sesión.");
          setPassword(""); // conserva email y agencia, limpia contraseña (FR-005)
        } else {
          setFormError("No pudimos crear tu cuenta. Inténtalo de nuevo.");
        }
        return;
      }

      // 2) Crear la agencia (el creador queda como owner). Reintenta una vez ante una
      //    improbable colisión de slug (UNIQUE).
      let org = await authClient.organization.create({
        name: parsed.data.agencyName,
        slug: organizationSlug(parsed.data.agencyName),
      });
      if (org.error) {
        org = await authClient.organization.create({
          name: parsed.data.agencyName,
          slug: organizationSlug(parsed.data.agencyName),
        });
      }
      if (org.error || !org.data) {
        setFormError(
          "Tu cuenta se creó, pero no pudimos crear la agencia. Inténtalo de nuevo.",
        );
        return;
      }

      // 3) Dejar la agencia como activa de la sesión (R1) y entrar al panel.
      await authClient.organization.setActive({ organizationId: org.data.id });
      router.replace("/inbox");
    } catch {
      setFormError("Ocurrió un error de red. Inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <FormRow label="Correo" htmlFor="email" error={fieldErrors.email}>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          invalid={Boolean(fieldErrors.email)}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </FormRow>

      <FormRow label="Contraseña" htmlFor="password" error={fieldErrors.password}>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          invalid={Boolean(fieldErrors.password)}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </FormRow>

      <FormRow
        label="Nombre de la agencia"
        htmlFor="agencyName"
        error={fieldErrors.agencyName}
      >
        <Input
          id="agencyName"
          type="text"
          autoComplete="organization"
          value={agencyName}
          invalid={Boolean(fieldErrors.agencyName)}
          onChange={(e) => setAgencyName(e.target.value)}
          disabled={pending}
        />
      </FormRow>

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Creando cuenta…" : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-text-3">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-accent-text hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

function FormRow({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text-2">
        {label}
      </label>
      {children}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
