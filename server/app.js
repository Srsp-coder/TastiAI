import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";
import path from "path";
import { Groq } from "groq-sdk";
import { SarvamAIClient } from "sarvamai";
import { fileURLToPath } from "url";
import multer from "multer";
import wavConcat from "wav-concat";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fetch from "node-fetch";
import FormData from "form-data";
import dotenv from "dotenv";
dotenv.config(); // ✅ Loads .env variables
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

globalThis.fetch = fetch;
globalThis.FormData = FormData;

ffmpeg.setFfmpegPath(ffmpegPath);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());
app.use(express.json());
const upload = multer({ dest: "uploads/" });
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY, // ⚠️ Don't hardcode in production
});
const GROQ_API_KEY = process.env.GROQ_API_KEY; // ⚠️ WARNING: For demo only!

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY, // ✅ Replace this with your real key
});
app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    const inputPath = req.file.path;
    const outputPath = `${inputPath}.wav`;

    // 🎯 Convert uploaded audio to WAV using ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat("wav")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    console.log("✅ Converted to WAV:", outputPath);

    // 🧠 Use raw fetch instead of broken SDK
    const form = new FormData();
    form.append("file", fs.createReadStream(outputPath), {
      filename: "converted.wav",
      contentType: "audio/wav",
    });
    form.append("language_code", "en-IN");
    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": process.env.SARVAM_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("❌ STT failed:", response.status, errText);
      return res.status(500).json({ error: "STT failed", detail: errText });
    }

    const result = await response.json();
    console.log("✅ Full STT Response:", result);

    const transcription = result?.transcript || "Transcription not found";
    console.log("✅ Transcription:", transcription);

    res.json({ transcription });

    // 🧹 Cleanup
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  } catch (err) {
    console.error("❌ Transcription Error:", err.message);
    res
      .status(500)
      .json({ error: "Transcription failed", detail: err.message });
  }
});
app.post("/tts", async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({ error: "Text is required for TTS." });
  }

  const CHUNK_SIZE = 300;
  const splitText = (str) => {
    const chunks = [];
    let remaining = str.trim();
    while (remaining.length > 0) {
      let chunk = remaining.slice(0, CHUNK_SIZE);
      const lastPeriod = chunk.lastIndexOf(".");
      if (lastPeriod > 100) chunk = chunk.slice(0, lastPeriod + 1);
      chunks.push(chunk.trim());
      remaining = remaining.slice(chunk.length).trim();
    }
    return chunks;
  };

  try {
    const chunks = splitText(text);
    const audioPaths = [];

    for (let i = 0; i < chunks.length; i++) {
      const response = await sarvamClient.textToSpeech.convert({
        text: chunks[i],
        model: "bulbul:v2",
        speaker: "vidya",
        target_language_code: "en-IN",
        pace: "0.7",
      });

      const audioData = response.audios?.[0];
      if (!audioData) throw new Error("No audio returned for chunk");

      const buffer = Buffer.from(audioData, "base64");
      const audioDir = path.join(__dirname, "audios");
      fs.mkdirSync(audioDir, { recursive: true });

      const filePath = path.join(audioDir, `chunk_${i}_${Date.now()}.wav`);
      fs.writeFileSync(filePath, buffer);
      audioPaths.push(filePath);
    }

    // Create concat list file
    const concatListPath = path.join(
      __dirname,
      "audios",
      `list_${Date.now()}.txt`
    );
    const concatListContent = audioPaths.map((p) => `file '${p}'`).join("\n");
    fs.writeFileSync(concatListPath, concatListContent);

    // Merge using ffmpeg
    const outputPath = path.join(
      __dirname,
      "audios",
      `merged_${Date.now()}.wav`
    );
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions("-f", "concat", "-safe", "0")
        .outputOptions("-c", "copy")
        .on("end", resolve)
        .on("error", reject)
        .save(outputPath);
    });

    // Cleanup
    setTimeout(() => {
      for (const file of [...audioPaths, concatListPath]) {
        fs.unlink(file, () => {});
      }
    }, 15000);

    res.sendFile(outputPath, () => {
      setTimeout(() => fs.unlink(outputPath, () => {}), 60000);
    });
  } catch (error) {
    console.error("TTS backend error:", error.message);
    res.status(500).json({ error: "TTS failed to process long input." });
  }
});

