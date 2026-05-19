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
  Sun,
  Coffee,
  Brain,
  Zap,
  Building,
  Layout,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromPdf, pdfToImages } from './lib/pdf';
import { resizeImage } from './lib/images';
import { generateSocialPosts, cleanAndStructurePdfText, GenerationResult, GenerationMode, ToneStyle } from './lib/gemini';

interface PropertyAsset {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text';
  content?: string;
  pdfPages?: string[];
}

const sampleNisekoProperty = `Hotel Yotei (ニセコ羊蹄ホテル)
Overview:
Presenting "Hotel Yotei," a massive 5.4-hectare development opportunity in the rapidly evolving Kutchan-Niseko area. Boasting an unbeatable location just a 6-minute walk from the upcoming Hokkaido Shinkansen station and within minutes of world-class ski resorts, this site is a premier candidate for a large-scale luxury hotel or branded residence project.

Location & Accessibility:
Future Shinkansen Station: 6-minute walk (Approx. 500m).
Niseko Hanazono Resort: 5-minute drive.
Niseko Mountain Resort Grand Hirafu: 10-minute drive.
Address: 68 Asahi, Kutchan-cho, Abuta-gun, Hokkaido.

Property Specifications:
Land Area: 54,216.43 ㎡ (approx. 16,400 tsubo).
Building Area: 1F: 1,426.95 ㎡ / 2F: 1,007.04 ㎡.
Property Type: Hotel / Development Land.
Structure: Steel-framed / Reinforced Concrete (RC).
Capacity: 21 Guest Rooms (Up to 100 guests).

High-Yield Onsen (Natural Hot Springs):
Two private hot spring sources provide an abundant supply for a large-scale spa or wellness facility:
Source 1: 25.1°C | Flow rate: 1,400 L/min.
Source 2: 50.0°C | Flow rate: 1,700 L/min.

Infrastructure & Remarks:
History: Built in 1970; major renovations and extensions completed in 2000.
Recent Upgrades: New septic tank (550-person capacity) installed in 2010.
Development Potential: The vast 5.4ha acreage and high-flow onsen sources make this one of the most significant redevelopment sites currently available in the Kutchan station vicinity.`;

