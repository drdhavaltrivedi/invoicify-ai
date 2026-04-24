# Invoicify AI 🚀

**Invoicify AI** is a high-performance, neural-powered invoice processing hub designed for modern financial auditing and accounts payable workflows. Utilizing the power of **Google Gemini 1.5 Flash**, it transforms raw document streams (PDFs, JPGs, PNGs) into structured, actionable intelligence with zero manual entry.

Live at: [Invoicify.brilworks.com](https://Invoicify.brilworks.com/)

---

## 💎 Core Intelligence Layers

### 🧠 Neural Extraction Engine
Leverages multi-modal LLMs to extract hyper-accurate metadata from complex invoice layouts:
- **Merchant Profiling**: Automated entity identifying with logo/header analysis.
- **Dynamic Field Mapping**: Extraction of Invoice #, Due Dates, and Payment Terms.
- **Granular Line Items**: Deep decomposition of services, quantities, and unit prices.
- **Confidence Scoring**: Real-time reliability metrics for every extracted field.

### 🏢 Vendor Management (Neural Auto-Population)
Save recurring vendor signatures to your local management database. Once saved, the engine uses **Neural Sync** to auto-populate billing emails and corporate addresses on future documents from the same merchant.

### 🌍 Global Audit Intelligence
- **IP-Based Localization**: Automatic detection of your local currency based on geo-location.
- **Real-Time Conversion**: Fetches live exchange rates to provide a consolidated "Local Conversion" audit of all processed documents.
- **Currency Override**: Choose your preferred audit currency in the Extraction Layer settings.

### 📊 Workspace Insights
- **Stream Buffer**: A real-time processing queue for incoming document streams.
- **Cumulative Audit Dashboard**: High-level statistical breakdown of total spends by currency.
- **AI Executive Summary**: Generate bulk summaries across multiple documents to identify spending patterns or anomalies.

---

## 🛠 Tech Stack

- **Frontend**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
- **AI/LLM**: [Google Gemini 1.5 Flash](https://ai.google.dev/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/) (`motion/react`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Parsing**: `react-pdf` for secure PDF handling

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm / pnpm / yarn
- A **Gemini API Key** (get one at [Google AI Studio](https://aistudio.google.com/))

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your environment variables (see `.env.example`).
   ```bash
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment (Vercel)
The project is optimized for deployment on **Vercel**.
1. Connect your GitHub repository to Vercel.
2. Add your `VITE_GEMINI_API_KEY` to the environment variables.
3. Deploy! The `vercel.json` ensures proper routing for the SPA.

---

## 🔍 SEO & Discovery
Invoicify AI is optimized for both human search engines and AI agents:
- **SEO**: Meta tags, Open Graph, and Twitter cards implemented in `index.html`.
- **AIO/GIO**: `llms.txt` provided for AI agent discovery.
- **Indexing**: `robots.txt` and `sitemap.xml` configured for `Invoicify.brilworks.com`.

---

## 🔒 Security & Privacy

- **On-the-Fly Processing**: Documents are processed via secure memory buffers.
- **Neural Privacy**: Data is sent to the Gemini API securely for extraction; no document storage occurs on the application server.
- **Local Persistence**: All settings and processed metadata are stored in your browser's `localStorage` for privacy-first persistence.

---

## 📜 License
This project is licensed under the **Apache-2.0 License**.
Developed by the **Brilworks Team**.
