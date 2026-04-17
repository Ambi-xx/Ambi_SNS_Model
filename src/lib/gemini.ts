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
export type ToneStyle = 'professional' | 'friendly' | 'storyteller' | 'minimalist';

export async function generateSocialPosts(
  text: string,
  images: string[], // Base64 strings
  mode: GenerationMode = 'property',
  style: ToneStyle = 'storyteller'
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

  const propertyPrompt = `You are an expert Social Media Copywriter and Local Local Resident who hates generic AI-generated marketing.
Your goal is to transform property data into authentic, "human-written" stories that resonate with people's emotions.

STYLE GUIDELINES for "Human-like" (De-AI-fied) Content:
1. NO CLICHES: Avoid words like "Luxurious", "Dream home", "Perfectly situated", "Elevate", "Discover", "Unveiling".
2. PERSONAL VIEWPOINT: Use phrases like "I noticed...", "The best part about this place is...", "Imagine waking up here...".
3. VARIED SENTENCE STRUCTURE: Use short, punchy sentences. Don't start every paragraph with "This [property]...".
4. NO Subject-Verb-Adjective formulas. Talk like you're telling a friend over coffee.
5. LOCAL TRIVIA: If the location is provided, mention one specific vibe or detail that only a human would appreciate.

TONE: ${style} (adjust the depth of storytelling vs facts accordingly).`;

  const lifePrompt = `You are a popular Lifestyle Influencer who is known for being authentic, vulnerable, and slightly witty.
Your goal is to take minimal notes and turn them into a post that feels like a private diary entry or a text message to a best friend.

STYLE GUIDELINES:
1. BE RAW: Use colloquialisms. Avoid being overly formal or "inspiring" in a fake way.
2. NO CORPORATE SPEAK: No "Let's explore...", "In this fast-paced world...".
3. MICRO-MOMENTS: Focus on one small detail (the smell of coffee, the angle of the sun) rather than broad generalizations.
4. USE RHETORICAL QUESTIONS: "Is it just me, or...?", "The truth is...".

TONE: ${style}.`;

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
