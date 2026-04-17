import { useState, useCallback, useMemo } from 'react';
import { useDropzone, DropzoneOptions } from 'react-dropzone';
import { 
  Building2, 
  Upload, 
  FileText, 
  Image as ImageIcon, 
  Languages, 
  Sparkles, 
  Instagram, 
  Send,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromPdf } from './lib/pdf';
import { generatePropertyPosts, GenerationResult } from './lib/gemini';

interface PropertyAsset {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text';
  content?: string;
}

export default function App() {
  const [assets, setAssets] = useState<PropertyAsset[]>([]);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'zh' | 'en' | 'ja'>('en');
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newAssets: PropertyAsset[] = await Promise.all(
      acceptedFiles.map(async (file) => {
        const id = Math.random().toString(36).substring(7);
        const type = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'text';
        let preview = '';
        let content = '';

        if (type === 'image') {
          preview = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          });
        } else if (type === 'pdf') {
          content = await extractTextFromPdf(file);
          preview = 'PDF_PLACEHOLDER';
        }

        return { id, file, preview, type, content };
      })
    );
    setAssets((prev) => [...prev, ...newAssets]);
  }, []);

  const dropzoneOptions: any = {
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt']
    },
    multiple: true
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions as any);

  const removeAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleGenerate = async () => {
    if (assets.length === 0 && !description) {
      setError('Please add some property information first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const images = assets.filter(a => a.type === 'image').map(a => a.preview);
      const extractedText = assets.filter(a => a.type === 'pdf').map(a => a.content).join('\n');
      const combinedText = `Description: ${description}\n\nExtracted from docs: ${extractedText}`;
      
      const response = await generatePropertyPosts(combinedText, images);
      setResults(response);
    } catch (err) {
      setError('Failed to generate posts. Please try again.');
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-brand-bg text-brand-text-main">
      {/* Sidebar */}
      <aside className="w-[240px] bg-brand-sidebar text-white p-6 flex flex-col gap-8 flex-shrink-0">
        <div className="logo-gradient font-extrabold text-xl tracking-tighter uppercase leading-none">
          OmniPost Real Estate
        </div>
        
        <nav className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-white/10 text-white text-sm font-medium cursor-pointer">
            <Building2 size={18} />
            Dashboard
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm font-medium cursor-pointer transition-colors">
            <ImageIcon size={18} />
            Assets Library
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm font-medium cursor-pointer transition-colors">
            <Languages size={18} />
            Translations
          </div>
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm font-medium cursor-pointer transition-colors">
            Settings
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-[1fr_340px] gap-6 p-6 overflow-hidden">
        {/* Workspace */}
        <div className="flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar">
          <header className="mb-2">
            <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-brand-primary" />
              Media & Content Intake
            </h3>
          </header>

          <section className="grid grid-cols-2 gap-4">
            <div 
              {...getRootProps()} 
              className={`bg-white border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragActive ? 'border-brand-primary bg-indigo-50' : 'border-brand-border hover:border-brand-primary hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              <div className="text-brand-primary mb-3">
                <Upload size={24} />
              </div>
              <h3 className="text-sm font-semibold">Upload Photos</h3>
              <p className="text-xs text-brand-text-muted mt-1">Smart Enhance Enabled</p>
            </div>

            <div 
              {...getRootProps()} 
              className="bg-white border-2 border-dashed border-brand-border rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-primary hover:bg-slate-50 transition-all"
            >
              <div className="text-brand-primary mb-3">
                <FileText size={24} />
              </div>
              <h3 className="text-sm font-semibold">Drop PDF/Docs</h3>
              <p className="text-xs text-brand-text-muted mt-1">CN / EN / JP OCR Ready</p>
            </div>
          </section>

          {/* Asset Preview List */}
          <AnimatePresence>
            {assets.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 mt-1">
                {assets.map((asset) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    key={asset.id} 
                    className="group relative aspect-square rounded-lg overflow-hidden bg-white border border-brand-border shadow-sm"
                  >
                    {asset.type === 'image' ? (
                      <img 
                        src={asset.preview} 
                        alt="preview" 
                        className={`w-full h-full object-cover transition-all duration-500 ${isEnhanced ? 'brightness-110 contrast-105 saturate-110' : ''}`}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                        <FileText size={20} className="text-brand-text-muted mb-1" />
                        <span className="text-[10px] text-brand-text-muted truncate w-full px-1">{asset.file.name}</span>
                      </div>
                    )}
                    <button 
                      onClick={() => removeAsset(asset.id)}
                      className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm shadow-md"
                    >
                      <Trash2 size={10} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* Input Panel */}
          <div className="bg-white rounded-xl border border-brand-border p-5 space-y-4 shadow-card">
             <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
              Processing Pipeline
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center gap-4 py-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-brand-primary font-bold">INFO</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">Auto Enhancement</div>
                  <div className="text-xs text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    {isEnhanced ? 'Active' : 'Standby'}
                  </div>
                </div>
                <button 
                  onClick={() => setIsEnhanced(!isEnhanced)}
                  className={`p-2 rounded-lg transition-colors ${isEnhanced ? 'bg-brand-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                >
                  <Sun size={16} />
                </button>
              </div>

              <div className="flex items-center gap-4 py-1">
                <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-brand-primary font-bold">GEN</span>
                <div className="flex-1">
                  <div className="text-sm font-medium">Instagram & Social Mockup</div>
                  <div className="text-xs text-brand-text-muted">Preview ready for 3 languages</div>
                </div>
              </div>

              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Paste property details, location, or key selling points here..."
                className="w-full min-h-[100px] p-4 bg-slate-50 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none font-medium"
              />
            </div>
          </div>

          {/* Action Bar */}
          <div className="mt-auto bg-white border border-brand-border p-4 rounded-xl shadow-card flex items-center justify-between">
            <div className="text-[12px] text-brand-text-muted">
              Ready to publish to <strong className="text-brand-text-main">Instagram, Twitter, FB</strong>
            </div>
            
            <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Processing...
                </>
              ) : (
                <>
                  Generate All Variants
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider mb-2">Live Preview</h3>
          
          {results ? (
            <div className="flex flex-col gap-6 flex-1 overflow-hidden">
              {/* Language Selector */}
              <div className="flex p-1 bg-white rounded-lg border border-brand-border shadow-sm w-full">
                {(['en', 'zh', 'ja'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveLanguage(lang)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all ${
                      activeLanguage === lang 
                        ? 'bg-brand-primary text-white shadow-sm' 
                        : 'text-brand-text-muted hover:bg-slate-50'
                    }`}
                  >
                    {lang.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Instagram Phone Mockup */}
              <motion.div 
                key={activeLanguage}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 bg-white rounded-[24px] border-[8px] border-slate-900 shadow-sleek overflow-hidden flex flex-col mb-4"
              >
                <div className="p-3 flex items-center gap-2 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 via-pink-500 to-indigo-600" />
                  <div className="text-[13px] font-bold">global_estates_pro</div>
                </div>

                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                  {assets.find(a => a.type === 'image') ? (
                    <img 
                      src={assets.find(a => a.type === 'image')?.preview} 
                      className={`w-full h-full object-cover ${isEnhanced ? 'brightness-110 contrast-105 saturate-110' : ''}`}
                      alt="Property" 
                    />
                  ) : (
                    <ImageIcon size={48} className="text-slate-200" />
                  )}
                </div>

                <div className="p-3 flex gap-4 border-b border-slate-50">
                  <span>❤️</span> <span>💬</span> <span>✈️</span>
                </div>

                <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden text-[13px] leading-relaxed select-text">
                  <div className="font-bold mb-1">{results[activeLanguage].title}</div>
                  <div className="text-slate-700 whitespace-pre-wrap">{results[activeLanguage].content}</div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {results[activeLanguage].hashtags.map((tag, i) => (
                      <span key={i} className="text-brand-primary font-semibold">#{tag.replace(/^#/, '')}</span>
                    ))}
                  </div>
                </div>

                <div className="p-3 mt-auto bg-slate-50 flex items-center justify-between">
                  <button 
                    onClick={() => copyToClipboard(`${results[activeLanguage].title}\n\n${results[activeLanguage].content}\n\n${results[activeLanguage].hashtags.map(t => '#' + t.replace(/^#/, '')).join(' ')}`)}
                    className="flex-1 bg-white border border-brand-border py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Copy size={14} />
                    Copy All
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            <div className="flex-1 bg-white/50 border-2 border-dashed border-brand-border rounded-[24px] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-brand-border mb-4 text-brand-text-muted">
                <Send size={24} />
              </div>
              <div className="text-sm font-bold mb-1">Live Preview</div>
              <div className="text-xs text-brand-text-muted">Generate a post to see how it looks on social media.</div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


