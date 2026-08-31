import "server-only";
import { user } from "@/db/schema";

export const publicUser = {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl,
  role: user.role,
  jobTitle: user.jobTitle,
  deactivatedAt: user.deactivatedAt,
};

export const accountUser = {
  ...publicUser,
  email: user.email,
  slackHandle: user.slackHandle,
  phone: user.phone,
  bio: user.bio,
};