export default function App() {
  const [selectedFlow, setSelectedFlow] = useState<GenerationMode | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'translations'>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [assets, setAssets] = useState<PropertyAsset[]>([]);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'zh' | 'en' | 'ja'>('ja');
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('property');
  const [style, setStyle] = useState<ToneStyle>('storyteller');
  const [previewMode, setPreviewMode] = useState<'sns' | 'portal'>('sns');
  const [history, setHistory] = useState<(GenerationResult & { id: string, timestamp: number, mode: GenerationMode, style: ToneStyle })[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [selectedPdfId, setSelectedPdfId] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState<'overwrite' | 'append' | null>(null);

  const triggerSuccessAnimation = useCallback((type: 'overwrite' | 'append') => {
    setSuccessAnimation(type);
    setTimeout(() => {
      setSuccessAnimation(null);
    }, 2000);
  }, []);

  const switchMode = useCallback((newMode: GenerationMode) => {
    setMode(newMode);
    setSelectedFlow(newMode);
    setAssets([]);
    setDescription('');
    setError(null);
    setSelectedPdfId(null);
    setSuccessAnimation(null);
  }, []);

  const handleStructurePdfText = useCallback(async () => {
    const currentId = selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id;
    if (!currentId) return;

    const pdfAsset = assets.find(a => a.id === currentId);
    if (!pdfAsset || !pdfAsset.content) return;

    setIsStructuring(true);
    setError(null);
    try {
      const structuredResult = await cleanAndStructurePdfText(pdfAsset.content, pdfAsset.pdfPages);
      setAssets((prev) => 
        prev.map((asset) => asset.id === currentId ? { ...asset, content: structuredResult } : asset)
      );
    } catch (err: any) {
      console.error(err);
      setError('AIによる物件データの構造化・整理に失敗しました。');
    } finally {
      setIsStructuring(false);
    }
  }, [selectedPdfId, assets]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsParsing(true);
    setError(null);
    try {
      const newAssets: PropertyAsset[] = await Promise.all(
        acceptedFiles.map(async (file) => {
          const id = Math.random().toString(36).substring(7);
          const type = file.type.startsWith('image/') ? 'image' : file.type === 'application/pdf' ? 'pdf' : 'text';
          let preview = '';
          let content = '';
          let pdfPages: string[] = [];

          if (type === 'image') {
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.readAsDataURL(file);
            });
            // Resize image to max 1024px to stay under Vercel payload limits
            preview = await resizeImage(base64, 1024, 1024, 0.6);
          } else if (type === 'pdf') {
            content = await extractTextFromPdf(file);
            preview = 'PDF_PLACEHOLDER';
            try {
              pdfPages = await pdfToImages(file);
            } catch (err) {
              console.warn('Failed to render PDF pages as images:', err);
            }
          }

          return { id, file, preview, type, content, pdfPages };
        })
      );

      // Auto-focus the first uploaded PDF if any exists
      const firstNewPdf = newAssets.find(a => a.type === 'pdf');
      if (firstNewPdf) {
        setSelectedPdfId(firstNewPdf.id);
      }

      setAssets((prev) => [...prev, ...newAssets]);
    } catch (err: any) {
      console.error(err);
      setError('PDFの解析に失敗しました。ファイルをもう一度ご確認ください。');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const dropzoneOptions = useMemo(() => ({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'image/*': ['.jpeg', '.jpg', '.png', '.webp']
    },
    multiple: true
  }), [onDrop]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone(dropzoneOptions as any);

  const removeAsset = (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  };

  const handleGenerate = async () => {
    if (mode !== 'concept' && assets.length === 0 && !description) {
      setError('まずは情報を入力するか、ファイルをアップロードしてください。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const images = assets.filter(a => a.type === 'image').map(a => a.preview);
      const extractedText = assets.filter(a => a.type === 'pdf').map(a => a.content).join('\n');
      const combinedText = `Description: ${description}\n\nExtracted from docs: ${extractedText}`;
      
      const response = await generateSocialPosts(combinedText, images, mode, style);
      setResults(response);
      setPreviewMode(mode === 'property' ? 'portal' : 'sns');
      setHistory(prev => [{ ...response, id: Math.random().toString(36).substring(7), timestamp: Date.now(), mode, style }, ...prev]);
    } catch (err: any) {
      if (err.message === 'API_KEY_MISSING') {
        setError('APIキーが設定されていません。GitHub的フォーク設定 > SecretsでGEMINI_API_KEYを設定してください。');
      } else {
        setError('生成に失敗しました。もう一度お試しください。');
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResultUpdate = useCallback((lang: 'zh' | 'en' | 'ja', field: string, value: any, subfield?: string) => {
    setResults(prev => {
      if (!prev) return null;
      const newResults = { ...prev };
      const langData = { ...newResults[lang] };
      
      if (subfield && langData.propertyDetails) {
        const details = { ...langData.propertyDetails };
        (details as any)[subfield] = value;
        langData.propertyDetails = details;
      } else {
        (langData as any)[field] = value;
      }
      
      newResults[lang] = langData;
      return newResults;
    });
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (selectedFlow === null) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white relative p-6 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.12)_0%,transparent_70%)] pointer-events-none" />
        <div className="absolute top-[-10%] left-[-10%] w-[45%] aspect-square rounded-full bg-indigo-500/8 blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[45%] aspect-square rounded-full bg-cyan-500/8 blur-[100px] pointer-events-none animate-pulse" />

        <div className="z-10 text-center mb-10 max-w-2xl px-4 flex flex-col items-center">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-indigo-300 text-xs font-bold mb-4 uppercase tracking-wider shadow-inner"
          >
            <Sparkles size={12} className="text-indigo-400" />
            OmniPost AI Studio
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-100 bg-clip-text text-transparent mb-4"
          >
            作成する投稿のテンプレートを選択
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-slate-400"
          >
            作成したい投稿のカテゴリーに合わせてお選びください。専用のAI最適化プロンプトがロードされます。
          </motion.p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 w-full max-w-6xl z-10 px-4">
          {/* Card 1: Property Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={() => {
              setSelectedFlow('property');
              setMode('property');
            }}
            className="group relative bg-slate-900/40 border border-slate-800 rounded-3xl p-8 cursor-pointer hover:border-indigo-500 hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_40px_rgba(79,70,229,0.15)] h-[350px]"
          >
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300">
                <FileText size={28} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">物件資料解析</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold uppercase">PDF解析</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  マイソクや重要事項説明書などのPDFから物件スペックをAIが自動抽出。多言語コピーを高速生成します。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 group-hover:text-indigo-300 pt-4 border-t border-slate-800/50 mt-4">
              既存の資料から作成 →
            </div>
          </motion.div>

          {/* Card 2: AI Planning (NEW) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => {
              setSelectedFlow('concept');
              setMode('concept');
            }}
            className="group relative bg-slate-900/40 border border-slate-800 rounded-3xl p-8 cursor-pointer hover:border-emerald-500 hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_40px_rgba(16,185,129,0.15)] h-[350px]"
          >
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all duration-300">
                <Sparkles size={28} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-emerald-300 transition-colors">AI物件着想・ドラフト</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">0から作成</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  資料がない場合や平面図しかない場合、AIがプロンプトから魅力的な物件コンセプトを提案・構成します。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 group-hover:text-emerald-300 pt-4 border-t border-slate-800/50 mt-4">
              アイデア・平面図から作成 →
            </div>
          </motion.div>

          {/* Card 3: Lifestyle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => {
              setSelectedFlow('life');
              setMode('life');
            }}
            className="group relative bg-slate-900/40 border border-slate-800 rounded-3xl p-8 cursor-pointer hover:border-cyan-500 hover:bg-slate-900/80 transition-all duration-300 flex flex-col justify-between hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] h-[350px]"
          >
            <div className="space-y-5">
              <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-white transition-all duration-300">
                <Coffee size={28} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white group-hover:text-cyan-300 transition-colors">日常ライフスタイル</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">写真連動</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  日常の写真から情感豊かなメッセージを生成。個人のブランディングやSNS運営をサポートします。
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 group-hover:text-cyan-300 pt-4 border-t border-slate-800/50 mt-4">
              写真から投稿を作成 →
            </div>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-xs text-slate-500 mt-12 z-10 font-medium"
        >
          ※ 設定はアプリ内のダッシュボードや、サイドメニューからいつでも切り替えることができます。
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen lg:h-screen w-full overflow-x-hidden lg:overflow-hidden bg-brand-bg text-brand-text-main relative">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 z-[60] lg:hidden backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-[210px] bg-brand-sidebar text-white p-5 flex flex-col gap-6 flex-shrink-0 transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-between lg:block">
          <div 
            onClick={() => {
              setSelectedFlow(null);
              setIsSidebarOpen(false);
            }}
            className="logo-gradient font-black text-xl tracking-tighter uppercase leading-none cursor-pointer hover:opacity-85 transition-opacity flex items-center gap-2"
          >
            <Sparkles size={18} className="text-brand-primary shrink-0" />
            <span className="truncate">OmniPost AI</span>
          </div>
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 lg:hidden text-slate-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
        </div>
        
        <nav className="flex flex-col gap-1.5">
          <button 
            onClick={() => {
              setActiveTab('dashboard');
              setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all ${
              activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Building2 size={16} />
            ダッシュボード
          </button>
          <button 
            onClick={() => {
              setActiveTab('assets');
              setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all ${
              activeTab === 'assets' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ImageIcon size={16} />
            アセット
          </button>
          <button 
            onClick={() => {
              setActiveTab('translations');
              setIsSidebarOpen(false);
            }}
            className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-[13px] font-medium cursor-pointer transition-all ${
              activeTab === 'translations' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Languages size={16} />
            翻訳履歴
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white text-sm font-medium cursor-pointer transition-colors">
            設定
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-0 lg:h-full">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b border-brand-border flex items-center justify-between px-4 shrink-0 transition-all z-50">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Layout size={20} />
          </button>
          <div 
            onClick={() => setSelectedFlow(null)}
            className="logo-gradient font-black text-lg tracking-tighter uppercase leading-none cursor-pointer"
          >
            OmniPost AI
          </div>
          <div className="w-9" /> {/* Spacer for centering */}
        </header>

        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-4 p-3 md:p-4 lg:overflow-hidden relative lg:custom-scrollbar">
        {/* Workspace */}
        <div className="flex flex-col gap-4 lg:overflow-y-auto lg:pr-2 custom-scrollbar text-brand-text-main shrink-0">
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-4 lg:h-full"
            >
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-[11px] font-bold text-brand-text-muted uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={13} className={mode === 'property' ? 'text-indigo-500' : mode === 'concept' ? 'text-emerald-500' : 'text-cyan-500'} />
                  {mode === 'property' ? '物件解析' : mode === 'concept' ? 'AI物件着想' : 'ライフスタイル'}
                </h3>
                
                <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                  {/* Mode Toggles */}
                  <div className="flex p-0.5 bg-brand-border/50 rounded-lg shrink-0">
                    <button 
                      onClick={() => switchMode('property')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        mode === 'property' ? 'bg-brand-primary text-white shadow-sm' : 'text-brand-text-muted hover:bg-slate-100'
                      }`}
                    >
                      資料解析
                    </button>
                    <button 
                      onClick={() => switchMode('concept')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        mode === 'concept' ? 'bg-emerald-600 text-white shadow-sm' : 'text-brand-text-muted hover:bg-slate-100'
                      }`}
                    >
                      着想・ドラフト
                    </button>
                    <button 
                      onClick={() => switchMode('life')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                        mode === 'life' ? 'bg-cyan-600 text-white shadow-sm' : 'text-brand-text-muted hover:bg-slate-100'
                      }`}
                    >
                      ライフ
                    </button>
                  </div>

                  <div className="h-6 w-[1px] bg-brand-border/60 mx-1" />

                  {/* Tone Styles */}
                  <div className="flex gap-1 items-center shrink-0">
                    {[
                      { id: 'professional', label: 'プロフェッショナル', icon: <Building2 size={12} /> },
                      { id: 'friendly', label: 'フレンドリー', icon: <Coffee size={12} /> },
                      { id: 'storyteller', label: 'ストーリーテラー', icon: <Brain size={12} /> },
                      { id: 'minimalist', label: 'ミニマリスト', icon: <Zap size={12} /> },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setStyle(t.id as ToneStyle)}
                        title={t.label}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all ${
                          style === t.id 
                            ? 'bg-white border-brand-primary/30 text-brand-primary shadow-sm' 
                            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t.icon}
                        <span className="text-[10px] font-bold tracking-tight">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </header>

              <section className="w-full" id="upload-zone">
                {mode === 'property' ? (
                  <div 
                    {...getRootProps()} 
                    id="pdf-dropzone"
                    className={`bg-white border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50/5 transition-all w-full focus:outline-none ${
                      isDragActive ? 'border-indigo-500 bg-indigo-50/10' : 'border-brand-border'
                    } ${isParsing ? 'pointer-events-none opacity-80' : ''}`}
                  >
                    <input {...getInputProps()} disabled={isParsing} />
                    {isParsing ? (
                      <div className="flex flex-col items-center justify-center py-2">
                        <Loader2 className="animate-spin text-indigo-600 mb-2" size={24} />
                        <h3 className="text-xs font-bold text-slate-800">資料解析中...</h3>
                      </div>
                    ) : (
                      <>
                        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 mb-2">
                          <FileText size={20} />
                        </div>
                        <h3 className="text-xs font-bold text-slate-800 tracking-tight">物件PDF資料をアップロード</h3>
                        <p className="text-[10px] text-slate-400 mt-1">マイソク・重説などの PDFを直接分析</p>
                      </>
                    )}
                  </div>
                ) : mode === 'concept' ? (
                  <div 
                    {...getRootProps()} 
                    id="concept-dropzone"
                    className={`bg-white border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/5 transition-all w-full focus:outline-none ${
                      isDragActive ? 'border-emerald-500 bg-emerald-50/10' : 'border-brand-border'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 mb-2">
                      <ImageIcon size={20} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 tracking-tight">平面図またはコンセプト画像</h3>
                    <p className="text-[10px] text-slate-400 mt-1">画像から間取りを認識し、プランを提案します</p>
                    <div className="mt-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-full text-emerald-600 text-[9px] font-bold">
                      任意アップロード
                    </div>
                  </div>
                ) : (
                  <div 
                    {...getRootProps()} 
                    id="life-dropzone"
                    className={`bg-white border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-50/5 transition-all w-full focus:outline-none ${
                      isDragActive ? 'border-cyan-500 bg-cyan-50/10' : 'border-brand-border'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-500 mb-2">
                      <ImageIcon size={20} />
                    </div>
                    <h3 className="text-xs font-bold text-slate-800 tracking-tight">日常スナップ写真をアップロード</h3>
                    <p className="text-[10px] text-slate-400 mt-1">シーン解析からのエモーショナル生成</p>
                  </div>
                )}
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
                        className={`group relative aspect-square rounded-lg overflow-hidden bg-white border shadow-sm ${
                          mode === 'property' ? 'border-indigo-200' : 'border-cyan-200'
                        }`}
                      >
                        {asset.type === 'image' ? (
                          <img 
                            src={asset.preview} 
                            alt="preview" 
                            className={`w-full h-full object-cover transition-all duration-500 ${isEnhanced ? 'brightness-110 contrast-105 saturate-110' : ''}`}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-brand-text-main">
                            <FileText size={20} className="text-indigo-400 mb-1" />
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

              {/* Hidden Processing Pipeline as per user request */}
              {mode === 'property' && assets.some(a => a.type === 'pdf') ? (
                    <div className="border border-brand-border rounded-xl overflow-hidden space-y-4">
                      {/* Section banner explaining the 2-Window workspace */}
                      <div className="bg-gradient-to-r from-indigo-50/60 via-slate-50 to-indigo-50/60 p-4 border-b border-indigo-100/60 text-slate-800 flex items-start gap-3">
                        <div className="bg-indigo-100 text-indigo-700 p-2 rounded-lg mt-0.5 shrink-0">
                          <FileText size={18} />
                        </div>
                        <div className="flex-grow">
                          <h4 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                             PDFデータ抽出・推敲ワークスペース（2画面構成）
                          </h4>
                          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                            【窓①】に自動抽出された物件の元の文字データが表示されます。文字化けや抜け落ちがないか<strong>内容の過不足を確認して直接修正</strong>したあとに、緑色や青色のボタンを選んで【窓②（物件情報テンプレート）】に<strong>テンプレートへ適用</strong>してください。
                          </p>
                        </div>
                      </div>

                      {/* PDF Choose Tabs */}
                      <div className="px-4 pt-1 flex flex-wrap gap-2 items-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">PDFファイル選択:</span>
                        {assets.filter(a => a.type === 'pdf').map((pdfAsset) => {
                          const isSelected = selectedPdfId === pdfAsset.id || (!selectedPdfId && assets.filter(a => a.type === 'pdf')[0]?.id === pdfAsset.id);
                          const countOfChars = pdfAsset.content?.length || 0;
                          return (
                            <button
                              key={pdfAsset.id}
                              type="button"
                              onClick={() => setSelectedPdfId(pdfAsset.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border outline-none cursor-pointer ${
                                isSelected 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-extrabold'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-indigo-50/50 hover:text-indigo-600'
                              }`}
                            >
                              <FileText size={12} className={isSelected ? 'text-white' : 'text-indigo-500'} />
                              <span className="max-w-[200px] truncate">{pdfAsset.file.name}</span>
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-500'}`}>
                                {countOfChars}文字 抽出済み
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Side-by-side or stacked Workspace Windows */}
                      <div className="px-4 pb-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                        {/* Windows 1: Extracted raw text previewer & editor */}
                        <div className="flex flex-col bg-slate-50 rounded-xl border border-brand-border overflow-hidden shadow-sm">
                          <header className="flex items-center justify-between bg-slate-100 px-3 py-2 border-b border-brand-border text-[11px] font-extrabold text-slate-700">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              <span>【窓①】PDF自動抽出データ (内容確認・直接修正用)</span>
                            </div>
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded uppercase font-extrabold tracking-wider">
                              RAW DATA
                            </span>
                          </header>

                          {/* Editable container */}
                          <div className="p-3 bg-white flex flex-col flex-grow">
                            {/* AI Restructuring Action Block */}
                            <div className="mb-3.5 bg-gradient-to-r from-indigo-50 to-purple-50/50 border border-indigo-100/80 rounded-xl p-3 flex flex-col items-center justify-between gap-3 lg:flex-row">
                              <div className="flex items-start gap-2.5">
                                <div className="bg-indigo-100 text-indigo-700 p-1.5 rounded-lg shrink-0 text-xs">
                                  <Brain size={14} className="animate-pulse" />
                                </div>
                                <div>
                                  <div className="text-[11px] font-extrabold text-indigo-950 flex items-center gap-1.5">
                                     PDF内の文字配置が乱れて読みにくいですか？
                                    <span className="bg-amber-100 text-amber-800 text-[9px] px-1 py-0.2 rounded font-bold">推奨</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 leading-normal mt-0.5">
                                    段組みや表形式のPDFは、文字の並び順が崩れて抽出されます。下のボタンを押すと、AIが元の「項目名」と「物件仕様」を正確に読み取り、きれいな台帳・一覧形式に自動整理します。
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleStructurePdfText}
                                disabled={isStructuring}
                                className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm border-none cursor-pointer text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 active:scale-95 disabled:pointer-events-none disabled:opacity-50`}
                              >
                                {isStructuring ? (
                                  <>
                                    <Loader2 size={13} className="animate-spin" />
                                    AIが情報をお片付け中...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles size={13} />
                                    AIで「項目：内容」にきれいに整理する
                                  </>
                                )}
                              </button>
                            </div>

                            <label className="text-[10px] text-slate-500 mb-1.5 font-semibold flex justify-between">
                              <span>※ 下の枠内で不要な文字の削除や、不足した物件情報の直接タイピング修正が自由に行えます（【二つの窓】でチェックできます）:</span>
                              <span className="text-[9px] text-brand-primary font-bold">編集可能</span>
                            </label>
                            <textarea
                              value={
                                assets.find(a => a.id === (selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id))?.content || ''
                              }
                              onChange={(e) => {
                                const currentId = selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id;
                                if (currentId) {
                                  setAssets((prev) => 
                                    prev.map((asset) => asset.id === currentId ? { ...asset, content: e.target.value } : asset)
                                  );
                                }
                              }}
                              placeholder="PDFからテキストが抽出されませんでした。または空のドキュメントです。"
                              className="w-full min-h-[220px] bg-slate-50 border border-brand-border rounded-lg p-3 text-xs font-mono leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all resize-y"
                            />
                          </div>

                      {/* Apply Options */}
                      <div className="bg-slate-100/80 px-3 py-2.5 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center border-t border-brand-border">
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                          抽出元文字数: <strong className="text-emerald-600">{(assets.find(a => a.id === (selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id))?.content || '').length}</strong> 文字
                        </span>

                        <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              const textToApply = assets.find(a => a.id === (selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id))?.content || '';
                              if (textToApply) {
                                setDescription(textToApply);
                                triggerSuccessAnimation('overwrite');
                              }
                            }}
                            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10.5px] font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all border-none cursor-pointer"
                            title="【窓②】の内容を完全に上書きしてこのPDF情報に更新します"
                          >
                            <Sparkles size={11} />
                            テンプレートへ「上書き適用」する
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const textToApply = assets.find(a => a.id === (selectedPdfId || assets.filter(p => p.type === 'pdf')[0]?.id))?.content || '';
                              if (textToApply) {
                                setDescription((prev) => prev ? `${prev}\n\n${textToApply}` : textToApply);
                                triggerSuccessAnimation('append');
                              }
                            }}
                            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10.5px] font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 shadow-sm transition-all border-none cursor-pointer"
                            title="【窓②】の末尾に、このPDF情報を追加挿入します"
                          >
                            「追加で挿入」する
                          </button>
                        </div>
                      </div>
                        </div>

                        {/* Windows 2: Official Template Draft view & editor */}
                        <div className="flex flex-col bg-indigo-50/20 rounded-xl border border-indigo-200 overflow-hidden shadow-sm">
                          <header className="flex items-center justify-between bg-indigo-50 px-3 py-2 border-b border-indigo-100 text-[11px] font-extrabold text-indigo-950">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-600" />
                              <span>【窓②】物件情報テンプレート（AIプロンプト入力エリア）</span>
                            </div>
                            <span className="text-[9px] bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-700 uppercase font-bold tracking-widest font-extrabold">
                              DRAFT TEMPLATE
                            </span>
                          </header>

                          {/* Editable original input */}
                          <div className="p-3 bg-white flex flex-col flex-grow">
                            <label className="text-[10px] text-indigo-700 mb-1.5 font-semibold flex justify-between items-center">
                              <span>※ AIの翻訳・SNSコピー生成に実際に投入される物件情報です（自由に最終調整可能）:</span>
                              {successAnimation && (
                                <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.2 animate-bounce font-extrabold">
                                  {successAnimation === 'overwrite' ? '上書き適用完了! ✓' : '追加挿入完了! ✓'}
                                </span>
                              )}
                            </label>
                            <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder="ここに書き込まれた内容に基づいて、AIが日本語、英語、中国語（簡体/繁体）の美しい多言語コピーとポータル不動産紹介文を同時生成します。左の【窓①】から適用ボタンを押すか、直接手動でテキストを入力・修正してください。"
                              className="w-full min-h-[220px] bg-slate-50 border border-indigo-100 rounded-lg p-3 text-xs leading-relaxed font-medium text-brand-text-main focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition-all resize-y"
                            />
                          </div>

                          {/* Options list */}
                          <div className="bg-indigo-50/40 px-3 py-2 flex flex-col sm:flex-row gap-2 justify-between items-center border-t border-indigo-100">
                            <span className="text-[10px] text-slate-500 font-semibold">
                              現在のテンプレート総文字数: <strong className="text-xs text-indigo-600 font-extrabold">{description.length}</strong> 文字
                            </span>

                            <div className="flex items-center gap-3">
                              {description && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDescription('');
                                  }}
                                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer outline-none"
                                >
                                  テンプレートをクリア
                                </button>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => {
                                  // Clear PDF assets so they can go back to pasting
                                  if (confirm('PDF資料の紐付けを解除し、通常の手動コピペ入力画面に戻しますか？（抽出済みの文字は消えません）')) {
                                    setAssets((prev) => prev.filter(a => a.type !== 'pdf'));
                                    setSelectedPdfId(null);
                                  }
                                }}
                                className="text-[10px] font-bold text-red-600 hover:text-red-700 transition-all bg-red-100/50 hover:bg-red-100 px-2.5 py-1 rounded-lg border-none cursor-pointer"
                              >
                                PDFを解除して通常入力に戻る
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Default single textbox view for direct pasting/typing */
                    <>
                      <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={
                          mode === 'property' 
                            ? "【物件の詳細あるいはコピペ入力】\n物件名、所在地、敷地面積、価格、交通アクセスなどの手動コピペや、アピールしたいセリングポイントを自由に入力してください。上のPDF資料インポートと併用可能です..."
                            : mode === 'concept'
                            ? "【AI企画・着想プロンプト（任意）】\n「高級感のある2LDK」「森に囲まれたサウナ付き別荘」など、アイデアを自由に入力してください。資料や写真がなくても、AIが魅力的なコンセプトを提案します..."
                            : "【日常のつぶやき・コメント（任意）】\n写真に関するメモや、今日あった出来事、伝えたい気分、ハッシュタグに入れたいキーワードなどを自由に入力してください。空欄でも写真からAIが自由に生成します..."
                        }
                        className="w-full min-h-[140px] p-4 bg-slate-50 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none font-medium text-brand-text-main"
                      />

                      <div className="flex flex-wrap gap-2 justify-end items-center p-2">
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => {
                              setDescription('');
                              setAssets([]);
                            }}
                            className="text-[11px] font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-sm"
                          >
                            クリア
                          </button>
                          <button 
                            type="button"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className={`text-[11px] font-bold text-white px-5 py-2 rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-2 ${
                              isGenerating ? 'bg-brand-primary/70' : 'bg-brand-primary hover:bg-brand-primary/90'
                            }`}
                          >
                            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                            {mode === 'concept' ? 'コンセプト生成' : mode === 'life' ? '投稿を作成' : '文案生成'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

              {/* Action Bar */}
              <div className="mt-auto bg-white border border-brand-border p-4 rounded-xl shadow-card flex items-center justify-between">
                <div className="text-[12px] text-brand-text-muted">
                  <strong className="text-brand-text-main">Instagram, Twitter, FB</strong> への投稿準備
                </div>
                
                <button 
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="bg-brand-primary text-white px-6 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      生成中...
                    </>
                  ) : (
                    <>
                      すべてのバリエーションを生成
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'assets' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-6"
            >
              <header>
                <h3 className="text-lg font-bold text-brand-text-main mb-1">アセットライブラリ</h3>
                <p className="text-sm text-brand-text-muted">アップロードされたすべてのファイル</p>
              </header>
              <div className="grid grid-cols-4 gap-4">
                {assets.length > 0 ? (
                  assets.map(asset => (
                    <div key={asset.id} className="bg-white p-2 border border-brand-border rounded-xl shadow-sm group relative">
                      {asset.type === 'image' ? (
                        <div className="aspect-square rounded-lg overflow-hidden bg-slate-100 mb-2">
                          <img src={asset.preview} className="w-full h-full object-cover" alt="" />
                        </div>
                      ) : (
                        <div className="aspect-square rounded-lg bg-slate-50 flex flex-col items-center justify-center p-4 mb-2">
                          <FileText size={32} className="text-slate-300" />
                        </div>
                      )}
                      <div className="text-[10px] font-medium truncate text-brand-text-main px-1">
                        {asset.file.name}
                      </div>
                      <button 
                        onClick={() => removeAsset(asset.id)}
                        className="absolute top-4 right-4 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-md"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="col-span-4 py-20 bg-white border-2 border-dashed border-brand-border rounded-xl flex flex-col items-center justify-center text-brand-text-muted">
                    <ImageIcon size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">ファイルはまだありません</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'translations' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-6"
            >
              <header>
                <h3 className="text-lg font-bold text-brand-text-main mb-1">翻訳履歴</h3>
                <p className="text-sm text-brand-text-muted">これまでに生成されたすべてのコンテンツ</p>
              </header>
              <div className="space-y-4">
                {history.length > 0 ? (
                  history.map(item => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-brand-border rounded-xl p-5 shadow-sm hover:border-brand-primary transition-all cursor-pointer"
                      onClick={() => {
                        setResults(item);
                        setMode(item.mode);
                        setSelectedFlow(item.mode);
                        setPreviewMode(item.mode === 'property' ? 'portal' : 'sns');
                        setActiveTab('dashboard');
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {item.mode === 'property' ? <Building2 size={14} /> : <Coffee size={14} />}
                          <span className="text-xs font-bold text-brand-primary uppercase">
                            {item.mode === 'property' ? '不動産' : 'ライフ'}
                          </span>
                        </div>
                        <span className="text-[10px] text-brand-text-muted">
                          {new Date(item.timestamp).toLocaleString('ja-JP')}
                        </span>
                      </div>
                      <h4 className="font-bold text-brand-text-main mb-1 truncate">{item.ja.title}</h4>
                      <p className="text-xs text-brand-text-muted line-clamp-2">{item.ja.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-20 bg-white border-2 border-dashed border-brand-border rounded-xl flex flex-col items-center justify-center text-brand-text-muted">
                    <Languages size={48} className="mb-4 opacity-20" />
                    <p className="text-sm">履歴はまだありません</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-xs font-medium border border-red-100 mt-4">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Live Preview Column */}
        <div className="flex flex-col gap-4 lg:overflow-hidden min-h-[500px] lg:min-h-0">
          <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider mb-2">ライブプレビュー</h3>
          
          {results ? (
            <div className="flex flex-col gap-4 flex-1 lg:overflow-hidden">
              {/* Language Selector */}
              <div className="flex p-0.5 bg-white rounded-lg border border-brand-border shadow-sm w-full">
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
                    {lang === 'en' ? 'ENGLISH' : lang === 'zh' ? 'CHINESE' : 'JAPANESE'}
                  </button>
                ))}
              </div>

              {/* Mode Selector for Property Listings */}
              {mode === 'property' && (
                <div className="flex p-0.5 bg-white rounded-lg border border-brand-border shadow-sm w-full">
                  <button
                    onClick={() => setPreviewMode('sns')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      previewMode === 'sns' 
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Instagram size={14} />
                    SNS 投稿
                  </button>
                  <button
                    onClick={() => setPreviewMode('portal')}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                      previewMode === 'portal' 
                        ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-sm' 
                        : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Building2 size={14} />
                    不動産物件シート
                  </button>
                </div>
              )}

              {/* Preview Content Area */}
              {previewMode === 'portal' && mode === 'property' ? (
                /* Structured Property portal Sheet */
                <motion.div 
                  key={`portal-${activeLanguage}`}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-1 bg-white rounded-2xl border border-brand-border p-5 shadow-card lg:overflow-y-auto custom-scrollbar flex flex-col gap-4 text-brand-text-main"
                >
                  <div className="flex items-center justify-between border-b pb-3 mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-brand-primary">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-indigo-600">構造化データ出力 (AUTO EXPORT)</div>
                        <div className="text-[10px] text-slate-400">データ自動抽出・多言語翻訳</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const resultsLang = results[activeLanguage];
                        const textToCopy = `【Property Title】\n${resultsLang.title}\n\n【SEO Description】\n${resultsLang.seoDescription || ''}\n\n【Property Details & Introduction】\nOverview:\n${resultsLang.propertyDetails?.overview || ''}\n\nLocation & Accessibility:\n${resultsLang.propertyDetails?.location || ''}\n\nSpecifications:\n${resultsLang.propertyDetails?.specifications || ''}\n\nOnsen:\n${resultsLang.propertyDetails?.onsen || ''}\n\nInfrastructure & Remarks:\n${resultsLang.propertyDetails?.infrastructure || ''}`;
                        copyToClipboard(textToCopy);
                      }}
                      className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm shrink-0"
                    >
                      <Copy size={12} />
                      一括コピー
                    </button>
                  </div>

                  {/* 1. SEO Description */}
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5 focus-within:border-brand-primary/40 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-indigo-600 tracking-wider">1. SEO用説明文 (<span className="font-mono">160文字以内</span>)</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        (results[activeLanguage].seoDescription?.length || 0) <= 160 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        文字数: {results[activeLanguage].seoDescription?.length || 0}
                      </span>
                    </div>
                    <div className="relative group">
                      <textarea 
                        value={results[activeLanguage].seoDescription || ''}
                        onChange={(e) => handleResultUpdate(activeLanguage, 'seoDescription', e.target.value)}
                        className="w-full text-[12px] bg-white p-2.5 rounded-lg border border-slate-200 text-slate-700 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-brand-primary/30 active:bg-slate-50/50"
                        rows={3}
                      />
                      <button 
                        onClick={() => copyToClipboard(results[activeLanguage].seoDescription || '')}
                        className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                        title="Copy Description"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>

                  {/* 2. Property Title */}
                  <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-bold text-indigo-600 tracking-wider">2. 物件タイトル (<span className="font-mono">70文字以内</span>)</div>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        (results[activeLanguage].title?.length || 0) <= 70 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'
                      }`}>
                        文字数: {results[activeLanguage].title?.length || 0}
                      </span>
                    </div>
                    <div className="relative group">
                      <input 
                        type="text"
                        value={results[activeLanguage].title}
                        onChange={(e) => handleResultUpdate(activeLanguage, 'title', e.target.value)}
                        className="w-full text-xs font-bold bg-white p-2.5 rounded-lg border border-slate-200 text-slate-900 leading-relaxed focus:outline-none focus:ring-1 focus:ring-brand-primary/30"
                      />
                      <button 
                        onClick={() => copyToClipboard(results[activeLanguage].title)}
                        className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                        title="Copy Title"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>

                  {/* 3. Property Details & Introduction */}
                  <div className="flex flex-col gap-2">
                    <div className="text-[11px] font-bold text-indigo-600 tracking-wider">3. 物件詳細・紹介内容</div>
                    
                    {/* Sub-sections */}
                    <div className="space-y-3">
                      {/* Overview */}
                      {results[activeLanguage].propertyDetails?.overview && (
                        <div className="bg-white border rounded-xl p-3 hover:shadow-sm transition-all relative group">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">概要 (OVERVIEW)</div>
                          <textarea 
                            value={results[activeLanguage].propertyDetails?.overview}
                            onChange={(e) => handleResultUpdate(activeLanguage, 'propertyDetails', e.target.value, 'overview')}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-transparent border-none resize-none focus:outline-none"
                            rows={4}
                          />
                          <button 
                            onClick={() => copyToClipboard(results[activeLanguage].propertyDetails?.overview || '')}
                            className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      )}

                      {/* Location */}
                      {results[activeLanguage].propertyDetails?.location && (
                        <div className="bg-white border rounded-xl p-3 hover:shadow-sm transition-all relative group">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">所在地・交通アクセス</div>
                          <textarea 
                            value={results[activeLanguage].propertyDetails?.location}
                            onChange={(e) => handleResultUpdate(activeLanguage, 'propertyDetails', e.target.value, 'location')}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-transparent border-none resize-none focus:outline-none"
                            rows={3}
                          />
                          <button 
                            onClick={() => copyToClipboard(results[activeLanguage].propertyDetails?.location || '')}
                            className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      )}

                      {/* Specifications */}
                      {results[activeLanguage].propertyDetails?.specifications && (
                        <div className="bg-white border rounded-xl p-3 hover:shadow-sm transition-all relative group">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">物件詳細スペック</div>
                          <textarea 
                            value={results[activeLanguage].propertyDetails?.specifications}
                            onChange={(e) => handleResultUpdate(activeLanguage, 'propertyDetails', e.target.value, 'specifications')}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-transparent border-none resize-none focus:outline-none"
                            rows={3}
                          />
                          <button 
                            onClick={() => copyToClipboard(results[activeLanguage].propertyDetails?.specifications || '')}
                            className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      )}

                      {/* Onsen */}
                      {results[activeLanguage].propertyDetails?.onsen && (
                        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 hover:shadow-sm transition-all relative group">
                          <div className="text-[10px] font-bold text-amber-600 mb-1">天然温泉・源泉情報</div>
                          <textarea 
                            value={results[activeLanguage].propertyDetails?.onsen}
                            onChange={(e) => handleResultUpdate(activeLanguage, 'propertyDetails', e.target.value, 'onsen')}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-transparent border-none resize-none focus:outline-none"
                            rows={2}
                          />
                          <button 
                            onClick={() => copyToClipboard(results[activeLanguage].propertyDetails?.onsen || '')}
                            className="absolute right-2 top-2 p-1 bg-amber-100/50 text-amber-700 rounded border hover:bg-amber-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      )}

                      {/* Infrastructure */}
                      {results[activeLanguage].propertyDetails?.infrastructure && (
                        <div className="bg-white border rounded-xl p-3 hover:shadow-sm transition-all relative group">
                          <div className="text-[10px] font-bold text-slate-400 mb-1">インフラ・備考</div>
                          <textarea 
                            value={results[activeLanguage].propertyDetails?.infrastructure}
                            onChange={(e) => handleResultUpdate(activeLanguage, 'propertyDetails', e.target.value, 'infrastructure')}
                            className="w-full text-xs text-slate-700 leading-relaxed bg-transparent border-none resize-none focus:outline-none"
                            rows={2}
                          />
                          <button 
                            onClick={() => copyToClipboard(results[activeLanguage].propertyDetails?.infrastructure || '')}
                            className="absolute right-2 top-2 p-1 bg-slate-50 text-slate-500 rounded border hover:bg-slate-100 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-auto pt-4 flex gap-3 border-t">
                    <button 
                      onClick={() => {
                        const resultsLang = results[activeLanguage];
                        const textToCopy = `【Property Title】\n${resultsLang.title}\n\n【SEO Description】\n${resultsLang.seoDescription || ''}\n\n【Property Details & Introduction】\nOverview:\n${resultsLang.propertyDetails?.overview || ''}\n\nLocation & Accessibility:\n${resultsLang.propertyDetails?.location || ''}\n\nSpecifications:\n${resultsLang.propertyDetails?.specifications || ''}\n\nOnsen:\n${resultsLang.propertyDetails?.onsen || ''}\n\nInfrastructure & Remarks:\n${resultsLang.propertyDetails?.infrastructure || ''}`;
                        copyToClipboard(textToCopy);
                      }}
                      className="flex-1 bg-white border border-slate-200 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-slate-700"
                    >
                      <Copy size={14} />
                      一括コピー
                    </button>
                    <button 
                      onClick={() => setPreviewMode('sns')}
                      className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-md active:scale-95"
                    >
                      <Instagram size={14} />
                      SNSプレビューで確認・編集
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* Instagram Phone Mockup */
                <motion.div 
                  key={`sns-${activeLanguage}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex-1 bg-white rounded-[24px] border-[8px] border-slate-900 shadow-sleek lg:overflow-hidden flex flex-col mb-4"
                >
                  <div className="p-3 flex items-center gap-2 border-b border-slate-50 text-brand-text-main">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-400 via-pink-500 to-indigo-600 flex items-center justify-center text-white">
                      {mode === 'property' ? <Building2 size={16} /> : <Coffee size={16} />}
                    </div>
                    <div className="text-[13px] font-bold">global_creator_pro</div>
                  </div>

                  <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                    {assets.find(a => a.type === 'image') ? (
                      <img 
                        src={assets.find(a => a.type === 'image')?.preview} 
                        className={`w-full h-full object-cover ${isEnhanced ? 'brightness-110 contrast-105 saturate-110' : ''}`}
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                      />
                    ) : mode === 'property' ? (
                      <div className="w-full h-full bg-gradient-to-br from-indigo-500/10 via-indigo-600/5 to-slate-900/5 flex flex-col items-center justify-center text-indigo-500 gap-2 p-6 border-b border-indigo-100/10">
                        <Building2 size={40} className="text-indigo-600 animate-pulse" />
                        <span className="text-[10px] font-bold tracking-widest text-indigo-600">PREMIUM LANDING IMAGE</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-cyan-500/10 via-cyan-600/5 to-slate-900/5 flex flex-col items-center justify-center text-cyan-500 gap-2 p-6">
                        <ImageIcon size={40} className="text-cyan-600" />
                        <span className="text-[10px] font-bold tracking-widest text-cyan-600">DAILY STORY SNAPSHOT</span>
                      </div>
                    )}
                  </div>

                  <div className="p-3 flex gap-4 border-b border-slate-50">
                    <span>❤️</span> <span>💬</span> <span>✈️</span>
                  </div>

                  <div className="p-3 flex-1 lg:overflow-y-auto overflow-x-hidden text-[13px] leading-relaxed select-text text-brand-text-main">
                    <input 
                      type="text"
                      className="font-bold mb-1 w-full bg-transparent border-none focus:outline-none"
                      value={results[activeLanguage].title}
                      onChange={(e) => handleResultUpdate(activeLanguage, 'title', e.target.value)}
                    />
                    <textarea 
                      className="text-slate-700 w-full bg-transparent border-none focus:outline-none resize-none leading-relaxed"
                      rows={8}
                      value={results[activeLanguage].content}
                      onChange={(e) => handleResultUpdate(activeLanguage, 'content', e.target.value)}
                    />
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <input 
                        type="text"
                        className="text-brand-primary font-semibold w-full bg-transparent border-none focus:outline-none text-xs"
                        value={results[activeLanguage].hashtags.map(t => '#' + t.replace(/^#/, '')).join(' ')}
                        onChange={(e) => {
                          const tags = e.target.value.split(/#|\s+/).filter(t => t.trim() !== '').map(t => t.trim());
                          handleResultUpdate(activeLanguage, 'hashtags', tags);
                        }}
                      />
                    </div>
                  </div>

                  <div className="p-3 mt-auto bg-white border-t flex flex-col gap-2">
                    <button 
                      onClick={() => {
                        const fullText = `${results[activeLanguage].title}\n\n${results[activeLanguage].content}\n\n${results[activeLanguage].hashtags.map(t => '#' + t.replace(/^#/, '')).join(' ')}`;
                        copyToClipboard(fullText);
                        alert('クリップボードにコピーしました');
                      }}
                      className="w-full bg-brand-primary text-white py-3 rounded-xl text-sm font-bold hover:bg-brand-primary/90 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-[0.98]"
                    >
                      <Copy size={16} />
                      本文をコピー
                    </button>
                    <button 
                      onClick={() => setPreviewMode('portal')}
                      className="w-full bg-slate-100 text-slate-600 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                    >
                      <Layout size={14} />
                      スペック情報に戻る
                    </button>
                  </div>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-white/50 border-2 border-dashed border-brand-border rounded-[24px] flex flex-col items-center justify-center p-8 text-center text-brand-text-main">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-brand-border mb-4 text-brand-text-muted">
                <Send size={24} />
              </div>
              <div className="text-sm font-bold mb-1">ライブプレビュー</div>
              <div className="text-xs text-brand-text-muted">コンテンツを生成して投稿イメージを確認しましょう。</div>
            </div>
          )}
        </div>
      </main>
    </div>
  </div>
);
}



