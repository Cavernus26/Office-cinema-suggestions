import express from "express";
import { GoogleGenAI } from "@google/genai";
import axios from "axios";
import path from "path";

const app = express();
app.use(express.json());

const BASE_URL = 'https://api.themoviedb.org/3';

// Helper to get environment variables safely
const getTMDBKey = () => process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const getGeminiKey = () => process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

// Debug Endpoint for Config
app.get("/api/config-check", (req, res) => {
  const tmdbKey = getTMDBKey();
  const geminiKey = getGeminiKey();
  
  res.json({
    tmdbKeySet: !!tmdbKey,
    tmdbPrefix: tmdbKey ? tmdbKey.substring(0, 4) : null,
    tmdbLength: tmdbKey ? tmdbKey.length : 0,
    geminiKeySet: !!geminiKey,
    nodeVersion: process.version,
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// Simple Ping for TMDB
app.get("/api/tmdb/ping", async (req, res) => {
  try {
    const key = getTMDBKey();
    if (!key) return res.status(500).json({ status: "error", message: "API Key missing" });
    
    const response = await axios.get(`${BASE_URL}/configuration`, {
      params: { api_key: key }
    });
    
    res.json({ 
      status: "ok", 
      tmdbStatus: response.status,
      data: "Configuration fetched" 
    });
  } catch (error: any) {
    res.status(500).json({ 
      status: "exception", 
      message: error.message, 
      details: error.response?.data 
    });
  }
});

// API Proxy for Gemini AI
app.post("/api/ai/recommend", async (req, res) => {
  try {
    const geminiKey = getGeminiKey();
    if (!geminiKey) return res.status(500).json({ error: "Gemini API Key missing" });
    
    const { prompt } = req.body;
    const genAI = new GoogleGenAI({ apiKey: geminiKey }) as any;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ text: response.text() });
  } catch (error: any) {
    res.status(500).json({ error: "AI service failed", details: error.message });
  }
});

// API Proxy for TMDB Search
app.get("/api/tmdb/search", async (req, res) => {
  try {
    const key = getTMDBKey();
    if (!key) return res.status(500).json({ error: "TMDB API Key missing" });
    
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

    console.log(`TMDB Search: ${query}`);
    const response = await axios.get(`${BASE_URL}/search/multi`, {
      params: {
        api_key: key,
        query: query,
        include_adult: false,
        language: 'en-US',
        page: 1
      }
    });
    
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data?.status_message || error.message;
    res.status(status).json({ error: "TMDB API Error", details });
  }
});

// API Proxy for TMDB Details
app.get("/api/tmdb/details/:type/:id", async (req, res) => {
  try {
    const key = getTMDBKey();
    if (!key) return res.status(500).json({ error: "TMDB API Key missing" });
    
    const { type, id } = req.params;
    
    const response = await axios.get(`${BASE_URL}/${type}/${id}`, {
      params: {
        api_key: key,
        append_to_response: 'credits,videos'
      }
    });
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const details = error.response?.data?.status_message || error.message;
    res.status(status).json({ error: "TMDB API Error", details });
  }
});

// Local dev and static serving
async function bootstrap() {
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      // Dynamically import Vite only in development
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      // Serve static files in production
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

bootstrap().catch(console.error);

export default app;
