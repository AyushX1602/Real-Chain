// Structured JSON logger for the API. In dev we pipe through pino-pretty for
// human-friendly output; in prod the raw JSON ships to whatever log
// aggregator the host wires up.
const pino = require("pino");

const isDev = process.env.NODE_ENV !== "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  base: { service: "realchain-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
        translateTime: "HH:MM:ss",
        ignore: "pid,hostname,service",
      },
    },
  }),
});

module.exports = logger;
