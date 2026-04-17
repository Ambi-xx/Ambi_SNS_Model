import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

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

export type GenerationMode = 'property' | 'life';

export async function generateSocialPosts(
  text: string,
  images: string[], // Base64 strings
  mode: GenerationMode = 'property'
): Promise<GenerationResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('API_KEY_MISSING');
  }
  const model = "gemini-3-flash-preview";
  
  const imageParts = images.map((base64) => ({
    inlineData: {
      mimeType: "image/jpeg",
      data: base64.split(",")[1],
    },
  }));

  const propertyPrompt = `You are a professional real estate marketing expert. 
Based on the provided property information (images and text), generate compelling social media posts for Instagram/Facebook.
Extract key selling points (location, price, features) and generate posts in THREE languages: Simplified Chinese (zh), English (en), and Japanese (ja).`;

  const lifePrompt = `You are a creative lifestyle blogger and thought leader. 
Based on the provided input (images and text/thoughts), generate engaging, relatable, and inspiring social media posts.
The vibe should be authentic, professional yet personal. Generate posts in THREE languages: Simplified Chinese (zh), English (en), and Japanese (ja).`;

  const systemPrompt = `${mode === 'property' ? propertyPrompt : lifePrompt}
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
        { text: `Input Context: ${text}` },
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
