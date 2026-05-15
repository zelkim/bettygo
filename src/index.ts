import { Hono } from "hono";
import { cors } from "hono/cors";
import auth from "./routes/auth";
import type { Env } from "./types";

const app = new Hono<{ Bindings: Env }>();

app.use("*", async (c, next) => {
  const origin = c.env.ALLOWED_ORIGIN || "*";
  return cors({
    origin,
    allowMethods: ["GET", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })(c, next);
});

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", auth);

export default app;
