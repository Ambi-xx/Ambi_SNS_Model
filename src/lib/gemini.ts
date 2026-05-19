export interface PropertyDetails {
  overview?: string;
  location?: string;
  specifications?: string;
  onsen?: string;
  infrastructure?: string;
}

export interface AnalysisPoint {
  label: string;
  content: string;
}

export interface GeneratedPost {
  title: string;
  content: string;
  hashtags: string[];
  seoDescription?: string;
  visualSuggestion?: string;
  analysisPoints?: AnalysisPoint[];
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
    let errorMessage = 'Failed to clean PDF text';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      if (response.status === 413) {
        errorMessage = 'PDF too complex: The file content is too large for the server. (413 Payload Too Large)';
      } else {
        errorMessage = `Error ${response.status}: ${response.statusText}`;
      }
    }
    throw new Error(errorMessage);
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
    let errorMessage = 'Failed to generate social posts';
    try {
      const error = await response.json();
      errorMessage = error.error || errorMessage;
    } catch (e) {
      // If it's not JSON, it might be a 413 or other HTML error
      if (response.status === 413) {
        errorMessage = 'Upload failed: The files are too large for the server. (413 Payload Too Large)';
      } else {
        errorMessage = `Error ${response.status}: ${response.statusText}`;
      }
    }
    throw new Error(errorMessage);
  }

  return response.json();
}
