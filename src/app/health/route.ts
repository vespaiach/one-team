import { apiRoute } from "../../server/api.ts";
import { checkHealth } from "../../server/health.ts";

export const dynamic = "force-dynamic";

export const GET = apiRoute(() => checkHealth());
