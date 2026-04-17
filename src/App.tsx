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
  Brain
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { extractTextFromPdf } from './lib/pdf';
import { generateSocialPosts, GenerationResult, GenerationMode } from './lib/gemini';

interface PropertyAsset {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'pdf' | 'text';
  content?: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'assets' | 'translations'>('dashboard');
  const [assets, setAssets] = useState<PropertyAsset[]>([]);
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<GenerationResult | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<'zh' | 'en' | 'ja'>('ja');
  const [isEnhanced, setIsEnhanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<GenerationMode>('property');
  const [history, setHistory] = useState<(GenerationResult & { id: string, timestamp: number, mode: GenerationMode })[]>([]);

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
      setError('まずは情報を入力するか、ファイルをアップロードしてください。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    try {
      const images = assets.filter(a => a.type === 'image').map(a => a.preview);
      const extractedText = assets.filter(a => a.type === 'pdf').map(a => a.content).join('\n');
      const combinedText = `Description: ${description}\n\nExtracted from docs: ${extractedText}`;
      
      const response = await generateSocialPosts(combinedText, images, mode);
      setResults(response);
      setHistory(prev => [{ ...response, id: Math.random().toString(36).substring(7), timestamp: Date.now(), mode }, ...prev]);
    } catch (err) {
      setError('生成に失敗しました。もう一度お試しください。');
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
          OmniPost AI
        </div>
        
        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'dashboard' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Building2 size={18} />
            ダッシュボード
          </button>
          <button 
            onClick={() => setActiveTab('assets')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'assets' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <ImageIcon size={18} />
            アセットライブラリ
          </button>
          <button 
            onClick={() => setActiveTab('translations')}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium cursor-pointer transition-all ${
              activeTab === 'translations' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Languages size={18} />
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
      <main className="flex-1 grid grid-cols-[1fr_340px] gap-6 p-6 overflow-hidden">
        {/* Workspace */}
        <div className="flex flex-col gap-5 overflow-y-auto pr-2 custom-scrollbar text-brand-text-main">
          {activeTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-5 h-full"
            >
              <header className="flex items-center justify-between mb-2">
                <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-primary" />
                  ソース入力
                </h3>
                
                <div className="flex p-0.5 bg-brand-border/50 rounded-lg">
                  <button 
                    onClick={() => setMode('property')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      mode === 'property' ? 'bg-white shadow-sm text-brand-primary' : 'text-brand-text-muted'
                    }`}
                  >
                    <Building2 size={14} />
                    不動産
                  </button>
                  <button 
                    onClick={() => setMode('life')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                      mode === 'life' ? 'bg-white shadow-sm text-brand-primary' : 'text-brand-text-muted'
                    }`}
                  >
                    <Coffee size={14} />
                    日常・ライフ
                  </button>
                </div>
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
                  <h3 className="text-sm font-semibold">写真をアップロード</h3>
                  <p className="text-xs text-brand-text-muted mt-1">AI画質補正対応</p>
                </div>

                <div 
                  {...getRootProps()} 
                  className="bg-white border-2 border-dashed border-brand-border rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-brand-primary hover:bg-slate-50 transition-all"
                >
                  <div className="text-brand-primary mb-3">
                    <FileText size={24} />
                  </div>
                  <h3 className="text-sm font-semibold">PDF/ドキュメントをドロップ</h3>
                  <p className="text-xs text-brand-text-muted mt-1">中・英・日 OCR抽出</p>
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
                          <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center text-brand-text-main">
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
                  処理パイプライン
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 py-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-brand-primary font-bold">INFO</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-brand-text-main">自動画質補正</div>
                      <div className="text-xs text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        {isEnhanced ? '有効' : '待機中'}
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
                      <div className="text-sm font-medium text-brand-text-main">{mode === 'property' ? '不動産SNSコピー' : 'ライフスタイル・思考'}</div>
                      <div className="text-xs text-brand-text-muted">3言語のプレビュー準備完了</div>
                    </div>
                  </div>

                  <textarea 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={mode === 'property' 
                      ? "物件の詳細、所在地、セリングポイントを入力してください..."
                      : "今日の出来事、感じたこと、共有したい思考を入力してください..."
                    }
                    className="w-full min-h-[100px] p-4 bg-slate-50 border border-brand-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all resize-none font-medium text-brand-text-main"
                  />
                </div>
              </div>

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
        <div className="flex flex-col gap-4 overflow-hidden">
          <h3 className="text-[13px] font-semibold text-brand-text-muted uppercase tracking-wider mb-2">ライブプレビュー</h3>
          
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
                    {lang === 'en' ? 'ENGLISH' : lang === 'zh' ? 'CHINESE' : 'JAPANESE'}
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
                    />
                  ) : (
                    <ImageIcon size={48} className="text-slate-200" />
                  )}
                </div>

                <div className="p-3 flex gap-4 border-b border-slate-50">
                  <span>❤️</span> <span>💬</span> <span>✈️</span>
                </div>

                <div className="p-3 flex-1 overflow-y-auto overflow-x-hidden text-[13px] leading-relaxed select-text text-brand-text-main">
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
                    className="flex-1 bg-white border border-brand-border py-2 rounded-lg text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 text-brand-text-main"
                  >
                    <Copy size={14} />
                    すべてコピー
                  </button>
                </div>
              </motion.div>
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
  );
}



