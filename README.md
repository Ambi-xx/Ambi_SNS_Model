# OmniPost AI - 多言語SNSクリエイター

不動産物件や日常の出来事から、中・英・日の多言語SNS投稿を自動生成するAIアシスタント。

## 🚀 部署指南 (Deployment)

本项目推荐通过 **Vercel** 进行部署，以支持后端 API 和环境变量保护。

### 1. 准备工作
- 拥有一个 [Google AI Studio](https://aistudio.google.com/) 的 API Key。
- 将此仓库推送到您的 GitHub 账号（建议设为 **Private**）。

### 2. 部署到 Vercel
1. 在 [Vercel](https://vercel.com/) 中导入您的 GitHub 仓库。
2. 在 **Environment Variables** 配置中添加：
   - `GEMINI_API_KEY`: 您的 API Key
3. 点击 **Deploy**。

### 3. Payload 限制说明
- Vercel 免费版有 4.5MB 的请求体限制。
- 应用已内置前端压缩逻辑（图片自动缩放至 1024px），请确保上传的 PDF 页面不要过多。

### 4. 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 🏗️ 技术栈
- React + Vite + TypeScript
- Tailwind CSS / Shadcn UI
- Google Gemini AI (gemini-3-flash-preview)
- Express (Backend Proxy)
- pdfjs-dist (PDF Client-side Parsing)
