import { eq, type Column, type SQL } from "drizzle-orm";

/**
 * Scope de tenant (Principio III): ninguna query de dominio sin filtro por
 * `organization_id`. `withTenant(orgId)` centraliza el filtro y la verificación
 * de pertenencia.
 */
export class TenantViolationError extends Error {
  constructor() {
    super("Acceso cruzado entre tenants bloqueado");
    this.name = "TenantViolationError";
  }
}

export class TenantScope {
  constructor(public readonly orgId: string) {}

  /** Condición SQL `organization_id = :orgId` para usar en `where(...)`. */
  filter(orgColumn: Column): SQL {
    return eq(orgColumn, this.orgId);
  }

  /** Lanza si la entidad no pertenece a este tenant. */
  assertOwns(entity: { organizationId: string }): void {
    if (entity.organizationId !== this.orgId) {
      throw new TenantViolationError();
    }
  }
}

export function withTenant(orgId: string): TenantScope {
  if (!orgId) throw new Error("withTenant requiere un organization_id");
  return new TenantScope(orgId);
}
