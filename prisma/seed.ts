import { ensureDemoWorkspaceSeeded } from "../src/lib/prisma/bootstrap";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Inicializando datos financieros de demostración en PostgreSQL...");
  const user = await ensureDemoWorkspaceSeeded();
  console.log(`Workspace listo para: ${user.name} (${user.email})`);
}

main()
  .catch((e) => {
    console.error("Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
