import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";

export default async function IssueDetailsPage() {
  await requireActor();
  notFound();
}