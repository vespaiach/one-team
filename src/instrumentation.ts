let hasRegistered = false;

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  if (hasRegistered) {
    return;
  }
  hasRegistered = true;

  const { bootstrap } = await import("@/features/auth/server/bootstrap");
  await bootstrap({
    appUrl: process.env.APP_URL,
    databaseUrl: process.env.DATABASE_URL,
    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD,
  });
}