app.post("/chat", async (req, res) => {
  let prompt = req.body.prompt;
  // const imageUrl = req.body.imageUrl;
  console.log("Prompt:", prompt);
  // console.log("Image URL:", imageUrl);
  try {
    const langDetectRes = await fetch("https://api.sarvam.ai/text-lid", {
      method: "POST",
      headers: {
        "api-subscription-key": process.env.SARVAM_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: prompt }),
    });

    const langData = await langDetectRes.json();
    const detectedLang = langData?.language_code || "en";
    console.log("Detected language:", detectedLang);

    if (detectedLang !== "en-IN") {
      const translateRes = await fetch("https://api.sarvam.ai/translate", {
        method: "POST",
        headers: {
          "api-subscription-key": process.env.SARVAM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: prompt,
          source_language_code: detectedLang,
          target_language_code: "en-IN",
        }),
      });

      const translatedData = await translateRes.json();
      prompt = translatedData?.translated_text || prompt;
      console.log("Translated to English:", prompt);
    }
  } catch (err) {
    console.error("Language processing failed:", err.message);
  }
  const system_prompt = `You are a smart meal planner assistant for a grocery shopping app like Walmart.

Your job is to understand any user request related to meal planning and suggest meals accordingly. You can handle:
- single meals (e.g., only dinner for today),
- daily plans (e.g., breakfast/lunch/dinner for tomorrow, for today),
- multi-day plans (e.g., full 3-day or 7-day meal plans),
- dietary preferences (e.g., vegetarian, high protein),
- budget constraints or quick meals.

You must always return your response in the following strict **JSON format**:
{
  "meal_plan": {
    "Day Label (like Today, Monday, Tomorrow)": {
      "Breakfast": "...",  
      "Lunch": "...",      
      "Dinner": "..."      
    },
    ...
  },
  "ingredients": [
    "List of raw ingredients needed for all meals, each as a unique string with no repetition"
  ]
}

Guidelines:
- Return only the meals the user asked for (e.g., if user asks only for dinner, do not return breakfast/lunch).
- Avoid repeating meals already shown earlier (you’ll receive a list of dishes to avoid).
- Choose dishes that are common, simple, affordable, and grocery-store friendly.
- Do NOT return recipes or instructions — just dish names and required ingredients.
- Do NOT include greetings, explanations, or markdown — return only a single raw JSON object.

Strict JSON Rules:
- Do NOT wrap any values in extra quotes (e.g., use "Yogurt Parfait", NOT ""Yogurt Parfait"").
- All keys and values must use standard double quotes (") only.
- Day labels like "Monday", "Tuesday", etc., must not have extra whitespace or quotes.
- Never use backslashes, escaped characters, or any invalid symbols inside keys/values.
- Ensure the output can be parsed using JSON.parse() in JavaScript without error.
- Do NOT return code blocks, markdown, or any trailing text — only a raw JSON object.
- Each ingredient must be a unique, plain string — no nesting or formatting.
- DO NOT include newline characters or line breaks **inside** values.

If the user asks something unrelated to meal planning, respond exactly with:
"Sorry I can't help you with that, I am here to help you with planning your meal."

Example answer:
{
  "meal_plan": {
    "Today": {
      "Dinner": "Grilled Paneer Wrap"
    }
  },
  "ingredients": [
    "Paneer", "Whole Wheat Wrap", "Lettuce", "Onion", "Tomato", "Yogurt"
  ]
}`;

  const userContent = [];

  if (prompt) {
    userContent.push({ type: "text", text: prompt });
  }

  // if (imageUrl) {
  //   userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  // }
  if (userContent.length === 0) {
    return res.status(400).json({ error: "A Prompt is required." });
  }
  try {
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: system_prompt },
        {
          role: "user",
          content: userContent,
        },
      ],
    });
    let content = response.choices[0].message.content.trim();

    // Remove Markdown code blocks if present
    if (content.startsWith("```")) {
      content = content
        .replace(/```[a-z]*\n?/gi, "")
        .replace(/```$/, "")
        .trim();
    }

    // Sanitize content before sending it to frontend
    const sanitizeJsonString = (input) => {
      return input
        .replace(/,(\s*[}\]])/g, "$1") // Remove trailing commas
        .replace(/“|”/g, '"') // Replace smart quotes
        .replace(/(\w+)\s*:/g, '"$1":'); // Ensure keys are quoted (use with care)
    };

    let sanitized = sanitizeJsonString(content);

    // Validate JSON
    try {
      const parsed = JSON.parse(sanitized); // ensures it's valid JSON
      return res.json({ message: JSON.stringify(parsed, null, 2) }); // well-formatted
    } catch (err) {
      console.warn("❌ JSON Parse Failed, sending raw string.");
      return res.json({ message: sanitized }); // fallback if still broken
    }
  } catch (err) {
    console.error("Groq API error:", err.message);
    res.status(500).json({
      error:
        err.response?.status === 503
          ? "Service is temporarily unavailable. Please try again shortly."
          : "An unexpected error occurred.",
    });
  }
});
app.post("/api/grocery-search", async (req, res) => {
  const { ingredients } = req.body;

  if (!ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: "Invalid ingredients array." });
  }

  try {
    const results = [];

    for (const ing of ingredients) {
      const ingredient = ing.trim().toLowerCase();
      let matchedItem = null;

      // First try: match sub_category exactly
      const { data: subCategoryMatch, error: subError } = await supabase
        .from("Groceries")
        .select("id, image_url, name")
        .eq("sub_category", ingredient)
        .limit(1);

      if (subError) throw subError;

      if (subCategoryMatch && subCategoryMatch.length > 0) {
        matchedItem = subCategoryMatch[0];
      }

      // Second try: fuzzy match with name using ilike
      if (!matchedItem) {
        const { data: fuzzyMatch, error: fuzzyError } = await supabase
          .from("Groceries")
          .select("id, image_url, name")
          .ilike("name", `%${ingredient}%`)
          .limit(1);

        if (fuzzyError) throw fuzzyError;

        if (fuzzyMatch && fuzzyMatch.length > 0) {
          matchedItem = fuzzyMatch[0];
        }
      }

      results.push({
        ingredient: ing,
        product: matchedItem || null,
      });
    }

    res.json({ matches: results });
  } catch (err) {
    console.error("Supabase fetch error:", err.message);
    res.status(500).json({ error: "Failed to fetch grocery data." });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
