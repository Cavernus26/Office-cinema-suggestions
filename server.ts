import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

async function createServer() {
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

  // Initialize Gemini only if key exists
  let genAI: any = null;
  if (GEMINI_API_KEY) {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }

  app.use(express.json());

  // API Proxy for Gemini AI (Securely accessed only from backend)
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
      if (!TMDB_API_KEY) {
        console.error("TMDB Error: API Key missing from environment.");
        return res.status(500).json({ error: "TMDB API Key not configured on server. Please set TMDB_API_KEY or VITE_TMDB_API_KEY in your environment variables." });
      }
      const { query } = req.query;
      if (!query) return res.json({ results: [] });

      console.log(`TMDB Searching for: "${query}"...`);
      const response = await axios.get(`${BASE_URL}/search/multi`, {
        params: {
          api_key: TMDB_API_KEY,
          query: query,
          include_adult: false,
          language: 'en-US',
          page: 1
        }
      });
      console.log(`TMDB Search Response Status: ${response.status}, Results count: ${response.data.results?.length || 0}`);
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.status_message || error.message;
      console.error(`TMDB Search Error (${status}):`, message);
      res.status(status).json({ error: "Failed to fetch from TMDB", details: message });
    }
  });

  // API Proxy for TMDB Details
  app.get("/api/tmdb/details/:type/:id", async (req, res) => {
    try {
      if (!TMDB_API_KEY) {
        return res.status(500).json({ error: "TMDB API Key not configured on server" });
      }
      const { type, id } = req.params;
      const response = await axios.get(`${BASE_URL}/${type}/${id}`, {
        params: {
          api_key: TMDB_API_KEY,
          append_to_response: 'credits,videos'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      const status = error.response?.status || 500;
      const message = error.response?.data?.status_message || error.message;
      console.error(`TMDB Details Error (${status}):`, message);
      res.status(status).json({ error: "Failed to fetch from TMDB", details: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
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

export default app;
export { createServer };
