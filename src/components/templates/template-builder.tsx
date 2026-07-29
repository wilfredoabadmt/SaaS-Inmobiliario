"use client";

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { countVariables, renderBody, type TemplateComponents } from "@/lib/meta/templates";

const LANGUAGES = [
  { code: "es_MX", label: "Español (México)" },
  { code: "es", label: "Español" },
  { code: "en_US", label: "Inglés (EE. UU.)" },
  { code: "en", label: "Inglés" },
];

type HeaderMode = "NONE" | "TEXT" | "IMAGE";
type ButtonType = "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
interface ButtonDraft {
  type: ButtonType;
  text: string;
  url: string;
  phoneNumber: string;
}

const SELECT_CLS = "mt-1 block h-9 w-full rounded-sm border border-border bg-bg px-2 text-sm text-text";
const LABEL_CLS = "block text-[12px] font-[550] text-text-2";

/** Deriva un nombre snake_case válido para Meta a partir del nombre visible. */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

export function TemplateBuilder({
  onCreated,
  onCancel,
}: {
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [waTemplateName, setWaTemplateName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [category, setCategory] = useState<"MARKETING" | "UTILITY" | "AUTHENTICATION">("UTILITY");
  const [language, setLanguage] = useState("es_MX");

  const [headerMode, setHeaderMode] = useState<HeaderMode>("NONE");
  const [headerText, setHeaderText] = useState("");
  const [headerExample, setHeaderExample] = useState("");
  const [headerHandle, setHeaderHandle] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [body, setBody] = useState("");
  const [examples, setExamples] = useState<string[]>([]);
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyVars = useMemo(() => countVariables(body), [body]);
  const headerHasVar = headerMode === "TEXT" && countVariables(headerText) > 0;

  function onNameChange(v: string) {
    setName(v);
    if (!nameTouched) setWaTemplateName(slugify(v));
  }

  function setExampleAt(i: number, v: string) {
    setExamples((prev) => {
      const next = [...prev];
      while (next.length < bodyVars) next.push("");
      next[i] = v;
      return next;
    });
  }

  async function uploadImage(file: File) {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/templates/upload-sample", {
        method: "POST",
        headers: { "content-type": file.type },
        body: file,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "No se pudo subir la imagen");
        return;
      }
      setHeaderHandle(data.handle as string);
    } catch {
      setError("No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  function addButton() {
    if (buttons.length >= 3) return;
    setButtons((b) => [...b, { type: "QUICK_REPLY", text: "", url: "", phoneNumber: "" }]);
  }
  function updateButton(i: number, patch: Partial<ButtonDraft>) {
    setButtons((b) => b.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeButton(i: number) {
    setButtons((b) => b.filter((_, idx) => idx !== i));
  }

  function buildComponents(): TemplateComponents {
    const filledExamples = Array.from({ length: bodyVars }, (_, i) => examples[i] ?? "");
    const components: TemplateComponents = {
      body: { text: body, variables: bodyVars, examples: filledExamples },
    };
    if (headerMode === "TEXT" && headerText.trim()) {
      components.header = {
        format: "TEXT",
        text: headerText,
        ...(headerHasVar ? { example: headerExample } : {}),
      };
    } else if (headerMode === "IMAGE") {
      components.header = { format: "IMAGE" };
    }
    if (footer.trim()) components.footer = { text: footer };
    if (buttons.length > 0) {
      components.buttons = buttons.map((b) => ({
        type: b.type,
        text: b.text,
        ...(b.type === "URL" && b.url ? { url: b.url } : {}),
        ...(b.type === "PHONE_NUMBER" && b.phoneNumber ? { phoneNumber: b.phoneNumber } : {}),
      }));
    }
    return components;
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          waTemplateName,
          language,
          category,
          components: buildComponents(),
          ...(headerMode === "IMAGE" && headerHandle ? { headerHandle } : {}),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message ?? "No se pudo crear la plantilla");
        return;
      }
      onCreated();
    } catch {
      setError("No se pudo crear la plantilla");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    name.trim() &&
    /^[a-z0-9_]{1,512}$/.test(waTemplateName) &&
    body.trim() &&
    (bodyVars === 0 || Array.from({ length: bodyVars }, (_, i) => examples[i]).every((e) => (e ?? "").trim())) &&
    (headerMode !== "IMAGE" || headerHandle) &&
    (!headerHasVar || headerExample.trim()) &&
    !submitting &&
    !uploading;

  return (
    <section className="mt-5 rounded-lg border border-border bg-bg-panel p-5 shadow-rest">
      <div className="flex items-center justify-between">
        <h2 className="text-[14px] font-[650] text-text">Nueva plantilla</h2>
        <button onClick={onCancel} className="text-text-3 hover:text-text" aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL_CLS}>Nombre (interno)</label>
          <Input value={name} onChange={(e) => onNameChange(e.target.value)} className="mt-1 h-9" placeholder="Recordatorio de visita" />
        </div>
        <div>
          <label className={LABEL_CLS}>Nombre en WhatsApp</label>
          <Input
            value={waTemplateName}
            onChange={(e) => {
              setNameTouched(true);
              setWaTemplateName(e.target.value);
            }}
            className="mt-1 h-9 font-mono"
            placeholder="recordatorio_visita"
          />
          <p className="mt-1 text-[11px] text-text-4">minúsculas, números y guion bajo</p>
        </div>
        <div>
          <label className={LABEL_CLS}>Categoría</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as typeof category)} className={SELECT_CLS}>
            <option value="UTILITY">Utilidad</option>
            <option value="MARKETING">Marketing</option>
            <option value="AUTHENTICATION">Autenticación</option>
          </select>
        </div>
        <div>
          <label className={LABEL_CLS}>Idioma</label>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={SELECT_CLS}>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Encabezado */}
      <div className="mt-4">
        <label className={LABEL_CLS}>Encabezado (opcional)</label>
        <select value={headerMode} onChange={(e) => setHeaderMode(e.target.value as HeaderMode)} className={SELECT_CLS}>
          <option value="NONE">Sin encabezado</option>
          <option value="TEXT">Texto</option>
          <option value="IMAGE">Imagen</option>
        </select>
        {headerMode === "TEXT" && (
          <>
            <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} className="mt-2 h-9" placeholder="Título (puede usar {{1}})" />
            {headerHasVar && (
              <Input value={headerExample} onChange={(e) => setHeaderExample(e.target.value)} className="mt-2 h-9" placeholder="Ejemplo para {{1}} del encabezado" />
            )}
          </>
        )}
        {headerMode === "IMAGE" && (
          <div className="mt-2 flex items-center gap-3">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadImage(f);
              }}
              className="text-[12px] text-text-2"
            />
            {uploading && <Loader2 size={14} className="animate-spin text-text-3" />}
            {headerHandle && !uploading && <span className="text-[12px] text-emerald-600">Imagen lista ✓</span>}
          </div>
        )}
      </div>

      {/* Cuerpo */}
      <div className="mt-4">
        <label className={LABEL_CLS}>Cuerpo</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-sm border border-border bg-bg px-2 py-1.5 text-sm text-text"
          placeholder="Hola {{1}}, te recordamos tu visita a {{2}} el {{3}}."
        />
        {bodyVars > 0 && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-text-4">Valores de ejemplo (obligatorios para revisión):</p>
            {Array.from({ length: bodyVars }, (_, i) => (
              <Input
                key={i}
                value={examples[i] ?? ""}
                onChange={(e) => setExampleAt(i, e.target.value)}
                className="h-8"
                placeholder={`Ejemplo para {{${i + 1}}}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pie */}
      <div className="mt-4">
        <label className={LABEL_CLS}>Pie (opcional)</label>
        <Input value={footer} onChange={(e) => setFooter(e.target.value)} className="mt-1 h-9" placeholder="Inmox" />
      </div>

      {/* Botones */}
      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label className={LABEL_CLS}>Botones (opcional, máx 3)</label>
          {buttons.length < 3 && (
            <button onClick={addButton} className="flex items-center gap-1 text-[12px] text-text-2 hover:text-text">
              <Plus size={13} /> Agregar
            </button>
          )}
        </div>
        <div className="mt-2 space-y-2">
          {buttons.map((b, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-sm border border-border bg-bg p-2">
              <select value={b.type} onChange={(e) => updateButton(i, { type: e.target.value as ButtonType })} className="h-8 rounded-sm border border-border bg-bg-panel px-2 text-[12px] text-text">
                <option value="QUICK_REPLY">Respuesta rápida</option>
                <option value="URL">Enlace (URL)</option>
                <option value="PHONE_NUMBER">Llamar</option>
              </select>
              <Input value={b.text} onChange={(e) => updateButton(i, { text: e.target.value })} className="h-8 w-40" placeholder="Texto del botón" />
              {b.type === "URL" && (
                <Input value={b.url} onChange={(e) => updateButton(i, { url: e.target.value })} className="h-8 w-56" placeholder="https://…" />
              )}
              {b.type === "PHONE_NUMBER" && (
                <Input value={b.phoneNumber} onChange={(e) => updateButton(i, { phoneNumber: e.target.value })} className="h-8 w-44" placeholder="+52…" />
              )}
              <button onClick={() => removeButton(i)} className="ml-auto text-text-4 hover:text-red-500" aria-label="Quitar botón">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      {body.trim() && (
        <div className="mt-5">
          <label className={LABEL_CLS}>Vista previa</label>
          <div className="mt-1 max-w-sm rounded-lg bg-[#e7f6dd] p-3 text-[13px] text-text shadow-sm">
            {headerMode === "TEXT" && headerText && (
              <p className="font-[650]">{renderBody(headerText, [headerExample])}</p>
            )}
            {headerMode === "IMAGE" && (
              <div className="mb-2 flex h-20 items-center justify-center rounded bg-black/5 text-[11px] text-text-4">[imagen]</div>
            )}
            <p className="whitespace-pre-wrap">{renderBody(body, Array.from({ length: bodyVars }, (_, i) => examples[i] ?? `{{${i + 1}}}`))}</p>
            {footer.trim() && <p className="mt-1 text-[11px] text-text-4">{footer}</p>}
            {buttons.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-black/10 pt-2">
                {buttons.map((b, i) => (
                  <p key={i} className="text-center text-[12px] font-[600] text-sky-700">
                    {b.text || "(botón)"}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-[12px] text-red-500">{error}</p>}

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={submit} disabled={!canSubmit} size="sm">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          Enviar a revisión
        </Button>
        <Button onClick={onCancel} variant="ghost" size="sm">
          Cancelar
        </Button>
      </div>
    </section>
  );
}
