import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size for base64 images
app.use(express.json({ limit: '50mb' }));

console.log("Server environment check:", {
  NODE_ENV: process.env.NODE_ENV,
  VERCEL: process.env.VERCEL,
  HAS_GEMINI_KEY: !!process.env.GEMINI_API_KEY
});

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in process.env");
}

// Lazy initialize AI client
let ai: GoogleGenAI | null = null;
function getAi() {
  if (!ai) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    
    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
      throw new Error("GEMINI_API_KEY is missing. Please set it in your environment variables (Vercel: Settings > Environment Variables).");
    }

    ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    hasApiKey: !!process.env.GEMINI_API_KEY,
    apiKeyLength: process.env.GEMINI_API_KEY?.length || 0
  });
});

app.post("/api/clean-pdf-text", async (req, res) => {
  try {
    const genAi = getAi();
    const { rawText, pageImages } = req.body;
    const model = "gemini-3-flash-preview";

    const systemPrompt = `You are an expert Japanese Real Estate Document and layout parser.
Your task is to take scrambled Japanese characters extracted from a multi-column PDF real estate flyer (マイソク) AND (if available) the exact visual rendering images of those flyer pages, and reconstruct them into a highly polished, clean, standard Japanese specifications list (物件概要事項).

EXPLANATION OF THE PROBLEM:
The raw string was extracted row-by-row across columns. Because of this, column names and headers (like "価格 間取り 所在地") are listed first, and their respective values (like "800万円 4LDK 小樽市山田町3番24") appear lines later. This creates a highly confusing, scrambled, disconnected mess.

HOW YOU SOLVE IT:
1. Visual Inspection (CRITICAL PRIORITY):
   If there are images provided, look at them with absolute care. You can visually correlate headers and values in their actual 2D coordinates.
   - For example, you can see if the "価格" and "800万円" are paired together, and "間取 4LDK" is paired together, and "土地 158.0㎡ (47.4坪)" is paired together.
   - Extract every single category and value correctly from the table visually!
2. Reference Match:
   Correlate what you see visually in the images with the provided "Scrambled Extracted Raw Text Reference" to verify you didn't miss any smaller texts or numbers.
3. No Hallucinations:
   Maintain all exact numbers, dates, areas (㎡/坪), prices, addresses, and accessory info. Do NOT guess or change any numbers.

Please structure the final output using a clean list with section titles using standard real estate terminology:

【物件名称】: (もしあれば、タイトルや画像に大きく記載されている物件の名称・アピール名)
【販売価格】: (例: 800万円)
【交通アクセス】: (例: JR「小樽」駅 徒歩15分、中央バス「市役所」停 徒歩4分)
【間取り】: (例: 4LDK)
【所在地】: (例: 北海道小樽市山田町3番24)
【土地面積】: (例: 158.0㎡ / 47.4 坪)
【建物面積】: (例: 99.79㎡ / 29.93 坪)
【建物構造・築年数】: (例: 木造2階建、昭和56年築)
【現況・引渡時期】: (例: 空室、即時)
【接道状況・制限】: (例: 南西側 7.27m公道に8.47m接道、都市計画：市街化区域、用途地域：近商、建ぺい率：80%、容積率：300%)
【設備・駐車場状況】: (例: 車種により駐車2台可能、都市ガス・灯油FF・灯油給湯等)
【周辺環境・学区等】: (例: 小樽市立稲穂小学校 徒歩9分、コープさっぽろ 徒歩13分など、画像内の「交通」「周辺環境」コラムから抽出)

formatting instruction:
- Write in a highly readable list format with line breaks.
- Ensure that every line is of the structure: "Category Name: Valued Data" (一種類型一個內容) representing exactly one type/category and its content.
- Do NOT output any assistant friendly notes (e.g., "Sure, here's the cleaned data:") or conversational preambles/conclusions. Return ONLY the reconstructed text block.`;

    const imageParts = pageImages && pageImages.length > 0
      ? pageImages.map((base64: string) => {
          const parts = base64.split(",");
          const dataPart = parts.length > 1 ? parts[1] : parts[0];
          return {
            inlineData: {
              mimeType: "image/jpeg",
              data: dataPart,
            },
          };
        })
      : [];

    const result = await genAi.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            ...imageParts,
            { text: `Scrambled Extracted Raw Text Reference:\n${rawText}` }
          ]
        }
      ],
      config: {
        temperature: 0.1,
      }
    });

    res.json({ text: result.text?.trim() || "" });
  } catch (error: any) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/generate-social-posts", async (req, res) => {
  try {
    const genAi = getAi();
    const { text, images, mode, style } = req.body;
    const model = "gemini-3-flash-preview";

    const imageParts = images.map((base64: string) => ({
      inlineData: {
        mimeType: "image/jpeg",
        data: base64.split(",")[1],
      },
    }));

    const propertyPrompt = `You are an expert Real Estate Analyst and Social Media Copywriter who hates generic AI-generated marketing.
Your goal is to parse the input details, images, or documents, automatically extract clean specifications and local variables, and generate a highly polished, human-written property listing.

You must output:
1. A refined, catchy **Property Title** (under 70 characters or 35 characters in JA/ZH) that focuses on highlight features (e.g. "Niseko Hotel Yotei: 5.4ha Site, 6-min walk to Shinkansen, Onsen Included").
2. A high-CTR, compelling **SEO Description** (under 160 characters or 80 characters in JA/ZH) that summarizes key features (e.g. "Hotel Yotei: 5.4ha prime development site in Kutchan, Niseko. 6-min walk to future Shinkansen station. 5-min drive to Hanazono & 10-min to Hirafu. High-yield hot springs onsite.").
3. An engaging, authentic "De-AI-fied" **SNS Promotion Copy** (set as the "content" block) using the style: ${style}. Avoid clichés like "Luxurious", "Dream home", "Perfectly situated", "Elevate". Speak with a personal viewpoint, punchy sentences, and genuine vibe.
4. Highly structured **Property Details & Introduction** (紹介内容) based on the input text:
   - "overview": Clean introduction summary of the development or purchase opportunity.
   - "location": Distance to stations, accessibility, nearby attractions, address if available.
   - "specifications": Land Area, Building Area, Property Type, Structure, Room capacity, etc.
   - "onsen": Information about Natural Hot Spring facilities, source details, temperatures, and flow rates (if mentioned in input; write "N/A" if definitely not applicable).
   - "infrastructure": Built history/renovations, upgrades (e.g., septic tank), and development suggestions.

STYLE GUIDELINES for "Human-like" (De-AI-fied) Content:
1. NO CLICHES: Do not use typical AI filler phrases or generic superlatives.
2. NATURAL FLOW: In all languages (English, Chinese, Japanese), adapt naturally to standard local listing terms (e.g. using 'tsubo' and 'm²' appropriately for Japan/Niseko, or 'ha' for acreage).
3. MULTILINGUAL PERFECTION: Ensure the Traditional/Simplified Chinese, Japanese, and English outputs are native and sound like they were written by humans.`;

    const lifePrompt = `You are a popular Lifestyle Influencer who is known for being authentic, vulnerable, and slightly witty.
Your goal is to take the uploaded photos and any minimal notes provided, and turn them into a high-engagement daily lifestyle post that feels like an authentic personal diary entry or a text message to a best friend.

STYLE GUIDELINES:
1. PHOTO-ONLY GENERATION: If the user uploaded a photo and did NOT write any description, look closely at the image elements (e.g., scenery, weather, cozy cafes, dining, items, faces) and write a beautiful, heartfelt story entirely from the perspective of someone experiencing that moment.
2. BE RAW & HUMAN: Use colloquialisms and natural punctuation. Avoid being overly formal, preachy, or "advertising" in a fake way. Speak in of-the-moment personal vibes.
3. NO CORPORATE SPEAK: Never use cliché intros like "Let's explore...", "In this fast-paced world...", or "Are you ready...".
4. MICRO-MOMENTS: Focus on one small sensory detail (e.g., the steam rising from a cup, local light filtering through the trees, a rustic wooden table) rather than broad generalizations.
5. ENGAGING COMMENTARY: Use rhetorical questions like "Is it just me, or...?", or confessional phrases like "The truth is...".

TONE Style: ${style}.`;

    const conceptPrompt = `You are a creative Real Estate Visionary and Copywriter.
Your goal is to build a professional property concept and promotion material from scratch OR from a floor plan image provided by the user.

USER CASE: The user might have NO data at all (only a vauge prompt), or just a Floor Plan image (平面図).
YOUR TASK:
1. DESIGN the project specs: If information is missing, use your reasoning to propose a standard, logical set of specifications that would match the scale described (e.g., if it's a 'compact condo', propose 1LDK, 35m², RC-structure).
2. VISUAL REASONING: If a floor plan is provided, look at it to identify the layout (e.g. "3 bedrooms, L-shaped kitchen, south-facing balcony") and include these highlights in the copy.
3. OUTPUT:
   - A compelling **Title**.
   - An **SEO Description**.
   - A descriptive, creative **SNS Copy** that paints a picture of living in this property.
   - Structured **Property Details** (Proffered/Planned specs).

STYLE: ${style}. Be creative, imaginative, yet remain realistic enough for a real estate listing.`;

    const systemPrompt = `${mode === 'property' ? propertyPrompt : mode === 'concept' ? conceptPrompt : lifePrompt}
For each language (zh, en, ja), generate the output in the matching JSON format.

${(mode === 'property' || mode === 'concept') ? `For property-related modes, output JSON MUST strictly follow this type structure:
{
  "zh": {
    "title": "物件名/标题 (within 35 Chinese characters)",
    "seoDescription": "SEO简介 (within 80 Chinese characters)",
    "content": "自然流动的SNS社交媒体推文/故事...",
    "hashtags": ["标签1", "标签2"],
    "propertyDetails": {
      "overview": "项目概览/简介...",
      "location": "地理位置与交通可达性...",
      "specifications": "物业规格与面積参数...",
      "onsen": "温泉/泉眼及涌出量信息 (若无则写 N/A)...",
      "infrastructure": "基础设施、改建履歴及开发潜力说明..."
    }
  },
  "en": {
    "title": "Property Title (within 70 characters)",
    "seoDescription": "SEO Description (within 160 characters)",
    "content": "Natural social media copy in English...",
    "hashtags": ["hashtag1", "hashtag2"],
    "propertyDetails": {
      "overview": "Overview of the property...",
      "location": "Location & Accessibility...",
      "specifications": "Property Specifications...",
      "onsen": "High-Yield Onsen (Natural Hot Springs) details (or N/A if none)...",
      "infrastructure": "Infrastructure & Remarks..."
    }
  },
  "ja": {
    "title": "物件名/タイトル (35文字以内)",
    "seoDescription": "SEOメタディスクリプション (80文字以内)",
    "content": "親しみやすく魅力的なSNS投稿テキスト/ストーリー...",
    "hashtags": ["タグ1", "タグ2"],
    "propertyDetails": {
      "overview": "物件の概要・紹介内容...",
      "location": "ロケーションとアクセス...",
      "specifications": "物件スペック・面積・構造など...",
      "onsen": "天然温泉情報・源泉・温度・湧出量など (なければ N/A)...",
      "infrastructure": "インフラ・改修履歴・備考・開発ポテンシャルなど..."
    }
  }
}` : `For 'life' mode, output JSON MUST follow this structure:
{
  "zh": { "title": "标题", "content": "内容文案...", "hashtags": ["...", "..."] },
  "en": { "title": "Title", "content": "Body text...", "hashtags": ["...", "..."] },
  "ja": { "title": "タイトル", "content": "本文...", "hashtags": ["...", "..."] }
}`}

Return ONLY a single valid JSON object. No markdown block wrapper, no leading or trailing text.`;

    const result = await genAi.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { text: `Input Context: ${text}` },
            ...imageParts,
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    let jsonText = result.text || "{}";
    // Strip markdown code blocks if present
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/^```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/^```\n?/, "").replace(/\n?```$/, "");
    }
    
    res.json(JSON.parse(jsonText));
  } catch (error: any) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function startServer() {
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

// For Vercel, we export the app
export default app;

if (process.env.NODE_ENV !== "production" || !process.env.VERCEL) {
  startServer().catch(err => {
    console.error("Server startup error:", err);
  });
}
