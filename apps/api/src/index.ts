import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { loadConfig } from "./config.js";
import { createAuthRoutes } from "./auth/routes.js";
import { buildProviders } from "./auth/providers/index.js";
import { createDbAuthRepo, createDbSessionRepo } from "./db/repo.js";

const config = loadConfig();
const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => (config.webOrigins.includes(origin) ? origin : config.webOrigins[0] ?? origin),
    credentials: true,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

app.route(
  "/auth",
  createAuthRoutes({
    providers: buildProviders(),
    authRepo: createDbAuthRepo(),
    sessionRepo: createDbSessionRepo(),
    config,
  }),
);

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`api listening on http://localhost:${info.port}`);
});

export default app;
