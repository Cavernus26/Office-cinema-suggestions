import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function createServer() {
  const app = express();
  
  const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const BASE_URL = 'https://api.themoviedb.org/3';

  if (!TMDB_API_KEY) {
    console.warn("WARNING: TMDB_API_KEY is missing from environment variables.");
  } else {
    console.log(`TMDB_API_KEY is configured (starts with: ${TMDB_API_KEY.substring(0, 4)}...)`);
  }

  if (!GEMINI_API_KEY) {
    console.warn("WARNING: GEMINI_API_KEY is missing from environment variables.");
  } else {
    console.log(`GEMINI_API_KEY is configured (starts with: ${GEMINI_API_KEY.substring(0, 4)}...)`);
  }
  
  // Initialize Gemini
  let genAI: any = null;
  if (GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  
  app.use(express.json());

  // Debug Endpoint for Config
  app.get("/api/config-check", (req, res) => {
    res.json({
      tmdbKeySet: !!TMDB_API_KEY,
      tmdbPrefix: TMDB_API_KEY ? TMDB_API_KEY.substring(0, 4) : null,
      nodeEnv: process.env.NODE_ENV,
      isVercel: !!process.env.VERCEL,
      timestamp: new Date().toISOString()
    });
  });

  // Simple Ping for TMDB
  app.get("/api/tmdb/ping", async (req, res) => {
    try {
      const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
      if (!TMDB_KEY) return res.status(500).json({ status: "error", message: "API Key missing" });
      
      const response = await fetch(`${BASE_URL}/authentication/pulse?api_key=${TMDB_KEY}`);
      // Wait, authenticating pulse might not exist. Let's try configuration instead.
      const response2 = await fetch(`${BASE_URL}/configuration?api_key=${TMDB_KEY}`);
      const data = await response2.json();
      
      res.json({ 
        status: response2.ok ? "ok" : "error", 
        tmdbStatus: response2.status,
        data: response2.ok ? "Configuration fetched" : data 
      });
    } catch (error: any) {
      res.status(500).json({ status: "exception", message: error.message });
    }
  });

  // API Proxy for Gemini AI
  app.post("/api/ai/recommend", async (req, res) => {
    try {
      if (!genAI) {
        return res.status(500).json({ error: "Gemini API Key not configured on server" });
      }
      const { prompt } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ text: response.text() });
    } catch (error: any) {
      console.error("Gemini Error:", error.message);
      res.status(500).json({ error: "AI service failed" });
    }
  });

  // API Proxy for TMDB Search
  app.get("/api/tmdb/search", async (req, res) => {
    try {
      const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
      if (!TMDB_KEY) {
        console.error("TMDB Error: API Key missing from environment variables.");
        return res.status(500).json({ error: "TMDB API Key missing on server" });
      }
      const { query } = req.query;
      if (!query) return res.json({ results: [] });

      console.log(`TMDB Request: Search for "${query}"`);
      
      // Use fetch instead of axios for better compatibility in some environments
      const url = new URL(`${BASE_URL}/search/multi`);
      url.searchParams.append('api_key', TMDB_KEY);
      url.searchParams.append('query', String(query));
      url.searchParams.append('include_adult', 'false');
      url.searchParams.append('language', 'en-US');
      url.searchParams.append('page', '1');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        console.error(`TMDB API Error (${response.status}):`, data);
        return res.status(response.status).json({ 
          error: "TMDB API Error", 
          details: data.status_message || "Unknown TMDB error" 
        });
      }
      
      console.log(`TMDB Response: ${response.status}, ${data.results?.length || 0} results`);
      res.json(data);
    } catch (error: any) {
      console.error(`TMDB Search Exception:`, error.message);
      res.status(500).json({ error: "TMDB Proxy Error", details: error.message });
    }
  });

  // API Proxy for TMDB Details
  app.get("/api/tmdb/details/:type/:id", async (req, res) => {
    try {
      const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
      if (!TMDB_KEY) {
        return res.status(500).json({ error: "TMDB API Key not configured on server" });
      }
      const { type, id } = req.params;
      
      const url = new URL(`${BASE_URL}/${type}/${id}`);
      url.searchParams.append('api_key', TMDB_KEY);
      url.searchParams.append('append_to_response', 'credits,videos');

      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ 
          error: "TMDB API Error", 
          details: data.status_message || "Unknown TMDB error" 
        });
      }
      res.json(data);
    } catch (error: any) {
      console.error(`TMDB Details Error:`, error.message);
      res.status(500).json({ error: "Failed to fetch from TMDB", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production (Vercel/Local), we serve the static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Important for SPA: Fallback to index.html for unknown routes
    app.get('*', (req, res) => {
      // Avoid infinite loop if index.html is missing
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

// Start listener only if not running in a serverless environment (like Vercel functions)
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  createServer().then((app) => {
    const PORT = parseInt(process.env.PORT || '3000', 10);
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

// For Vercel:
let cachedApp: any;
const handler = async (req: any, res: any) => {
  if (!cachedApp) {
    cachedApp = await createServer();
  }
  return cachedApp(req, res);
};

export default handler;
export { createServer };
