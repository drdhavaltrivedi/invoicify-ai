import React from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Upload, 
  Cpu, 
  FileCheck, 
  Download, 
  Search, 
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Link } from 'react-router-dom';

const STEPS = [
  {
    icon: <Upload className="w-6 h-6 text-brand" />,
    title: "Ingest Documents",
    description: "Drag and drop your PDF invoices or image files (JPG, PNG) into the neural buffer ingest area. You can upload multiple files simultaneously for batch processing."
  },
  {
    icon: <Zap className="w-6 h-6 text-brand" />,
    title: "Neural Extraction",
    description: "Gemini 1.5 analyzes the visual and semantic data of each document. It identifies merchants, dates, line items, and totals with high-precision neural layers."
  },
  {
    icon: <Cpu className="w-6 h-6 text-brand" />,
    title: "AI Categorization",
    description: "The system automatically suggests financial categories. You can accept these with one click or manually assign custom categories to keep your workspace organized."
  },
  {
    icon: <Search className="w-6 h-6 text-brand" />,
    title: "Audit & Search",
    description: "Use the filter bar to isolate documents by category or date. The global search bar allows you to find specific transactions by keyword, merchant name, or extracted summary."
  },
  {
    icon: <FileCheck className="w-6 h-6 text-brand" />,
    title: "Verify Data",
    description: "Review extraction confidence scores. You can manually edit the merchant name, date, or total amount if any corrections are needed before finalizing the audit."
  },
  {
    icon: <Download className="w-6 h-6 text-brand" />,
    title: "Export Results",
    description: "Download detailed JSON for developers or Excel-optimized CSVs for accounting. Generate AI-powered summary reports covering your entire workspace volume."
  }
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="px-4 sm:px-8 py-6 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group text-slate-500 hover:text-brand transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-bold">Back to Workspace</span>
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 hidden xs:inline">Documentation v1.0</span>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto py-12 sm:py-16 px-4 sm:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16 sm:mb-20"
        >
          <h1 className="text-3xl sm:text-5xl font-black tracking-tighter text-slate-900 mb-6 px-2">
            Understand the <span className="text-brand">Workflow</span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed px-4">
            Invoicify.ai leverages Gemini 1.5 Flash to transform unstructured document streams into production-grade financial datasets.
          </p>
        </motion.div>

        <div className="grid gap-12">
          {STEPS.map((step, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="flex gap-8 group"
            >
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white rounded-[1.25rem] sm:rounded-3xl shadow-xl flex items-center justify-center border border-slate-100 group-hover:bg-brand group-hover:scale-110 transition-all duration-500">
                  <div className="group-hover:text-white transition-colors scale-75 sm:scale-100">
                    {step.icon}
                  </div>
                </div>
                {idx !== STEPS.length - 1 && (
                  <div className="w-px h-full bg-slate-200 my-4 border-dashed border-l" />
                )}
              </div>
              <div className="pt-2">
                <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight group-hover:text-brand transition-colors">
                  {idx + 1}. {step.title}
                </h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-32 p-10 bg-slate-900 rounded-[3rem] text-white overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand/20 blur-[100px] -mr-32 -mt-32" />
          <div className="relative z-10">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
              <ShieldCheck className="text-emerald-400" />
              Security & Privacy
            </h2>
            <p className="text-slate-400 leading-relaxed font-medium mb-8">
              All document processing is handled in real-time. We do not store your files on our servers. The neural buffer operates in a secure, sandboxed environment, and all data remaining in your local storage is encrypted by your browser.
            </p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Zero-Retention Policy</span>
            </div>
          </div>
        </motion.section>
      </main>

      <footer className="py-20 border-t border-slate-200 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          © 2026 Invoicify AI. All processing happens in real-time.
        </p>
        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 mt-4">
          A Brilworks Team Innovation
        </p>
      </footer>
    </div>
  );
}
