import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";

export default async function NewIssuePage() {
  await requireActor();
  notFound();
}