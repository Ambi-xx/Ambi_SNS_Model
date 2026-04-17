# OmniPost AI - 多言語SNSクリエイター

不動産物件や日常の出来事から、中・英・日の多言語SNS投稿を自動生成するAIアシスタント。

## 🚀 部署指南 (Deployment)

本项目支持通过 GitHub Actions 自动部署到 GitHub Pages。

### 1. 准备工作
- 拥有一个 [Google AI Studio](https://aistudio.google.com/) 的 API Key。

### 2. 部署到 GitHub Pages
1. 将此仓库推送到您的 GitHub 账号。
2. 在 GitHub 项目页面，点击 **Settings** > **Secrets and variables** > **Actions**。
3. 点击 **New repository secret**：
   - Name: `GEMINI_API_KEY`
   - Value: `您的 API Key`
4. 切换到 **Actions** 标签页，确保 "Deploy to GitHub Pages" 工作流已启用（通常推送代码后会自动触发）。
5. 在 **Settings** > **Pages** 中，将 **Build and deployment** 的 **Source** 设置为 `GitHub Actions`。

### 3. 本地开发
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 🏗️ 技术栈
- React + Vite + TypeScript
- Tailwind CSS (Sleek Interface)
- Google Gemini AI (gemini-3-flash-preview)
- Framer Motion / Lucide Icons
