import { ensureUserExists } from "../src/lib/prisma/bootstrap";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Verificando usuario base en PostgreSQL...");
  const user = await ensureUserExists();
  console.log(`Usuario listo: ${user.name} (${user.email}) — sin datos de ejemplo precargados.`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
