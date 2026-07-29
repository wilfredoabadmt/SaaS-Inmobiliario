import { customAlphabet } from "nanoid";

/** Sufijo aleatorio en minúsculas alfanuméricas para desambiguar slugs homónimos. */
const randomSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 6);

/**
 * Genera un slug de organización a partir del nombre visible (R3).
 *
 * `organization.slug` es UNIQUE, pero dos agencias pueden compartir el mismo nombre
 * visible (Edge Case del spec). Por eso normalizamos el nombre (minúsculas, sin
 * acentos, solo `[a-z0-9-]`) y añadimos un sufijo aleatorio corto que garantiza
 * unicidad sin perder legibilidad. El `name` visible se guarda aparte, tal cual.
 */
export function organizationSlug(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "") // elimina acentos (marcas diacríticas)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // no alfanumérico → guion
    .replace(/^-+|-+$/g, "") // recorta guiones de los extremos
    .slice(0, 40);
  const stem = base.length > 0 ? base : "agencia";
  return `${stem}-${randomSuffix()}`;
}
