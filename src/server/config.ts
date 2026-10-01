type Settings = {
  databaseUrl: string;
};

export function readSettings(): Settings {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing setting: DATABASE_URL");
  }
  return { databaseUrl };
}