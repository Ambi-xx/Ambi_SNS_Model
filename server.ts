import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload size for base64 images
app.use(express.json({ limit: '50mb' }));

// Lazy initialize AI client
let ai: GoogleGenAI | null = null;
function getAi() {
  if (!ai) {
    const apiKey = (process.env.GEMINI_API_KEY || "").trim();
    
    if (!apiKey || apiKey === "undefined" || apiKey === "null" || apiKey === "") {
      throw new Error("GEMINI_API_KEY is missing. Please set it in your environment variables.");
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
    env: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL
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
【现況・引渡时期】: (例: 空室、即时)
【接道状况・制限】: (例: 南西側 7.27m公道に8.47m接道、都市計画：市街化区域、用途地域：近商、建ぺい率：80%、容積率：300%)
【設備・駐車場状況】: (例: 車種により駐車2台可能、都市ガス・灯油FF・灯油給湯等)
【周边环境・学区等】: (例: 小樽市立稲穂小学校 徒歩9分、コープさっぽろ 徒歩13分など、画像内の「交通」「周辺環境」コラムから抽出)

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

    const toneInstructions = {
      professional: "通过物件的信息角度，尽可能详尽的，诚实遵守原版物件信息进行转述，并为客人强调资产价值、地理优势和投资潜力。语气稳重、专业且具有说服力。",
      friendly: "侧重物件周边环境，营造生活气息，分享生活细节。想象你是在向好朋友推荐一个温馨的家，语气温柔、亲切，多描述周边的便利店、公园或季节性美景。",
      storyteller: "如果物件信息中包含历史、设计初衷 or 房东的故事，请敏锐提取并注入情感。通过讲故事的方式，生成一篇有背景、有温度、有灵魂的物件介绍。让读者能感受到房子的生命力。",
      minimalist: "极简风格。直接给出核心信息：物件名称、价格、面积、构造、建成日期等，不带多余修饰，保持清爽直観。"
    };

    const propertyPrompt = `You are an expert Real Estate Analyst and Social Media Copywriter.
Your goal is to transform property data into a highly compelling, HUMAN-WRITTEN social media post.

STYLE REQUIREMENT (${style}):
${toneInstructions[style as keyof typeof toneInstructions] || toneInstructions.professional}

GENERAL INSTRUCTIONS:
1. NO AI CLICHÉS: Absolute ban on phrases like "Step into a world of...", "Discover the perfect blend of...", "Conveniently located...", or repetitive usage of "Elevate".
2. HUMAN TOUCH: Write as if you have personally visited the property. Use specific sensory details found in the text or images.
3. STRUCTURE:
   - A refined, catchy Title (under 35 JA/ZH chars).
   - A high-CTR SEO Description (under 80 JA/ZH chars).
   - An engaging SNS Promotion Copy (the "content" block) that follows the chosen style.
4. DETAILED SPECS: Provide a highly structured "propertyDetails" object based on the input text. Include "overview", "location", "specifications", "onsen", and "infrastructure".

STYLE GUIDELINES:
- Write in a natural, native flow for Japanese, Chinese, and English.
- For Japan properties, use standard units like 'tsubo' alongside 'm²' where appropriate.
- Be precise with numbers (prices, areas, years).`;

    const topicPrompt = `You are a sophisticated Real Estate Columnist and Strategic Analyst.
Your goal is to take a raw topic and generate a "Topic-Inducing" social media post + 3 Deep Analysis Perspectives.

DEEP THINKING PROTOCOL:
1. TOPIC DECONSTRUCTION: Break the input into distinctive segments: Economic (Yen/Rates), Policy (Visa/Tax), and Lifestyle (Climate/Environment).
2. DATA-DRIVEN INSIGHTS: Use Search tools or background knowledge to find concrete "論拠" (e.g., Temperature gap between Bangkok and Niseko, or current Yen vs USD trend).
3. PURPOSEFUL STRATEGY: Do not be generic. Every post must nudge the reader towards "Hokkaido as a strategic choice".

PLATFORM-SPECIFIC RULES (Style: ${style}):
- IF STYLE IS "THREADS": Create a sharp, conversational hook followed by 3-4 distinct info blocks. Use a tone that invites discussion.
- IF STYLE IS "INSTAGRAM": Poetic imagery + concise, evocative text. Focus on the 'dream' of the property.

GENERAL GUIDELINES:
- BE PURPOSEFUL: Connect every topic to the "Why Hokkaido?" conclusion.
- MULTI-LINGUAL: Native-level flow in Japanese, Chinese, and English.`;

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

    let systemPrompt = "";
    if (mode === 'property') systemPrompt = propertyPrompt;
    else if (mode === 'concept') systemPrompt = conceptPrompt;
    else systemPrompt = topicPrompt;

    systemPrompt += `
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
      "location": "地理位置 with 交通可达性...",
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
}` : `For 'life' (topic) mode, output JSON MUST follow this structure:
{
  "zh": { 
    "title": "标题", "content": "核心推文内容...", "hashtags": ["...", "..."], "visualSuggestion": "建议配图描述...",
    "analysisPoints": [{ "label": "分析角度", "content": "背景与深度解析..." }]
  },
  "en": { 
    "title": "Title", "content": "Core copy...", "hashtags": ["...", "..."], "visualSuggestion": "Visual suggestion...",
    "analysisPoints": [{ "label": "Analysis angle", "content": "Analysis content..." }]
  },
  "ja": { 
    "title": "タイトル", "content": "本文案...", "hashtags": ["...", "..."], "visualSuggestion": "推奨ビジュアル...",
    "analysisPoints": [{ "label": "分析ポイント", "content": "深い分析情報..." }]
  }
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
        tools: mode === 'life' ? [{ googleSearch: {} }] : undefined,
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
    const { createServer } = await import("vite");
    const vite = await createServer({
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
