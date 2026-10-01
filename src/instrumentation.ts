export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { checkSettings } = await import("./instrumentation-node.ts");
    checkSettings();
  }
}