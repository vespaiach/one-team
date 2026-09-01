import { forbidden, notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";

export default async function AccountsPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    forbidden();
  }
  notFound();
}