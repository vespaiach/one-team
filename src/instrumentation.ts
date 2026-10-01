export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }
  const { readSettings } = await import("./server/config.ts");
  try {
    readSettings();
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}
