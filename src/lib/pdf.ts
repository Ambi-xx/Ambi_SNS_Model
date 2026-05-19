import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

// Set up the local worker port to handle PDF operations securely
try {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();
} catch (e) {
  console.warn("Failed to initialize native PDF worker, falling back to CDN worker Src", e);
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

export async function pdfToImages(file: File): Promise<string[]> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const imageUrls: string[] = [];

    // Limit to first 3 pages if it's very long, 3 is standard for flyers
    for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
      const page = await pdf.getPage(i);
      
      // Use constrained scale to keep image dimensions reasonable (approx 1024px width max)
      const originalViewport = page.getViewport({ scale: 1.0 });
      const maxDim = 1024;
      const scale = Math.min(maxDim / originalViewport.width, maxDim / originalViewport.height, 1.0);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
        // Output at 0.4 quality to heavily compress the file size, making it upload instantly
        // 0.4 is still very readable for Gemini Vision
        imageUrls.push(canvas.toDataURL('image/jpeg', 0.4));
      }
    }

    return imageUrls;
  } catch (error) {
    console.error("pdfToImages error:", error);
    return [];
  }
}
