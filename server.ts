import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Global request queue to process up to 10 concurrent Gemini API calls in parallel
class RequestQueue {
  private activeCount = 0;
  private maxConcurrency = 10;
  private queue: { task: () => Promise<any>; resolve: (value: any) => void; reject: (reason?: any) => void }[] = [];

  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    } finally {
      this.activeCount--;
      this.process();
    }
  }
}

const geminiQueue = new RequestQueue();
const responseCache = new Map<string, any>();

function getCacheKey(prompt: string, originalImage: string): string {
  const imgPart = originalImage ? `_${originalImage.length}_${originalImage.slice(0, 50)}` : "";
  return `${prompt.toLowerCase().trim()}${imgPart}`;
}

async function generateContentWithRetry(ai: any, params: any, retries = 3, delayMs = 1000) {
  return geminiQueue.enqueue(async () => {
    let currentDelay = delayMs;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await ai.models.generateContent(params);
      } catch (error: any) {
        const errorMsg = String(error.message || error).toLowerCase();
        const isRetryable =
          errorMsg.includes("429") ||
          errorMsg.includes("503") ||
          errorMsg.includes("resource_exhausted") ||
          errorMsg.includes("rate limit") ||
          errorMsg.includes("too many requests") ||
          errorMsg.includes("unavailable") ||
          errorMsg.includes("overloaded") ||
          errorMsg.includes("spikes in demand") ||
          errorMsg.includes("high demand") ||
          errorMsg.includes("temporarily overloaded") ||
          errorMsg.includes("service unavailable") ||
          errorMsg.includes("internal error") ||
          errorMsg.includes("upstream") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("quota");

        if (isRetryable && attempt < retries) {
          const jitter = Math.floor(Math.random() * 1000);
          const totalWait = Math.min(currentDelay + jitter, 6000);
          console.warn(
            `[Gemini API] Retryable error encountered. Retrying in ${totalWait}ms... (Attempt ${attempt}/${retries})`
          );
          await new Promise((resolve) => setTimeout(resolve, totalWait));
          currentDelay = Math.min(currentDelay * 1.5, 5000);
        } else {
          console.error(`[Gemini API] Max retries reached or non-retryable error:`, errorMsg);
          throw error;
        }
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "15mb" }));

  // API Route: Redraw an image as a single high-quality SVG vector graphic instantly
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, originalImage } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      if (!originalImage) {
        return res.status(400).json({ error: "Original image is required" });
      }

      // Check cache first to ensure near-zero latency for identical requests
      const cacheKey = getCacheKey(prompt, originalImage);
      if (responseCache.has(cacheKey)) {
        console.log(`[Cache Hit] Serving response for prompt: "${prompt}"`);
        return res.json(responseCache.get(cacheKey));
      }

      // Extract custom API key from header, body, or default to server environment variable
      const apiKey = req.headers["x-gemini-api-key"] || req.body.userApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(400).json({
          error: "API Key is missing. Please enter your personal Gemini API Key in the configuration panel on the left, or configure GEMINI_API_KEY on the server."
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let base64Data = "";
      let mimeType = "image/png";
      try {
        if (originalImage.includes(",")) {
          const parts = originalImage.split(",");
          base64Data = parts[1];
          mimeType = parts[0].split(":")[1].split(";")[0];
        } else {
          base64Data = originalImage;
        }
      } catch (e) {
        console.error("Failed to parse base64 image:", e);
        return res.status(400).json({ error: "Invalid base64 image data." });
      }

      const redrawPrompt = `You are a world-class vector artist and SVG illustration designer.
Your task is to analyze the uploaded input character or design, and completely redraw/recreate it as a SINGLE, fully-formed, pristine, beautifully structured SVG vector graphic according to the modification prompt.

The redraw prompt is: "${prompt}".

CRITICAL INSTRUCTIONS:
1. Recreate the character as a clean, professionally styled vector SVG graphic.
2. Incorporate the requested modification prompt elegantly. For example:
   - If requested to change outfits, add wings, add a wizard hat, make it a fire spirit, add a cute smiley face, change to pastel pink colors, add a glowing magical outline, or a sticker style, do so beautifully while keeping the original character's core shape and spirit recognizable.
   - For stickers, you can add a thick, white, smooth outer outline/stroke around the main shapes with a subtle drop shadow to make it pop!
3. Output MUST be a valid SVG document:
   - Must start with <svg> and end with </svg>.
   - Must contain a valid viewBox (e.g., viewBox="0 0 512 512") and clear width/height percentages or values.
   - Must be fully styled, modern, and beautiful with gradients, glows, or sleek strokes as needed.
   - Must contain ONLY valid SVG elements (<path>, <circle>, <rect>, <ellipse>, <polygon>, <g>, <defs>, <linearGradient>, etc.). No HTML/markdown inside the SVG.
4. DO NOT write highly verbose or redundant path nodes. Keep the elements optimized and clean so it renders beautifully and loads instantly.
5. Return ONLY a JSON object containing a single "svg" property with your complete SVG code as a string.`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3.5-flash",
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          redrawPrompt
        ],
        config: {
          responseMimeType: "application/json",
          temperature: 0.25, // Fast, creative but consistent
          systemInstruction: "You are a high-speed, expert SVG vector design engine. Always output extremely neat, compact, and valid SVG code in JSON format.",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              svg: {
                type: Type.STRING,
                description: "The complete valid self-contained SVG XML code string."
              }
            },
            required: ["svg"]
          }
        }
      });

      const text = response.text || "";
      let result: any = {};
      try {
        result = JSON.parse(text.trim());
      } catch (parseErr) {
        console.error("JSON parsing of SVG failed, raw response was:", text);
        throw new Error("Failed to parse Gemini generated SVG vector output. Please try a slightly different prompt.");
      }

      const svg = result.svg;
      if (!svg || typeof svg !== "string") {
        throw new Error("Gemini API returned an invalid response schema.");
      }

      const successResponse = { svg };
      responseCache.set(cacheKey, successResponse);
      return res.json(successResponse);
    } catch (error: any) {
      console.error("Generation error:", error);
      res.status(500).json({ error: error.message || "An unexpected error occurred during SVG redraw." });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

