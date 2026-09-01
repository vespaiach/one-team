import { requireActor } from "@/features/auth/server/actor";

export default async function HomePage() {
  await requireActor();
  return null;
}