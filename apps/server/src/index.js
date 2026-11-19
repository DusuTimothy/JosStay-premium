import app from "./app.js";
import { CLIENT_ORIGIN, PORT } from "./config/env.js";

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`JosStay API running on http://localhost:${PORT}`);
    console.log(`CORS allowed origin: ${CLIENT_ORIGIN}`);
    console.log("SAMPLE DATA — demo API, not connected to a database.");
  });
}

export default app;
