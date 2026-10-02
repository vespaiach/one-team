import { readAppSettings, readSettings } from "./server/config.ts";

export function checkSettings() {
  try {
    readSettings();
    readAppSettings();
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n`);
    process.exit(1);
  }
}