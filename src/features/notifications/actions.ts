"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import {
  markAllNotificationsRead as runMarkAllNotificationsRead,
  markNotificationRead as runMarkNotificationRead,
} from "./server/mark-read";

export type MarkNotificationReadPayload = { notificationId: unknown };

export type MarkNotificationReadResult = { status: "ok" } | { status: "not-found" };

export type MarkAllNotificationsReadResult = { status: "ok" };

const INVALID_TEXT_REPRESENTATION = "22P02";

function isInvalidTextRepresentation(error: unknown): boolean {
  const candidate = error instanceof Error ? error.cause : error;
  if (typeof candidate !== "object" || candidate === null || !("code" in candidate)) {
    return false;
  }
  return (candidate as { code: unknown }).code === INVALID_TEXT_REPRESENTATION;
}

export async function markNotificationRead(
  input: MarkNotificationReadPayload,
): Promise<MarkNotificationReadResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (typeof input.notificationId !== "string" || input.notificationId.trim() === "") {
    return { status: "not-found" };
  }

  try {
    const outcome = await runMarkNotificationRead({
      userId: actor.id,
      notificationId: input.notificationId,
    });
    if (outcome === "not-found") {
      return { status: "not-found" };
    }
  } catch (error) {
    if (isInvalidTextRepresentation(error)) {
      return { status: "not-found" };
    }
    throw error;
  }

  refresh();
  return { status: "ok" };
}

export async function markAllNotificationsRead(): Promise<MarkAllNotificationsReadResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  await runMarkAllNotificationsRead(actor.id);

  refresh();
  return { status: "ok" };
}