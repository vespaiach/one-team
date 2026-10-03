import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./db.ts";

const limitMs = 800;

export async function checkHealth(
  query: () => Promise<unknown> = () => db().execute(sql`select 1`),
): Promise<Response> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), limitMs);
  });
  try {
    await Promise.race([query(), timeout]);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}