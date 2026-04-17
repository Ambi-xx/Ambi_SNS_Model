import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
}

export interface GenerationResult {
  zh: GeneratedPost;
  en: GeneratedPost;
  ja: GeneratedPost;
}

export async function generatePropertyPosts(
  text: string,
  images: string[] // Base64 strings
): Promise<GenerationResult> {
  const model = "gemini-3-flash-preview";
  
  const imageParts = images.map((base64) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.split(",")[1],
    },
  }));

  const systemPrompt = `You are a professional real estate marketing expert. 
Based on the provided property information (images and text), generate compelling social media posts for Instagram/Facebook.
The information might be in Simplified Chinese, English, or Japanese.
You must extract the key selling points (location, price, features, amenities) and generate posts in THREE languages: 
1. Simplified Chinese (zh)
2. English (en)
3. Japanese (ja)

For each language, provide:
- A catchy title
- Engaging body text (using emojis appropriate for social media)
- A list of relevant hashtags

Output format: JSON exactly matching this structure:
{
  "zh": { "title": "...", "content": "...", "hashtags": ["...", "..."] },
  "en": { "title": "...", "content": "...", "hashtags": ["...", "..."] },
  "ja": { "title": "...", "content": "...", "hashtags": ["...", "..."] }
}`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { text: systemPrompt },
        { text: `Property Description Source: ${text}` },
        ...imageParts,
      ],
    },
    config: {
      responseMimeType: "application/json",
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("JSON Parse Error", e);
    throw new Error("Failed to parse AI response");
  }
}
