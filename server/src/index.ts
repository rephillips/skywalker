import express from "express";
import cors from "cors";
import { config, initConfig } from "./config.js";
import { errorHandler } from "./middleware/errorHandler.js";
import healthRouter from "./routes/health.js";
import searchRouter from "./routes/search.js";
import configRouter from "./routes/config.js";

async function start() {
  // Prompt for master key if encrypted values exist
  await initConfig();

  const app = express();

  app.use(cors({ origin: "http://localhost:5173" }));
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api", searchRouter);
  app.use("/api", configRouter);

  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`Splunk target: ${config.splunk.baseUrl}`);
  });
}

start();
