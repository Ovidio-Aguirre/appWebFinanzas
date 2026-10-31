// Uso: node scripts/hash-password.mjs "contraseña"
import { randomBytes, scryptSync } from "node:crypto";

const pwd = process.argv[2];
if (!pwd) {
  console.error('Uso: node scripts/hash-password.mjs "contraseña"');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = scryptSync(pwd, salt, 64);
// El hash lleva "$": en .env de Next hay que escaparlos como \$ (se hace aquí).
const value = `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
console.log(`AUTH_PASSWORD_HASH="${value.replace(/\$/g, "\\$")}"`);
console.log(`AUTH_SECRET="${randomBytes(32).toString("hex")}"`);
