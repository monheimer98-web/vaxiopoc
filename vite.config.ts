// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Wichtig: base muss auf den Repository-Namen zeigen -> /vaxiopoc/
export default defineConfig({
  plugins: [react()],
  base: "/vaxiopoc/"
});
