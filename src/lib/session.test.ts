import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session";
import { hashPassword, verifyPassword } from "./password";

describe("session", () => {
  it("acepta un token válido", async () => {
    const t = await createSessionToken("usuario", "secreto");
    expect(await verifySessionToken(t, "secreto")).toBe("usuario");
  });
  it("rechaza otro secreto, manipulación, expirado y token vacío", async () => {
    const t = await createSessionToken("usuario", "secreto", 1000);
    expect(await verifySessionToken(t, "otro", 1001)).toBeNull();
    expect(await verifySessionToken("x." + t.split(".")[1], "secreto", 1001)).toBeNull();
    expect(await verifySessionToken(t, "secreto", 1000 + 60 * 60 * 24 * 8)).toBeNull();
    expect(await verifySessionToken(undefined, "secreto")).toBeNull();
  });
});

describe("password", () => {
  it("verifica hash scrypt", () => {
    const h = hashPassword("clave-de-prueba");
    expect(verifyPassword("clave-de-prueba", h)).toBe(true);
    expect(verifyPassword("otra", h)).toBe(false);
  });
});
