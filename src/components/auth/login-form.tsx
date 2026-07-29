"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const schema = z.object({
  email: z.string().email("Introduce un correo válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

type FieldName = "email" | "password";
type FieldErrors = Partial<Record<FieldName, string>>;

/**
 * Formulario de inicio de sesión (US2). Ante credenciales inválidas muestra un
 * mensaje genérico que NO revela si el correo existe (FR-008/SC-006). La
 * organización activa la resuelve el `databaseHooks.session.create.before` del
 * servidor (R1). Deshabilita el envío mientras la operación está en curso (FR-013).
 */
export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = schema.safeParse({ email, password });
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
      const res = await authClient.signIn.email({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (res.error) {
        // Mensaje genérico: no distingue correo inexistente de contraseña errónea.
        setFormError("Correo o contraseña incorrectos.");
        return;
      }
      router.replace("/inbox");
    } catch {
      setFormError("Ocurrió un error. Inténtalo de nuevo.");
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
          autoComplete="current-password"
          value={password}
          invalid={Boolean(fieldErrors.password)}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
        />
      </FormRow>

      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Iniciar sesión"}
      </Button>

      <p className="text-center text-sm text-text-3">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-accent-text hover:underline">
          Regístrate
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
