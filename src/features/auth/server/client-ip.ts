import "server-only";

const MAX_IP_LENGTH = 45;

export function clientIp(headers: Pick<Headers, "get">): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) {
    return "unknown";
  }
  const hops = forwardedFor.split(",").map((hop) => hop.trim());
  const address = process.env.TRUST_PROXY ? hops.at(-1) : hops[0];
  return (address || "unknown").slice(0, MAX_IP_LENGTH);
}