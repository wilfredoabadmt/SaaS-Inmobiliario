import { describe, expect, it } from "vitest";
import { TenantViolationError, withTenant } from "@/lib/db/tenant";

describe("withTenant — aislamiento por tenant (Principio III)", () => {
  it("permite una entidad del mismo tenant", () => {
    const scope = withTenant("org_a");
    expect(() => scope.assertOwns({ organizationId: "org_a" })).not.toThrow();
  });

  it("bloquea el cruce entre tenants", () => {
    const scope = withTenant("org_a");
    expect(() => scope.assertOwns({ organizationId: "org_b" })).toThrow(TenantViolationError);
  });

  it("exige un organization_id", () => {
    expect(() => withTenant("")).toThrow();
  });
});
