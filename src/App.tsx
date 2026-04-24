/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Upload, 
  Download, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2, 
  Calendar, 
  Hash, 
  Coins, 
  Info,
  ChevronRight,
  RefreshCcw,
  FileJson,
  Table as TableIcon,
  Copy,
  Check,
  Sparkles,
  Settings,
  Filter,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  Users,
  Mail,
  MapPin,
  Globe,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import confetti from 'canvas-confetti';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Docs from './pages/Docs.tsx';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
import { processInvoice, processBulkSummary, InvoiceData } from './lib/gemini.ts';
import { cn, downloadJson, downloadCsv, downloadBulkCsv } from './lib/utils.ts';

interface ProcessedInvoice extends InvoiceData {
  id: string;
  fileName: string;
  fileType: string;
  status: 'processing' | 'completed' | 'error';
  error?: string;
  category?: string;
  fileUrl?: string; // Add this for previewing
}

interface Vendor {
  id: string;
  name: string;
  email: string;
  address: string;
  category: string;
}

const PREDEFINED_CATEGORIES = ['Utilities', 'Rent', 'Supplies', 'Travel', 'Food', 'Marketing', 'Software'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Workspace />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </BrowserRouter>
  );
}

function Workspace() {
  const [invoices, setInvoices] = useState<ProcessedInvoice[]>(() => {
    const saved = localStorage.getItem('invoicify_invoices');
    return saved ? JSON.parse(saved) : [];
  });
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [isGeneratingBulkSummary, setIsGeneratingBulkSummary] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | 'bulk' | null>(null);
  const [activeTab, setActiveTab] = useState<'summary' | 'data' | 'text' | 'preview'>('summary');

  useEffect(() => {
    return () => {
      invoices.forEach(inv => {
        if (inv.fileUrl) URL.revokeObjectURL(inv.fileUrl);
      });
    };
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('invoicify_search') || '');
  const [filterCategory, setFilterCategory] = useState(() => localStorage.getItem('invoicify_filter_cat') || 'All');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const saved = localStorage.getItem('invoicify_date_range');
    return saved ? JSON.parse(saved) : { start: '', end: '' };
  });

  const [lastSaved, setLastSaved] = useState<string>('');

  // Advanced Extraction state
  const [extractionFields, setExtractionFields] = useState<string[]>(() => {
    const saved = localStorage.getItem('invoicify_extraction_fields');
    return saved ? JSON.parse(saved) : ['Merchant Name', 'Invoice Number', 'Date', 'Total Amount', 'Line Items'];
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);

  // Custom Categories
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('invoicify_categories');
    return saved ? JSON.parse(saved) : [];
  });

  const [vendors, setVendors] = useState<Vendor[]>(() => {
    const saved = localStorage.getItem('invoicify_vendors');
    return saved ? JSON.parse(saved) : [];
  });
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);

  // Currency & Conversion state
  const [userCurrency, setUserCurrency] = useState<string>(() => {
    // 1. Check persistence
    const saved = localStorage.getItem('invoicify_user_currency');
    if (saved) return saved;

    // 2. Zero-network call detection basement
    try {
      const locale = window.navigator.language;
      const currencyMap: Record<string, string> = {
        'en-IN': 'INR', 'hi-IN': 'INR', 'en-GB': 'GBP', 'en-US': 'USD', 
        'en-AU': 'AUD', 'en-CA': 'CAD', 'de-DE': 'EUR', 'fr-FR': 'EUR', 
        'it-IT': 'EUR', 'es-ES': 'EUR', 'ja-JP': 'JPY', 'zh-CN': 'CNY'
      };
      return currencyMap[locale] || 'USD';
    } catch {
      return 'USD';
    }
  });

  useEffect(() => {
    localStorage.setItem('invoicify_user_currency', userCurrency);
  }, [userCurrency]);
  const [rates, setRates] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchLocaleData = async () => {
      // 1. IP-Based Detection (Secondary)
      try {
        const ipRes = await fetch('https://ipinfo.io/json?token='); // Using ipinfo as alternative or silent fail
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          // ipinfo doesn't give currency directly in free tier usually, but gives country
          // Let's stick to a more generous one or just the locale basement
        }
      } catch { /* Silent */ }

      // 2. Try another IP detector if first one fails or is skipped
      try {
        const res = await fetch('https://api.db-ip.com/v2/free/self');
        if (res.ok) {
          // just an example of another one
        }
      } catch { /* Silent */ }

      // 3. Robust Exchange Rates
      const rateApis = [
        'https://open.er-api.com/v6/latest/USD',
        'https://api.frankfurter.app/latest?from=USD'
      ];

      for (const api of rateApis) {
        try {
          const res = await fetch(api);
          if (res.ok) {
            const data = await res.json();
            const fetchedRates = data.rates || data.rates; // er-api uses rates
            if (fetchedRates) {
              setRates({ ...fetchedRates, 'USD': 1 });
              break; // Success
            }
          }
        } catch {
          continue; // Try next
        }
      }
    };
    fetchLocaleData();
  }, []);

  useEffect(() => {
    const toSave = invoices.map(inv => (inv.status === 'processing' ? { ...inv, status: 'error', error: 'Incomplete' } : inv));
    localStorage.setItem('invoicify_invoices', JSON.stringify(toSave));
    setLastSaved(new Date().toLocaleTimeString());
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('invoicify_categories', JSON.stringify(customCategories));
    localStorage.setItem('invoicify_search', searchQuery);
    localStorage.setItem('invoicify_filter_cat', filterCategory);
    localStorage.setItem('invoicify_date_range', JSON.stringify(dateRange));
    localStorage.setItem('invoicify_extraction_fields', JSON.stringify(extractionFields));
    localStorage.setItem('invoicify_vendors', JSON.stringify(vendors));
    setLastSaved(new Date().toLocaleTimeString());
  }, [customCategories, searchQuery, filterCategory, dateRange, extractionFields, vendors]);

  const allCategories = useMemo(() => [...PREDEFINED_CATEGORIES, ...customCategories], [customCategories]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.structured_data.merchant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.full_text.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = filterCategory === 'All' || inv.category === filterCategory;
      
      const invDate = inv.structured_data.invoice_details.date;
      const matchesDate = (!dateRange.start || invDate >= dateRange.start) && 
                          (!dateRange.end || invDate <= dateRange.end);

      return matchesSearch && matchesCategory && matchesDate;
    });
  }, [invoices, searchQuery, filterCategory, dateRange]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateBulkSummary = async (completed: ProcessedInvoice[]) => {
    if (completed.length < 2) {
      setBulkSummary(null);
      return;
    }
    setIsGeneratingBulkSummary(true);
    try {
      const summary = await processBulkSummary(completed);
      setBulkSummary(summary);
    } catch (err) {
      console.error("Bulk summary failed:", err);
    } finally {
      setIsGeneratingBulkSummary(false);
    }
  };

  const processFile = async (file: File) => {
    const id = Math.random().toString(36).substring(7);
    const fileUrl = URL.createObjectURL(file);
    
    const newInvoice: ProcessedInvoice = {
      id,
      fileName: file.name,
      fileType: file.type,
      status: 'processing',
      fileUrl,
      summary: '',
      full_text: '',
      suggested_category: '',
      structured_data: {
        merchant: { name: '', address: '' },
        invoice_details: { number: '', date: '', currency: '' },
        line_items: [],
        totals: { subtotal: 0, tax_amount: 0, total_amount: 0 }
      },
      confidence_scores: {
        merchant: 0,
        invoice_details: 0,
        line_items: 0,
        totals: 0
      }
    };
    
    setInvoices(prev => [newInvoice, ...prev]);

    try {
      const reader = new FileReader();
      const fileDataPromise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(file);
      const fileData = await fileDataPromise;

      const result = await processInvoice(fileData, file.type, extractionFields);
      
      setInvoices(prev => {
        const updated = prev.map(inv => {
          if (inv.id === id) {
            // Auto-categorize if the suggested category matches our list or we want to trust it
            let finalCategory = allCategories.find(c => c.toLowerCase() === result.suggested_category?.toLowerCase()) || '';
            
            // Vendor matching logic
            let structured_data = { ...result.structured_data };
            const matchingVendor = vendors.find(v => v.name.toLowerCase() === result.structured_data.merchant.name.toLowerCase());
            
            if (matchingVendor) {
              structured_data.merchant = {
                ...structured_data.merchant,
                email: matchingVendor.email || structured_data.merchant.email,
                address: matchingVendor.address || structured_data.merchant.address
              };
              if (!finalCategory) finalCategory = matchingVendor.category;
            }

            return { ...inv, ...result, structured_data, category: finalCategory || inv.category, status: 'completed' as const };
          }
          return inv;
        });
        
        // If this is the only one, select it
        if (updated.length === 1) setSelectedInvoiceId(id);
        
        return updated;
      });

      confetti({
        particleCount: 20,
        spread: 30,
        origin: { y: 0.8 },
        colors: ['#4f46e5', '#10b981']
      });
    } catch (err: any) {
      setInvoices(prev => prev.map(inv => 
        inv.id === id ? { ...inv, status: 'error', error: err.message || "Failed to process" } : inv
      ));
    }
  };

  const updateInvoice = (id: string, updates: Partial<ProcessedInvoice>) => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...updates } : inv));
  };

  const deleteInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    
    const confirmDelete = window.confirm(`Are you sure you want to delete "${inv.fileName}"? This action cannot be undone.`);
    if (!confirmDelete) return;

    if (inv.fileUrl) URL.revokeObjectURL(inv.fileUrl);
    setInvoices(prev => prev.filter(inv => inv.id !== id));
    if (selectedInvoiceId === id) setSelectedInvoiceId(null);
  };

  const addCustomCategory = (name: string) => {
    if (name && !allCategories.includes(name)) {
      setCustomCategories(prev => [...prev, name]);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      processFile(file);
    });
  }, [invoices]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.webp'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const handleReset = () => {
    invoices.forEach(inv => {
      if (inv.fileUrl) URL.revokeObjectURL(inv.fileUrl);
    });
    setInvoices([]);
    setSelectedInvoiceId(null);
    setBulkSummary(null);
  };

  const completedInvoices = invoices.filter(inv => inv.status === 'completed');
  
  const totalAmountByCurrency = useMemo(() => {
    return completedInvoices.reduce((acc, inv) => {
      let currency = inv.structured_data.invoice_details.currency || 'Unknown';
      // Normalize currency labels
      if (currency === 'null' || currency === 'undefined') currency = 'Unknown';
      
      const amount = inv.structured_data.totals.total_amount || 0;
      acc[currency] = (acc[currency] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);
  }, [completedInvoices]);

  const totalInUserCurrency = useMemo(() => {
    let total = 0;
    // We assume rates are relative to USD
    // If an invoice is in EUR, we convert it to USD then to userCurrency
    // Rate for EUR (from USD base) is e.g. 0.9. So 1 USD = 0.9 EUR. 1 EUR = 1/0.9 USD.
    
    Object.entries(totalAmountByCurrency).forEach(([curr, amount]) => {
      if (curr === 'Unknown') return;
      
      let amountInUSD = amount;
      if (curr !== 'USD' && rates[curr]) {
        amountInUSD = amount / rates[curr];
      } else if (curr !== 'USD' && !rates[curr]) {
        // Fallback or ignore if rate unknown
        return;
      }
      
      const userRate = rates[userCurrency] || 1;
      total += amountInUSD * userRate;
    });
    return total;
  }, [totalAmountByCurrency, rates, userCurrency]);

  const selectedInvoice = invoices.find(inv => inv.id === selectedInvoiceId);

  // Recurring detection logic
  const recurringInvoiceIds = useMemo(() => {
    const completed = invoices.filter(inv => inv.status === 'completed');
    const merchants = new Map<string, ProcessedInvoice[]>();
    
    completed.forEach(inv => {
      const name = inv.structured_data.merchant.name.toLowerCase().trim();
      if (!name) return;
      if (!merchants.has(name)) merchants.set(name, []);
      merchants.get(name)!.push(inv);
    });

    const recurringIds = new Set<string>();
    merchants.forEach((list) => {
      if (list.length < 2) return;
      
      // Sort by date to analyze patterns
      const sorted = [...list].sort((a, b) => {
        const da = new Date(a.structured_data.invoice_details.date).getTime();
        const db = new Date(b.structured_data.invoice_details.date).getTime();
        return da - db;
      });

      const dates = sorted
        .map(inv => new Date(inv.structured_data.invoice_details.date))
        .filter(d => !isNaN(d.getTime()));

      if (dates.length < 2) return;

      // Calculate gaps in days
      const gaps = [];
      for (let i = 1; i < dates.length; i++) {
        const diff = (dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24);
        gaps.push(diff);
      }

      // Pattern match: Monthly (25-35 days), Weekly (6-8 days), Quarterly (85-95 days)
      const matchesPattern = gaps.some(g => 
        (g >= 25 && g <= 35) || // Monthly
        (g >= 6 && g <= 8) ||   // Weekly
        (g >= 80 && g <= 100) || // Quarterly
        (g >= 355 && g <= 375)   // Yearly
      );

      // If we see a pattern OR just too many from same merchant (e.g. 3+), flag as potentially recurring
      if (matchesPattern || list.length >= 3) {
        list.forEach(inv => recurringIds.add(inv.id));
      }
    });

    return recurringIds;
  }, [invoices]);

  // Responsive PDF width
  const [pdfWidth, setPdfWidth] = useState(600);
  const pdfContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node !== null) {
      const resizeObserver = new ResizeObserver(entries => {
        for (let entry of entries) {
          const width = entry.contentRect.width;
          setPdfWidth(Math.min(width - 40, 800)); // padding adjustment
        }
      });
      resizeObserver.observe(node);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 overflow-x-hidden">
      {/* Navigation */}
      <nav className="px-4 sm:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100 relative group overflow-hidden shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent group-hover:translate-x-full transition-transform duration-500" />
              <FileText className="text-white w-6 h-6" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">
                Invoicify<span className="text-brand">.ai</span>
              </h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[7px] font-black uppercase text-slate-400 tracking-widest">Neural Buffer Active</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button 
              onClick={() => setShowMobileSearch(!showMobileSearch)}
              className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-xl transition-all"
            >
              <Search className="w-5 h-5" />
            </button>
            <button 
               onClick={handleReset}
               className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className={cn(
          "flex-1 max-w-xl md:mx-8 relative group",
          showMobileSearch ? "flex w-full" : "hidden md:flex"
        )}>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 w-4 h-4 group-focus-within:text-brand transition-colors" />
          <input 
            type="text"
            placeholder="Search merchants, keywords, summaries..."
            className="w-full pl-12 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-4 focus:ring-brand/5 focus:bg-white transition-all placeholder:text-slate-400 outline-none"
            value={searchQuery || ''}
            onChange={(e) => setSearchQuery(e.target.value)}
            title="Global Search: Surface data across merchant names, line items, and neural summaries"
          />
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0 px-2 sm:px-0">
           {lastSaved && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest leading-none">Workspace Saved</span>
                <span className="text-[9px] font-bold text-slate-400 tabular-nums">{lastSaved}</span>
              </div>
           )}
           <Link 
             to="/docs"
             className="px-3 sm:px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand hover:border-brand/20 transition-all flex items-center gap-2 shrink-0 shadow-sm"
           >
             <Info className="w-4 h-4" />
             <span className="hidden sm:inline">Docs</span>
           </Link>
           <button 
             onClick={() => setShowVendorModal(true)}
             className="px-3 sm:px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand hover:border-brand/20 transition-all flex items-center gap-2 shrink-0 shadow-sm"
             title="Vendor Management: Store and manage frequent vendor metadata"
           >
             <Users className="w-4 h-4" />
             <span className="hidden sm:inline">Vendors</span>
           </button>
           <div className="h-8 w-[1px] bg-slate-100 hidden sm:block mx-1"></div>
           <button 
             onClick={() => setShowSettings(!showSettings)}
             className={cn(
               "p-2.5 rounded-xl transition-all shrink-0",
               showSettings ? "bg-brand text-white shadow-lg shadow-brand/20" : "bg-slate-50 text-slate-500 hover:bg-slate-100 border border-slate-100"
             )}
             title="AI Extraction Layer Settings: Configure which neural fields to prioritize"
           >
             <Settings className="w-5 h-5" />
           </button>
           <button 
             onClick={handleReset}
             className="hidden md:flex text-slate-400 font-bold hover:text-red-500 transition-all items-center gap-2 px-4 py-2.5 rounded-xl hover:bg-red-50 text-xs shrink-0"
             title="Clear Workspace: Reset all data and neural buffers"
           >
             <RefreshCcw className="w-3.5 h-3.5" /> Reset
           </button>
        </div>
      </nav>

      {/* Filter Bar */}
      <div className="px-4 sm:px-8 py-4 bg-white border-b border-slate-100 flex flex-wrap items-center gap-4 sm:gap-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Filters:</span>
        </div>
        
         <div className="flex items-center gap-3">
          <select 
            className="bg-slate-50 border-none rounded-xl text-xs font-bold py-2 px-3 focus:ring-2 focus:ring-brand/20 outline-none"
            value={filterCategory || 'All'}
            onChange={(e) => setFilterCategory(e.target.value)}
            title="Filter by document dimension or merchant vertical"
          >
            <option value="All">All Categories</option>
            {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input 
            type="date"
            className="bg-slate-50 border-none rounded-xl text-xs font-bold py-2 px-3 focus:ring-2 focus:ring-brand/20 outline-none"
            value={dateRange.start || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            title="Filter by audit window start date"
          />
          <span className="text-slate-300 font-medium">to</span>
          <input 
            type="date"
            className="bg-slate-50 border-none rounded-xl text-xs font-bold py-2 px-3 focus:ring-2 focus:ring-brand/20 outline-none"
            value={dateRange.end || ''}
            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            title="Filter by audit window end date"
          />
          {(dateRange.start || dateRange.end) && (
            <button 
              onClick={() => setDateRange({ start: '', end: '' })} 
              className="text-slate-400 hover:text-red-500 transition-colors p-1"
              title="Clear active temporal filters"
            >
              <RefreshCcw className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex-1"></div>

        <div className="flex items-center gap-4">
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Viewing {filteredInvoices.length} of {invoices.length} Invoices
          </div>
          {completedInvoices.length > 0 && (
            <button 
              onClick={() => downloadBulkCsv(completedInvoices, 'workspace_export.csv')}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-brand-dark transition-all shadow-lg shadow-brand/20 ml-2"
              title="Download all processed data as CSV"
            >
              <TableIcon className="w-3.5 h-3.5" />
              Export Workspace
            </button>
          )}
        </div>
      </div>

      {showSettings && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="px-8 py-6 bg-indigo-900 border-b border-indigo-800 text-white"
        >
          <div className="max-w-7xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Extraction Intelligence Settings</h3>
                <p className="text-indigo-300 text-xs">Configure which neural layers Gemini should prioritize during document analysis.</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-indigo-400 hover:text-white"><RefreshCcw className="w-5 h-5 rotate-45" /></button>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {['Merchant Name', 'Invoice Number', 'Date', 'Total Amount', 'Line Items', 'Tax Details', 'Payment Info', 'Bank Details'].map(field => (
                <button
                  key={field}
                  onClick={() => setExtractionFields(prev => prev.includes(field) ? prev.filter(f => f !== field) : [...prev, field])}
                  className={cn(
                    "px-4 py-3 rounded-2xl border text-xs font-bold transition-all text-left flex items-center justify-between",
                    extractionFields.includes(field) ? "bg-white text-indigo-900 border-white" : "border-indigo-700 text-indigo-400 hover:border-indigo-500"
                  )}
                >
                  {field}
                  {extractionFields.includes(field) && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </button>
              ))}
            </div>

            <div className="pt-6 border-t border-indigo-800">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-brand">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Default Display Currency</h4>
                      <p className="text-indigo-400 text-[10px]">Override the automatic geo-IP detection and choose your preferred currency for display and conversion.</p>
                    </div>
                  </div>
                  <select 
                    className="bg-indigo-950 border border-indigo-700 text-white rounded-xl px-4 py-2.5 text-xs font-bold focus:ring-2 focus:ring-brand outline-none cursor-pointer"
                    value={userCurrency}
                    onChange={(e) => setUserCurrency(e.target.value)}
                  >
                    {['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CNY', 'HKD'].map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                    {Object.keys(rates).filter(r => !['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'SGD', 'AED', 'CNY', 'HKD'].includes(r)).sort().map(curr => (
                      <option key={curr} value={curr}>{curr}</option>
                    ))}
                  </select>
               </div>
            </div>
          </div>
        </motion.div>
      )}

      <main className="max-w-7xl mx-auto w-full p-4 sm:p-8 grid grid-cols-12 gap-6 sm:gap-8 flex-1 items-stretch">
        {/* Left Column: List & Totals */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div 
            {...getRootProps()} 
            className={cn(
              "relative group overflow-hidden bg-white p-8 sm:p-10 border-2 border-dashed rounded-[2.5rem] flex flex-col items-center justify-center text-center transition-all duration-700 cursor-pointer shadow-2xl shadow-brand/5 border-slate-100",
              isDragActive ? "border-brand bg-brand/5 scale-[0.98]" : "hover:border-brand/40 hover:scale-[1.01]"
            )}
          >
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }} />
            <input {...getInputProps()} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.04),transparent)] pointer-events-none" />
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand/5 rounded-3xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700">
               <div className="w-12 h-12 sm:w-14 sm:h-14 bg-brand rounded-2xl flex items-center justify-center shadow-lg shadow-brand/30">
                 <Upload className="w-6 h-6 sm:w-7 h-7 text-white" />
               </div>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">Drag & Drop Invoices</h2>
            <p className="text-[10px] sm:text-xs text-slate-400 mt-3 font-medium max-w-[200px] leading-relaxed">Securely ingest PDF, PNG, or JPG document streams or click to browse.</p>
            <div 
              className="mt-8 px-6 py-2.5 bg-brand text-white rounded-full text-[10px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-500"
              title="Initiate neural scanning and data extraction sequence"
            >
               Begin Deep Scan
            </div>
          </div>

          {completedInvoices.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group"
             >
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand/20 blur-[80px] -mr-24 -mt-24 pointer-events-none" />
                <div className="relative z-10">
                   <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-8">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Workspace Stats</p>
                        <h4 className="text-lg font-black text-white">Cumulative Audit</h4>
                      </div>
                      <div className="p-2 bg-white/5 rounded-xl">
                        <Sparkles className="w-5 h-5 text-brand" />
                      </div>
                   </div>
                   <div className="space-y-6">
                      {Object.keys(totalAmountByCurrency).length > 0 ? (
                        <div className="space-y-4">
                          {Object.entries(totalAmountByCurrency).map(([curr, amount]) => (
                            <div key={curr} className="flex justify-between items-end border-b border-white/5 pb-4">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{curr}</span>
                                  <p className="text-[8px] text-slate-600 font-bold">Base Extraction</p>
                               </div>
                               <span className="text-2xl font-black text-white leading-none">{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          ))}
                          
                          {userCurrency !== 'Unknown' && totalInUserCurrency > 0 && (
                            <div className="pt-4 mt-2 px-6 py-5 bg-brand/10 border border-brand/20 rounded-3xl group/local">
                               <div className="flex justify-between items-center mb-2">
                                 <div className="flex items-center gap-2">
                                   <Globe className="w-3 h-3 text-brand" />
                                   <span className="text-[9px] font-black text-brand uppercase tracking-widest">Local Conversion ({userCurrency})</span>
                                 </div>
                                 <div className="px-1.5 py-0.5 bg-brand text-white rounded text-[7px] font-black">LIVE RATE</div>
                               </div>
                               <div className="flex items-baseline gap-2">
                                 <span className="text-4xl font-black text-brand tracking-tighter">
                                   {totalInUserCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                 </span>
                                 <span className="text-xs font-black text-brand/40 uppercase">{userCurrency}</span>
                                </div>
                               <p className="text-[8px] font-medium text-slate-500 mt-2 leading-tight">
                                 Neural conversion based on your geo-location. Rates are fetched in real-time for maximum audit precision.
                               </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="py-4 text-slate-500 text-[10px] font-black uppercase tracking-widest">No Extraction Data</div>
                      )}
                   </div>
                    <div className="grid grid-cols-2 gap-3 mt-8">
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadBulkCsv(completedInvoices, 'workspace_export.csv'); }}
                        className="py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400 border border-white/5 transition-all"
                        title="Download aggregated workspace data as Excel-compatible CSV"
                      >
                        Export CSV
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); downloadJson(completedInvoices, 'workspace_export.json'); }}
                        className="py-3 bg-white/5 hover:bg-white/10 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-400 border border-white/5 transition-all"
                        title="Download raw document structure as programmatic JSON"
                      >
                        Export JSON
                      </button>
                   </div>
                   <button 
                    onClick={() => setSelectedInvoiceId('bulk')}
                    className="w-full mt-3 py-4 bg-brand hover:bg-brand-dark rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-brand/20 transition-all transform hover:-translate-y-1"
                    title="Generate a multi-document AI executive summary via Gemini 1.5 Pro"
                   >
                     AI Summary Report
                   </button>
                </div>
             </motion.div>
          )}

          <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col flex-1 relative min-h-[300px]">
             <div className="absolute inset-0 opacity-[0.01] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
             <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50 relative z-10">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Stream Buffer</h4>
                </div>
                <div className="flex items-center gap-3">
                   {completedInvoices.length > 1 && (
                     <div className="flex items-center gap-1.5">
                       <button 
                         onClick={() => downloadBulkCsv(completedInvoices, 'workspace_export.csv')}
                         className="p-1.5 text-slate-400 hover:text-brand transition-colors"
                         title="Export ALL as CSV"
                       >
                         <TableIcon className="w-4 h-4" />
                       </button>
                       <button 
                         onClick={() => downloadJson(completedInvoices, 'workspace_export.json')}
                         className="p-1.5 text-slate-400 hover:text-brand transition-colors"
                         title="Export ALL as JSON"
                       >
                         <FileJson className="w-4 h-4" />
                       </button>
                       <div className="h-4 w-[1px] bg-slate-200 mx-1" />
                     </div>
                   )}
                   <div className="px-2.5 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-500 tabular-nums">
                     {filteredInvoices.length}
                   </div>
                </div>
             </div>
             <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
              <AnimatePresence initial={false}>
                {filteredInvoices.map((inv) => (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    onClick={() => inv.status === 'completed' && setSelectedInvoiceId(inv.id)}
                    className={cn(
                      "p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group relative overflow-hidden",
                      selectedInvoiceId === inv.id ? "bg-white border-brand shadow-sm" : 
                      inv.status === 'completed' ? "bg-white border-slate-100" : "bg-slate-100 border-transparent opacity-60"
                    )}
                  >
                    <div className="flex items-center gap-3 overflow-hidden z-10 w-full">
                      <div className="flex-shrink-0">
                        {inv.status === 'processing' ? <Loader2 className="w-4 h-4 text-brand animate-spin" /> : 
                         inv.status === 'error' ? <AlertCircle className="w-4 h-4 text-red-500" /> : 
                         <CheckCircle2 className="w-4 h-4 text-emerald-500" /> }
                      </div>
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-800 truncate">{inv.fileName}</p>
                          {recurringInvoiceIds.has(inv.id) && (
                            <div 
                              className="px-1.5 py-0.5 bg-indigo-50 text-brand rounded-md text-[7px] font-black border border-indigo-100 flex items-center gap-0.5 shrink-0"
                              title="Recurring Transaction Detected: This merchant appears periodically in your audit stream."
                            >
                              <RefreshCcw className="w-2 h-2" />
                              RECURRING
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[9px] text-slate-400 uppercase font-black tracking-tight flex items-center gap-1">
                            {inv.status === 'completed' ? inv.structured_data.merchant.name : inv.status}
                          </p>
                          {inv.status === 'completed' && inv.structured_data.merchant.email && (
                            <span className="text-[7px] font-bold text-brand/50 truncate max-w-[100px]" title={`Billed from: ${inv.structured_data.merchant.email}`}>
                              • {inv.structured_data.merchant.email}
                            </span>
                          )}
                          {inv.category && (
                            <span className="px-1.5 py-0.5 bg-brand/10 text-brand rounded uppercase text-[7px] font-black border border-brand/20">
                              {inv.category}
                            </span>
                          )}
                        </div>
                      </div>
                       {inv.status === 'completed' && (
                        <div className="text-right flex items-center gap-3">
                           <div className="flex flex-col">
                             <p className="text-[10px] font-black text-slate-900">{inv.structured_data.totals.total_amount?.toFixed(2)}</p>
                             <p className="text-[8px] font-bold text-slate-400 uppercase">{inv.structured_data.invoice_details.currency}</p>
                           </div>
                           <button 
                            onClick={(e) => { e.stopPropagation(); deleteInvoice(inv.id); }}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            title="Delete invoice from neural buffer"
                           >
                             <Trash2 className="w-3.5 h-3.5" />
                           </button>
                        </div>
                      )}
                      {inv.status === 'error' && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); deleteInvoice(inv.id); }}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-all"
                          title="Remove failed document"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {inv.status === 'processing' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200">
                         <motion.div 
                           className="h-full bg-brand"
                           initial={{ width: "0%" }}
                           animate={{ width: "95%" }}
                           transition={{ duration: 15, ease: "linear" }}
                         />
                      </div>
                    )}
                  </motion.div>
                ))}
                {filteredInvoices.length === 0 && (
                  <div className="py-20 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 group">
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5 text-slate-200" />
                      </div>
                    </div>
                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Buffer Empty</h5>
                    <p className="text-[9px] font-medium text-slate-400 mt-2 max-w-[150px] mx-auto">
                      {searchQuery ? "No matching documents found in buffer." : "Neural buffer is currently clear. Drop files to begin ingestion."}
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Right Column: Viewer */}
        <div className="col-span-12 lg:col-span-8 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-h-[700px] overflow-hidden">
          {selectedInvoiceId === 'bulk' ? (
            <div className="flex flex-col h-full bg-slate-900 text-white">
               <div className="p-8 border-b border-white/5">
                 <h2 className="text-3xl font-black tracking-tight mb-2">Aggregated Workspace Summary</h2>
                 <p className="text-slate-500 text-sm">Deep analysis across {completedInvoices.length} extracted documents.</p>
               </div>
               <div className="flex-1 p-8 overflow-y-auto">
                 {isGeneratingBulkSummary ? (
                   <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-500">
                     <Loader2 className="w-12 h-12 animate-spin text-brand" />
                     <p className="font-bold uppercase tracking-widest text-xs">Generating neural audit...</p>
                   </div>
                 ) : bulkSummary ? (
                   <div className="prose prose-invert prose-slate max-w-none prose-sm bg-white/5 p-8 rounded-3xl border border-white/10 relative group">
                      <ReactMarkdown>{bulkSummary}</ReactMarkdown>
                      <button 
                        onClick={() => copyToClipboard(bulkSummary)}
                        className="absolute top-4 right-4 p-2 text-white/20 hover:text-white transition-colors"
                      >
                        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                   </div>
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center p-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                        <Sparkles className="w-8 h-8 text-brand" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Detailed Audit Available</h3>
                      <p className="text-slate-500 text-sm max-w-xs mb-8">Generate a synthesized report of all current invoices to identify trends, vendors, and total exposure.</p>
                      <button 
                        onClick={() => generateBulkSummary(completedInvoices)}
                        className="px-8 py-3 bg-brand rounded-2xl font-bold shadow-lg shadow-brand/20 hover:bg-brand-dark transition-all"
                      >
                        Generate Bulk Analysis
                      </button>
                   </div>
                 )}
               </div>
            </div>
          ) : selectedInvoice ? (
            <>
              {/* Single Invoice Header */}
              <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                 <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-brand">
                        <Building2 className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 group">
                          <input 
                            className="text-2xl font-black text-slate-800 tracking-tight bg-transparent border-none focus:ring-0 w-full hover:bg-slate-100 transition-colors cursor-text"
                            value={selectedInvoice.structured_data.merchant.name || ''}
                            onChange={(e) => updateInvoice(selectedInvoice.id, { 
                              structured_data: { ...selectedInvoice.structured_data, merchant: { ...selectedInvoice.structured_data.merchant, name: e.target.value } } 
                            })}
                          />
                          {selectedInvoice.structured_data.merchant.email && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-brand/5 border border-brand/10 rounded-lg shrink-0">
                              <Mail className="w-3 h-3 text-brand/60" />
                              <span className="text-[10px] font-bold text-brand/80">{selectedInvoice.structured_data.merchant.email}</span>
                            </div>
                          )}
                          {selectedInvoice.confidence_scores?.merchant < 0.8 && <AlertCircle className="w-4 h-4 text-amber-500" />}
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <input 
                              type="date"
                              className="text-[10px] font-black uppercase text-slate-600 bg-transparent border-none p-0 focus:ring-0"
                              value={selectedInvoice.structured_data.invoice_details.date || ''}
                              onChange={(e) => updateInvoice(selectedInvoice.id, { 
                                structured_data: { ...selectedInvoice.structured_data, invoice_details: { ...selectedInvoice.structured_data.invoice_details, date: e.target.value } } 
                              })}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-slate-400" />
                            <input 
                              className="text-[10px] font-black uppercase text-slate-600 bg-transparent border-none p-0 focus:ring-0 w-24"
                              value={selectedInvoice.structured_data.invoice_details.number || ''}
                              onChange={(e) => updateInvoice(selectedInvoice.id, { 
                                structured_data: { ...selectedInvoice.structured_data, invoice_details: { ...selectedInvoice.structured_data.invoice_details, number: e.target.value } } 
                              })}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       <button 
                         onClick={() => {
                           const vendor: Vendor = {
                             id: Math.random().toString(36).substring(7),
                             name: selectedInvoice.structured_data.merchant.name,
                             email: selectedInvoice.structured_data.merchant.email || '',
                             address: selectedInvoice.structured_data.merchant.address || '',
                             category: selectedInvoice.category || ''
                           };
                           if (vendors.find(v => v.name.toLowerCase() === vendor.name.toLowerCase())) {
                             alert("Vendor already exists in your management database.");
                           } else {
                             setVendors(prev => [...prev, vendor]);
                             alert("Vendor profiles updated successfully.");
                           }
                         }}
                         className="p-2 text-slate-300 hover:text-brand transition-colors"
                         title="Neural Save: Cache this merchant's profile for future auto-population"
                       >
                         <Users className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => deleteInvoice(selectedInvoice.id)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                       >
                         <Trash2 className="w-5 h-5" />
                       </button>
                       <button 
                        onClick={() => downloadJson(selectedInvoice, `${selectedInvoice.fileName}.json`)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 shadow-sm"
                       >
                         <FileJson className="w-3.5 h-3.5" /> JSON
                       </button>
                       <button 
                         onClick={() => downloadCsv(selectedInvoice.structured_data, `${selectedInvoice.fileName}.csv`)}
                         className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors shadow-lg"
                       >
                         <TableIcon className="w-3.5 h-3.5" /> CSV
                       </button>
                    </div>
                 </div>

                 <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 border-b border-slate-200">
                    <div className="flex overflow-x-auto no-scrollbar scroll-smooth">
                      {(['preview', 'summary', 'data', 'text'] as const).map((tab) => (
                        <button 
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={cn(
                            "px-6 py-4 border-b-2 font-bold text-[10px] uppercase tracking-widest transition-all",
                            activeTab === tab ? "border-brand text-brand" : "border-transparent text-slate-400 hover:text-slate-600"
                          )}
                          title={`Switch to ${tab} perspective`}
                        >
                          {tab === 'preview' ? 'Invoice View' : tab === 'data' ? 'Line Items' : tab === 'text' ? 'Raw Strings' : 'Analysis'}
                        </button>
                      ))}
                    </div>

                    <div className="flex-1 flex items-center justify-end gap-3 pb-2">
                       <div className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/5 border border-brand/10 rounded-full">
                          <span className="text-[9px] font-black uppercase text-brand/60">Category</span>
                          <select 
                            className="bg-transparent border-none p-0 text-[10px] font-black uppercase tracking-tight text-brand focus:ring-0"
                            value={selectedInvoice.category || ''}
                            onChange={(e) => updateInvoice(selectedInvoice.id, { category: e.target.value })}
                          >
                             <option value="">Uncategorized</option>
                             {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                          <button 
                            onClick={() => {
                              const name = prompt("Enter custom category name:");
                              if (name) addCustomCategory(name);
                            }}
                            className="w-4 h-4 bg-brand text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                            title="Create and assign a custom neural classification bucket"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                       </div>

                       {!selectedInvoice.category && selectedInvoice.suggested_category && (
                         <motion.button 
                           initial={{ opacity: 0, x: 20 }}
                           animate={{ opacity: 1, x: 0 }}
                           onClick={() => {
                             addCustomCategory(selectedInvoice.suggested_category);
                             updateInvoice(selectedInvoice.id, { category: selectedInvoice.suggested_category });
                           }}
                           className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-100 border border-amber-200 rounded-full text-amber-700 hover:bg-amber-200 transition-all group shadow-sm shadow-amber-100"
                           title={`Gemini predicted classification: "${selectedInvoice.suggested_category}". Click to approve and train.`}
                         >
                            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-tight">Suggest: {selectedInvoice.suggested_category}</span>
                            <div className="w-4 h-4 bg-amber-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 transition-all">
                              <Check className="w-3 h-3" />
                            </div>
                         </motion.button>
                       )}
                       
                       {selectedInvoice.confidence_scores && (
                         <div className="flex items-center gap-4 border-l border-slate-200 pl-4">
                            <div className="flex flex-col">
                              <span className="text-[7px] font-bold text-slate-400 uppercase">Extraction Accuracy</span>
                              <div className="flex gap-1 mt-0.5">
                                 {Object.entries(selectedInvoice.confidence_scores).map(([k, v]) => (
                                   <div 
                                      key={k} 
                                      className={cn("w-1.5 h-1.5 rounded-full", v > 0.8 ? "bg-emerald-500" : v > 0.5 ? "bg-amber-500" : "bg-red-500")}
                                      title={`${k}: ${(v * 100).toFixed(0)}%`}
                                   />
                                 ))}
                              </div>
                            </div>
                         </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="flex-1 p-8 overflow-y-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={selectedInvoice.id + activeTab}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.02 }}
                  >
                    {activeTab === 'preview' && (
                      <div ref={pdfContainerRef} className="flex flex-col items-center bg-slate-100 rounded-3xl p-4 min-h-[600px] shadow-inner overflow-hidden w-full">
                        {selectedInvoice.fileUrl ? (
                          selectedInvoice.fileType.includes('pdf') ? (
                            <div className="w-full h-full flex flex-col items-center overflow-auto custom-scrollbar gap-8 py-4">
                              <Document
                                file={selectedInvoice.fileUrl}
                                onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                loading={
                                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-brand" />
                                    <p className="text-[10px] font-black uppercase text-slate-400">Loading document engine...</p>
                                  </div>
                                }
                                error={
                                  <div className="py-20 text-red-500 font-bold text-xs uppercase text-center">
                                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                                    Failed to load PDF preview.
                                  </div>
                                }
                              >
                                {Array.from(new Array(numPages || 0), (el, index) => (
                                  <div key={`page_${index + 1}`} className="mb-8 last:mb-0">
                                    <Page 
                                      pageNumber={index + 1} 
                                      width={pdfWidth} 
                                      renderAnnotationLayer={false}
                                      renderTextLayer={false}
                                      className="shadow-2xl border border-slate-200"
                                    />
                                    <p className="mt-2 text-center text-[8px] font-bold text-slate-400 uppercase tracking-widest">Page {index + 1} of {numPages}</p>
                                  </div>
                                ))}
                              </Document>
                              <p className="text-[9px] font-black uppercase text-slate-400">Preview: Document View (Multi-Page Mode)</p>
                            </div>
                          ) : (
                            <div className="w-full flex justify-center">
                              <img 
                                src={selectedInvoice.fileUrl} 
                                alt="Invoice Preview" 
                                className="max-w-full h-auto rounded-xl shadow-2xl border border-slate-200"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          )
                        ) : (
                          <div className="py-20 text-slate-400 text-xs font-bold">Preview not available</div>
                        )}
                      </div>
                    )}

                    {activeTab === 'summary' && (
                      <div className="relative group p-8 bg-white border border-slate-100 rounded-3xl shadow-sm">
                        <div className="prose prose-slate max-w-none prose-sm">
                          <ReactMarkdown>{selectedInvoice.summary}</ReactMarkdown>
                        </div>
                        <button 
                          onClick={() => copyToClipboard(selectedInvoice.summary)}
                          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-brand transition-colors"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                    )}

                    {activeTab === 'data' && (
                      <div className="space-y-6">
                        {selectedInvoice.structured_data.billed_to && (
                          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col md:flex-row justify-between gap-6 shadow-inner">
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Recipient Identity</h5>
                              <p className="text-sm font-bold text-slate-800">{selectedInvoice.structured_data.billed_to.name || 'Unknown Recipient'}</p>
                            </div>
                            <div className="space-y-2">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none flex items-center gap-2">
                                <Mail className="w-3 h-3" /> Billed Email
                              </h5>
                              <p className="text-[11px] font-mono font-medium text-slate-500 break-all">{selectedInvoice.structured_data.billed_to.email || 'Email not detected'}</p>
                            </div>
                            <div className="space-y-2 max-w-xs">
                              <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none flex items-center gap-2">
                                <MapPin className="w-3 h-3" /> Billing Address
                              </h5>
                              <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{selectedInvoice.structured_data.billed_to.address || 'Address not available'}</p>
                            </div>
                          </div>
                        )}
                        <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                          <table className="data-grid text-sm">
                            <thead>
                              <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Quantity</th>
                                <th className="px-6 py-4 text-right">Raw Amount</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {selectedInvoice.structured_data.line_items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4 font-bold text-slate-700">{item.description}</td>
                                  <td className="px-6 py-4 font-mono text-slate-400">{item.quantity}</td>
                                  <td className="px-6 py-4 text-right font-black text-slate-900">
                                    {selectedInvoice.structured_data.invoice_details.currency} {item.amount?.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex justify-end pr-4">
                           <div className="w-full max-w-xs space-y-3 text-right">
                              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <span>TAX ({selectedInvoice.structured_data.invoice_details.currency})</span>
                                <span>{selectedInvoice.structured_data.totals.tax_amount?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between items-baseline text-2xl font-black text-brand pt-4 border-t border-slate-100">
                                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300">TOTAL</span>
                                <div className="flex items-center gap-1">
                                  <span>{selectedInvoice.structured_data.invoice_details.currency}</span>
                                  <input 
                                    className="bg-transparent border-none p-0 text-right w-32 focus:ring-0"
                                    type="number"
                                    step="0.01"
                                    value={selectedInvoice.structured_data.totals.total_amount?.toFixed(2) || '0.00'}
                                    onChange={(e) => updateInvoice(selectedInvoice.id, {
                                      structured_data: { 
                                        ...selectedInvoice.structured_data, 
                                        totals: { ...selectedInvoice.structured_data.totals, total_amount: parseFloat(e.target.value) || 0 } 
                                      }
                                    })}
                                  />
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'text' && (
                      <div className="bg-slate-900 rounded-3xl p-8 relative overflow-hidden group min-h-[400px]">
                         <button 
                            onClick={() => copyToClipboard(selectedInvoice.full_text)}
                            className="absolute top-6 right-6 p-2 text-slate-600 hover:text-white transition-colors"
                          >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <pre className="text-slate-400 font-mono text-[10px] leading-loose whitespace-pre-wrap">
                            {selectedInvoice.full_text}
                          </pre>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 sm:p-20 relative overflow-hidden bg-white">
               {/* Advanced Decorative Background */}
               <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(79,70,229,0.08),transparent)] pointer-events-none" />
               <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
               <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }} />
               
               <motion.div 
                 initial={{ opacity: 0, scale: 0.8, rotate: -20 }}
                 animate={{ opacity: 1, scale: 1, rotate: 12 }}
                 transition={{ duration: 1.2, type: 'spring', bounce: 0.4 }}
                 className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(79,70,229,0.15)] flex items-center justify-center mb-8 sm:mb-10 relative z-10 border border-slate-50"
               >
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 text-brand" />
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-brand rounded-full flex items-center justify-center border-4 border-white shadow-lg"
                  >
                    <Sparkles className="w-3 h-3 text-white" />
                  </motion.div>
               </motion.div>

               <motion.div
                 initial={{ opacity: 0, y: 20 }}
                 animate={{ opacity: 1, y: 0 }}
                 transition={{ delay: 0.2 }}
                 className="relative z-10 px-4"
               >
                 <h3 className="text-3xl sm:text-5xl font-black tracking-tighter text-slate-900 max-w-sm mx-auto leading-[0.9] mb-6">
                   Ready to <span className="text-brand">Extract</span> Data?
                 </h3>
                 <p className="text-xs sm:text-sm font-medium text-slate-400 max-w-xs mx-auto leading-relaxed">
                   Ingest your invoice streams into the neural buffer to begin deep extraction and workspace analysis.
                 </p>
                 
                 <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
                    <Link 
                      to="/docs"
                      className="group px-8 py-3.5 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-brand hover:border-brand/30 transition-all flex items-center gap-3 shadow-xl shadow-slate-200/50 hover:shadow-brand/10"
                    >
                      View Documentation
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>

                    <div className="flex items-center gap-8 sm:gap-12">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-black text-slate-800 tracking-tighter">1.5B+</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Parameters</span>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden sm:block" />
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-2xl font-black text-slate-800 tracking-tighter">100%</span>
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Secure</span>
                      </div>
                    </div>
                 </div>
               </motion.div>

               {/* Bottom Decoration to fill space */}
               <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50/50 to-transparent pointer-events-none" />
            </div>
          )}
        </div>
      </main>

      {showVendorModal && (
        <VendorManagementModal 
          vendors={vendors} 
          onClose={() => setShowVendorModal(false)} 
          onDelete={(id) => setVendors(prev => prev.filter(v => v.id !== id))}
          onAdd={(v) => setVendors(prev => [...prev, { ...v, id: Math.random().toString(36).substring(7) }])}
          categories={allCategories}
        />
      )}

      <footer className="px-8 py-10 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              © 2026 Invoicify AI. All processing happens in real-time.
            </p>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 mt-2">
              A Brilworks Team Innovation
            </p>
          </div>
          <div className="flex items-center gap-8">
            <span className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Neural Sandbox Secure
            </span>
            <div className="w-px h-4 bg-slate-100" />
            <a href="https://invoice.brilworks.com" className="text-[9px] font-black uppercase tracking-widest text-brand hover:underline">
              invoice.brilworks.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function VendorManagementModal({ vendors, onClose, onDelete, onAdd, categories }: { 
  vendors: Vendor[], 
  onClose: () => void, 
  onDelete: (id: string) => void,
  onAdd: (v: Omit<Vendor, 'id'>) => void,
  categories: string[]
}) {
  const [newVendor, setNewVendor] = useState<Omit<Vendor, 'id'>>({ name: '', email: '', address: '', category: '' });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Vendor Management</h2>
            <p className="text-xs text-slate-400 font-medium">Store frequent vendor signatures for neural auto-population.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
             <RefreshCcw className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Form */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4">Register New Vendor</h3>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Entity Name</label>
                    <input 
                      className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-brand/20 outline-none"
                      placeholder="e.g. AWS, Starbucks"
                      value={newVendor.name || ''}
                      onChange={(e) => setNewVendor({...newVendor, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Billing Email Address</label>
                    <input 
                      className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-brand/20 outline-none"
                      placeholder="billing@vendor.com"
                      value={newVendor.email || ''}
                      onChange={(e) => setNewVendor({...newVendor, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Corporate Address</label>
                    <textarea 
                      className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-brand/20 outline-none resize-none h-20"
                      placeholder="123 Tech Lane..."
                      value={newVendor.address || ''}
                      onChange={(e) => setNewVendor({...newVendor, address: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Classification Pipeline</label>
                    <select 
                      className="w-full bg-white border border-slate-100 rounded-xl px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-brand/20 outline-none"
                      value={newVendor.category || ''}
                      onChange={(e) => setNewVendor({...newVendor, category: e.target.value})}
                    >
                      <option value="">Select Category</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    if (!newVendor.name) return;
                    onAdd(newVendor);
                    setNewVendor({ name: '', email: '', address: '', category: '' });
                  }}
                  className="w-full py-3 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-brand/20 hover:scale-[1.02] transition-all"
                >
                  Save Entity
                </button>
              </div>
            </div>

            {/* List */}
            <div className="lg:col-span-8">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Master Vendor Registry ({vendors.length})</h3>
              <div className="space-y-4">
                {vendors.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-100">
                    <Users className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-[10px] font-black uppercase text-slate-300">No cached entities found</p>
                  </div>
                ) : (
                  vendors.map(vendor => (
                    <div key={vendor.id} className="p-5 border border-slate-100 rounded-3xl flex items-center justify-between hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h4 className="text-sm font-bold text-slate-800">{vendor.name}</h4>
                             {vendor.category && (
                               <span className="px-1.5 py-0.5 bg-brand/5 text-brand rounded-md text-[7px] font-black uppercase tracking-tighter">
                                 {vendor.category}
                               </span>
                             )}
                          </div>
                          <p className="text-[10px] font-medium text-slate-400">{vendor.email || 'No email saved'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => onDelete(vendor.id)}
                        className="p-2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
