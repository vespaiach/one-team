import { notFound } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";

export default async function ProjectDetailsPage() {
  await requireActor();
  notFound();
}