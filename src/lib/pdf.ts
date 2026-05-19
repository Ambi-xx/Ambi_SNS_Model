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
      // Use moderate scale of 1.0 (highly readable for Gemini layout parsing)
      const viewport = page.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({ canvasContext: context, viewport, canvas: canvas }).promise;
        // Output at 0.5 quality to heavily compress the file size, making it upload instantly
        imageUrls.push(canvas.toDataURL('image/jpeg', 0.5));
      }
    }

    return imageUrls;
  } catch (error) {
    console.error("pdfToImages error:", error);
    return [];
  }
}
