# FinanzaPro PWA — Gestión Patrimonial, Tarjetas, Préstamos y Metas

Progressive Web Application (PWA) modular y de nivel de producción para la gestión integral de finanzas personales, tarjetas de crédito, amortización de deudas, suscripciones recurrentes, compras con comprobantes comprimidos y bóvedas de ahorro.

## 1. Stack Técnico y Arquitectura

- **Frontend:** Next.js 15 (App Router) + React 19 + TypeScript (`strict: true`).
- **Estilos y UI:** Tailwind CSS + Radix UI Primitives + Lucide React + Sonner Toasts.
- **PWA Offline-First:** `@ducanh2912/next-pwa` + Service Worker (`public/sw-offline.js`) + `public/manifest.json` instalable con accesos directos (`shortcuts`).
- **Persistencia:** PostgreSQL 16 + Prisma ORM (`prisma/schema.prisma`) con transacciones atómicas ACID (`prisma.$transaction`).
- **Compresión y Almacenamiento de Comprobantes:** Compresión en cliente a WebP (< 350 KB) mediante `browser-image-compression` + Canvas fallback antes de subir a Supabase Storage / S3 / Local Vault (`/api/upload`).
- **Validación End-to-End:** Contratos estrictos con Zod + React Hook Form (`@hookform/resolvers/zod`).

## 2. Screaming Architecture (Estructura por Dominios)

```text
├── prisma/
│   ├── schema.prisma                # Esquema relacional normalizado con índices y enums
│   └── seed.ts                      # Seed inicial de portafolio financiero
├── public/
│   ├── manifest.json                # Web App Manifest (Mobile-First PWA)
│   ├── sw-offline.js                # Service Worker con estrategia Stale-While-Revalidate
│   └── uploads/receipts/            # Almacenamiento optimizado de tickets/facturas
└── src/
    ├── app/                         # Next.js App Router (layout, page, loading, api/upload)
    ├── components/                  # Shell principal, PWA Banner y UI Skeletons
    ├── lib/
    │   ├── prisma/                  # Singleton Prisma Client y bootstrap de datos
    │   ├── storage/                 # Compresión WebP en cliente y adaptador de subida
    │   └── utils.ts                 # Cálculos financieros y tabla de amortización francesa
    ├── modules/
    │   ├── accounts/                # Dominio de Cuentas, Tarjetas de Crédito y Patrimonio
    │   ├── transactions/            # Dominio de Captura Rápida, Ledger y Conciliación
    │   ├── subscriptions/           # Dominio de Suscripciones, Nómina Quincenal y Remesas
    │   ├── loans/                   # Dominio de Préstamos y Tabla de Amortización
    │   ├── savings/                 # Dominio de Bóvedas de Ahorro y Transferencias
    │   └── dashboard/               # Dashboard Financiero Ejecutivo
    └── server/
        └── actions/                 # Server Actions con validación Zod y prisma.$transaction
```

## 3. Ejecución Local

```bash
# 1. Levantar PostgreSQL 16 en Docker (puerto 5442)
docker compose up -d

# 2. Instalar dependencias y sincronizar esquema Prisma
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push

# 3. Poblar datos iniciales de demostración
npm run db:seed

# 4. Iniciar servidor de desarrollo (http://localhost:3050)
npm run dev
```
