import express from "express";
import path from "path";
import axios from "axios";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

/**
 * Robust express app setup
 */
const app = express();
app.use(express.json());

const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const BASE_URL = 'https://api.themoviedb.org/3';

// Initialize Gemini
let genAI: any = null;
if (GEMINI_API_KEY) {
  try {
    genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY as string });
  } catch (e) {
    console.error("Failed to init Gemini:", e);
  }
}

// Debug Endpoint for Config
app.get("/api/config-check", (req, res) => {
  res.json({
    tmdbKeySet: !!TMDB_API_KEY,
    tmdbPrefix: TMDB_API_KEY ? TMDB_API_KEY.substring(0, 4) : null,
    geminiKeySet: !!GEMINI_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
    timestamp: new Date().toISOString()
  });
});

// Simple Ping for TMDB
app.get("/api/tmdb/ping", async (req, res) => {
  try {
    const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
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
    res.status(500).json({ status: "exception", message: error.message, details: error.response?.data });
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
    res.status(500).json({ error: "AI service failed", details: error.message });
  }
});

// API Proxy for TMDB Search
app.get("/api/tmdb/search", async (req, res) => {
  try {
    const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "TMDB API Key missing on server" });
    }
    const { query } = req.query;
    if (!query) return res.json({ results: [] });

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
    const message = error.response?.data?.status_message || error.message;
    res.status(status).json({ error: "TMDB API Error", details: message });
  }
});

// API Proxy for TMDB Details
app.get("/api/tmdb/details/:type/:id", async (req, res) => {
  try {
    const key = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "TMDB API Key missing on server" });
    }
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
    const message = error.response?.data?.status_message || error.message;
    res.status(status).json({ error: "Failed to fetch from TMDB", details: message });
  }
});

/**
 * Handle Static Files & Vite (Environment Dependent)
 */
async function setupFrontend() {
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    // Only import vite in non-production local environments
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // In production mode (NOT Vercel), serve the built static files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Skip if it looks like an API route that somehow hit here
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

// Note: In Vercel, setupFrontend is generally skipped because Vercel handles static routing.
if (!process.env.VERCEL) {
  setupFrontend();
}

/**
 * Start Server (Local Only)
 */
if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  const PORT = parseInt(process.env.PORT || '3000', 10);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

// Default export for Vercel
export default app;
