import { randomUUID } from "node:crypto";

export const requestContext = (req, res, next) => {
  const incoming = String(req.header("x-request-id") || "").replace(
    /[^a-zA-Z0-9_-]/g,
    "",
  );
  req.id = incoming.slice(0, 64) || randomUUID();
  res.setHeader("X-Request-Id", req.id);

  const method = req.method;
  const path = req.originalUrl.split("?")[0];
  const started = process.hrtime.bigint();

  res.on("finish", () => {
    if (path === "/health") return;
    const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
    console.log(
      `${method} ${path} ${res.statusCode} ${elapsed.toFixed(0)}ms ${req.id}`,
    );
  });

  next();
};
