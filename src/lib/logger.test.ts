import { describe, expect, it } from "vitest";
import { redact } from "./logger";

describe("logger.redact", () => {
  it("oculta claves sensibles, también anidadas", () => {
    const r = redact({ user: "a", password: "x", nested: { AUTH_SECRET: "s", ok: 1 } }) as any;
    expect(r.password).toBe("[REDACTED]");
    expect(r.nested.AUTH_SECRET).toBe("[REDACTED]");
    expect(r.nested.ok).toBe(1);
    expect(r.user).toBe("a");
  });
});
