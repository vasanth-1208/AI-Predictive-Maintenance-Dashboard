import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/api/ingest",
  method: "POST",
  handler: httpAction(async (ctx: any, request: Request) => {
    const payload = await request.json();
    const result = await ctx.runMutation(api.telemetry.ingestDeviceSnapshot as any, payload);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
