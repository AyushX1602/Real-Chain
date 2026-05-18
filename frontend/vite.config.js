import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// envDir = repo root so the single root .env powers both Hardhat and Vite.
// Only VITE_-prefixed vars are exposed to the browser bundle (Vite default).
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, ".."),
  server: { port: 3000 },
});
