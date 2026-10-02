import type { ReactNode } from "react";
import { AppShell } from "../../components/layout/AppShell.tsx";
import { requireCurrentMember } from "../../server/session.ts";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const member = await requireCurrentMember();
  return <AppShell member={{ fullName: member.fullName }}>{children}</AppShell>;
}