import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const TMDB_API_KEY = process.env.TMDB_API_KEY;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  const BASE_URL = 'https://api.themoviedb.org/3';

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
        return res.status(500).json({ error: "TMDB API Key not configured on server" });
      }
      const { query } = req.query;
      const response = await axios.get(`${BASE_URL}/search/multi`, {
        params: {
          api_key: TMDB_API_KEY,
          query: query
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("TMDB Search Error:", error.message);
      res.status(500).json({ error: "Failed to fetch from TMDB" });
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
          api_key: TMDB_API_KEY
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("TMDB Details Error:", error.message);
      res.status(500).json({ error: "Failed to fetch from TMDB" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
