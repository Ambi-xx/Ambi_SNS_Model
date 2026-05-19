export interface PropertyDetails {
  overview?: string;
  location?: string;
  specifications?: string;
  onsen?: string;
  infrastructure?: string;
}

export interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  seoDescription?: string;
  propertyDetails?: PropertyDetails;
}

export interface GenerationResult {
  zh: GeneratedPost;
  en: GeneratedPost;
  ja: GeneratedPost;
}

export type GenerationMode = 'property' | 'life' | 'concept';
export type ToneStyle = 'professional' | 'friendly' | 'storyteller' | 'minimalist';

/**
 * Uses Gemini (via backend) to reconstruct chaotic/scrambled PDF table characters into a clean, formatted property register.
 */
export async function cleanAndStructurePdfText(rawText: string, pageImages?: string[]): Promise<string> {
  const response = await fetch('/api/clean-pdf-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rawText, pageImages }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to clean PDF text');
  }

  const data = await response.json();
  return data.text;
}

export async function generateSocialPosts(
  text: string,
  images: string[], // Base64 strings
  mode: GenerationMode = 'property',
  style: ToneStyle = 'storyteller'
): Promise<GenerationResult> {
  const response = await fetch('/api/generate-social-posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, images, mode, style }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate social posts');
  }

  return response.json();
}
