import path from "path";
import express from "express";
import app from "./api/index.ts";

const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

if (!isProduction) {
  // In development, we use Vite's middleware
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then((vite) => {
      app.use(vite.middlewares);
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Development server running on port ${PORT}`);
      });
    });
  }).catch(console.error);
} else if (!process.env.VERCEL) {
  // In non-Vercel production (e.g. Cloud Run, Railway), we serve static files
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(distPath, "index.html"));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Production server running on port ${PORT}`);
  });
}

export default app;
