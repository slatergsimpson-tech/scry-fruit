import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths, so the built site works from any folder —
  // including GitHub Pages, which serves it under /scry-fruit/.
  base: "./",
});
