import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req: any, res: any) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const { prompt, originalImage } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }
    if (!originalImage) {
      return res.status(400).json({ error: "Original image is required" });
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

    const response = await ai.models.generateContent({
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
      return res.status(500).json({ error: "Failed to parse Gemini generated SVG vector output. Please try a slightly different prompt." });
    }

    const svg = result.svg;
    if (!svg || typeof svg !== "string") {
      return res.status(500).json({ error: "Gemini API returned an invalid response schema." });
    }

    return res.status(200).json({ svg });
  } catch (error: any) {
    console.error("Vercel Serverless Function error:", error);
    return res.status(500).json({ error: error.message || "An unexpected error occurred during SVG redraw." });
  }
}
