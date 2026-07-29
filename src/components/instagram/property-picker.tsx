"use client";

export interface PropertyOption {
  id: string;
  label: string;
}

interface Props {
  options: PropertyOption[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

/** Selector de propiedad para "Publicar propiedad" (feature 008). */
export function PropertyPicker({ options, value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-sm text-text focus:outline-none focus:ring-2 focus:ring-accent-tint disabled:opacity-50"
    >
      <option value="">Selecciona una propiedad…</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
