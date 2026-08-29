import { describe, expect, it } from "vitest";
import { isProductionDatabase, isSqliteUrl, resolveDatabaseUrl } from "../../scripts/db-url.mjs";

describe("database URL helpers", () => {
  it("rejects sqlite URLs", () => {
    expect(isSqliteUrl("file:./dev.db")).toBe(true);
    expect(() => resolveDatabaseUrl("file:./dev.db")).toThrow(/SQLite is not supported/);
  });

  it("requires a postgres URL", () => {
    expect(() => resolveDatabaseUrl("")).toThrow(/DATABASE_URL is required/);
  });

  it("adds pgbouncer for Neon pooled hosts", () => {
    const resolved = resolveDatabaseUrl(
      "postgresql://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require",
    );
    expect(resolved).toContain("pgbouncer=true");
    expect(resolved).toContain("connection_limit=1");
  });

  it("uses DIRECT_URL for migrations when present", () => {
    const previous = process.env.DIRECT_URL;
    process.env.DIRECT_URL = "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech/neondb?sslmode=require";
    const resolved = resolveDatabaseUrl("postgresql://user:pass@ep-example-pooler.us-east-1.aws.neon.tech/neondb", {
      forMigrate: true,
    });
    expect(resolved).toContain("ep-example.us-east-1.aws.neon.tech");
    expect(resolved).not.toContain("pooler");
    if (previous === undefined) delete process.env.DIRECT_URL;
    else process.env.DIRECT_URL = previous;
  });

  it("treats Neon hosts as production databases", () => {
    expect(isProductionDatabase("postgresql://u:p@ep-x.us-east-1.aws.neon.tech/db")).toBe(true);
  });
});
