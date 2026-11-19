export const getHealth = (_req, res) => {
  res.json({
    status: "ok",
    service: "josstay-api",
    version: "1.0.0",
    note: "SAMPLE DATA — demo API",
    time: new Date().toISOString(),
  });
};
