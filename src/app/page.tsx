import React, { Suspense } from "react";
import { getFinancialWorkspaceData } from "@/server/actions/finance.actions";
import { FinanceAppShell } from "@/components/FinanceAppShell";
import { WorkspaceSkeleton } from "@/components/ui/skeleton";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const workspaceData = await getFinancialWorkspaceData();

  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <FinanceAppShell initialData={workspaceData} />
    </Suspense>
  );
}
