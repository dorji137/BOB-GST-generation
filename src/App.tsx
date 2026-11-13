import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import {
  CalculatedTransaction,
  CleanedTransaction,
  CalculationSettings,
  HeaderMapping,
  ChannelType
} from './types';
import {
  cleanImportedRows,
  filterTransactions,
  calculateTransactions,
  calculateMerchantSummary,
  calculateDailySummaries,
  calculateMonthlyCertificates,
  guessHeaderMapping,
  normalizeCurrency,
  RejectedRow
} from './utils/calculator';
import bobLogo from './assets/bob-logo.png';
import StatsCards from './components/StatsCards';
import DailySummaryTable from './components/DailySummaryTable';
import GstCertificate from './components/GstCertificate';
import {
  Upload,
  UploadCloud,
  FileText,
  Sliders,
  DollarSign,
  TrendingUp,
  Award,
  ListFilter,
  CheckCircle,
  Database,
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  Calendar,
  Download
} from 'lucide-react';

export default function App() {
  const [rawText, setRawText] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<Array<Record<string, any>>>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  
  // Mapping of headers
  const [mapping, setMapping] = useState<HeaderMapping>({
    merchantIdField: '',
    apprAmtField: '',
    reqDateField: '',
    currencyField: '',
    merchantNameField: ''
  });

  // Unique elements found in current uploaded file
  const [availableMids, setAvailableMids] = useState<string[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([]);

  // Calculation parameters
  const [channel, setChannel] = useState<ChannelType>('POS');
  const [mdrPercent, setMdrPercent] = useState<number>(3.00);
  const [gstPercent, setGstPercent] = useState<number>(5.00);
  
  const [selectedMid, setSelectedMid] = useState<string>('');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('');
  const [merchantName, setMerchantName] = useState<string>('POSTCARD DEWA THIMPHU BT');
  const [gstNumber, setGstNumber] = useState<string>('C10035414');

  // Step outputs
  const [cleanedTxns, setCleanedTxns] = useState<CleanedTransaction[]>([]);
  const [rejectedTxns, setRejectedTxns] = useState<RejectedRow[]>([]);
  const [filteredTxns, setFilteredTxns] = useState<CleanedTransaction[]>([]);
  const [skippedTxns, setSkippedTxns] = useState<CleanedTransaction[]>([]);
  const [calculatedTxns, setCalculatedTxns] = useState<CalculatedTransaction[]>([]);

  // Tab management
  const [activeTab, setActiveTab] = useState<'overview' | 'certificates' | 'daily'>('overview');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync default MDR when channel changes
  useEffect(() => {
    if (channel === 'POS') {
      setMdrPercent(3.00);
    } else {
      setMdrPercent(3.50);
    }
  }, [channel]);

  // Read raw payload and trigger mapping defaults
  const handleParseCsvText = (csvString: string, filename: string = 'pasted_data.csv') => {
    if (!csvString.trim()) return;
    
    Papa.parse(csvString, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.data && results.data.length > 0) {
          const rowKeys = Object.keys(results.data[0]);
          setHeaders(rowKeys);
          const guessed = guessHeaderMapping(rowKeys);
          setMapping(guessed);
          setParsedRows(results.data as Array<Record<string, any>>);
          setFileName(filename);
          
          // Extrapolate list of available Merchant IDs & Currencies from raw data
          const mids = new Set<string>();
          const currs = new Set<string>();
          
          results.data.forEach((row: any) => {
            const rawMid = row[guessed.merchantIdField];
            if (rawMid !== undefined && rawMid !== null && String(rawMid).trim() !== '') {
              mids.add(String(rawMid).trim());
            }
            const rawCurr = row[guessed.currencyField];
            if (rawCurr !== undefined && rawCurr !== null) {
              const normalized = normalizeCurrency(rawCurr);
              if (normalized) currs.add(normalized);
            }
          });

          const uniqueMidsList = Array.from(mids).sort();
          const uniqueCurrsList = Array.from(currs).sort();

          setAvailableMids(uniqueMidsList);
          setAvailableCurrencies(uniqueCurrsList);

          // Default set chosen MID and currency to first detected ones
          if (uniqueMidsList.length > 0) {
            setSelectedMid(uniqueMidsList[0]);
          }
          if (uniqueCurrsList.length > 0) {
            // Prefer BTN if present, otherwise first available
            if (uniqueCurrsList.includes('BTN')) {
              setSelectedCurrency('BTN');
            } else {
              setSelectedCurrency(uniqueCurrsList[0]);
            }
          } else {
            setSelectedCurrency('BTN');
          }
        }
      },
      error: (err) => {
        alert('Failed parsing CSV: ' + err.message);
      }
    });
  };

  // Process uploaded or dropped files
  const processFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'xlsx' || extension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          if (!worksheet) {
            alert('The uploaded Excel file seems to be empty.');
            return;
          }
          const csvText = XLSX.utils.sheet_to_csv(worksheet, { rawNumbers: true });
          setRawText(csvText);
          handleParseCsvText(csvText, file.name);
        } catch (err: any) {
          alert('Failed parsing Excel: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setRawText(text);
        handleParseCsvText(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  // Drag and drop / local file picker actions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  };

  const handleReset = () => {
    setRawText('');
    setParsedRows([]);
    setHeaders([]);
    setFileName('');
    setCleanedTxns([]);
    setRejectedTxns([]);
    setFilteredTxns([]);
    setSkippedTxns([]);
    setCalculatedTxns([]);
    setAvailableMids([]);
    setAvailableCurrencies([]);
    setSelectedMid('');
    setSelectedCurrency('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Re-run execution pipeline whenever mapped fields, parsed content, MID, currency, MDR, or GST updates
  useEffect(() => {
    if (parsedRows.length === 0) return;

    // Step 1: Clean imported rows (remove footers, missing/invalid mid, appr amt <= 0, dates)
    const { cleaned, rejected } = cleanImportedRows(parsedRows, mapping);
    setCleanedTxns(cleaned);
    setRejectedTxns(rejected);

    // Step 2: Filter rows (MID = selected MID, Billing Currency = selected Currency)
    const { filtered, skipped } = filterTransactions(cleaned, selectedMid, selectedCurrency);
    setFilteredTxns(filtered);
    setSkippedTxns(skipped);

    // Automatically check for Merchant Name in the excel-mapped column or loosely matching headers
    if (filtered.length > 0) {
      const firstRow = filtered[0].originalRow;
      let foundName = '';
      
      if (mapping.merchantNameField && firstRow[mapping.merchantNameField]) {
        foundName = String(firstRow[mapping.merchantNameField]).trim();
      }
      
      if (!foundName) {
        // Fallback: search loosely in keys for 'merchantname', etc.
        const keys = Object.keys(firstRow);
        const matchedKey = keys.find(k => {
          const norm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          return norm === 'merchantname' || norm === 'mname' || norm === 'merchant' || norm === 'merchantbusiness';
        });
        if (matchedKey && firstRow[matchedKey]) {
          foundName = String(firstRow[matchedKey]).trim();
        }
      }

      if (foundName) {
        setMerchantName(foundName);
      }
    }

    // Step 3: Calculate transaction-level values
    const calculated = calculateTransactions(filtered, mdrPercent, gstPercent);
    setCalculatedTxns(calculated);

  }, [parsedRows, mapping, selectedMid, selectedCurrency, mdrPercent, gstPercent]);

  // Aggregate results
  const merchantSummary = calculateMerchantSummary(calculatedTxns);
  const dailySummaries = calculateDailySummaries(calculatedTxns, mdrPercent, gstPercent);
  const monthlyCertificates = calculateMonthlyCertificates(calculatedTxns, mdrPercent, gstPercent);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800" id="app-root-container">
      {/* Premium White Corporate Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-xs" id="app-header-navigation">
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <img src={bobLogo} alt="Bank of Bhutan" className="h-14 w-auto" />
            <div className="border-l border-slate-200 pl-3">
              <h1 className="text-base font-bold tracking-tight text-[#0B7BAE] font-sans">GST Settlement Terminal</h1>
              <p className="text-[11px] text-slate-500 font-medium">Merchant Acquiring &amp; Audit Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
            <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full text-emerald-800 font-semibold shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Secure Audit System Live
            </span>
            {parsedRows.length > 0 && (
              <>
                <div className="hidden sm:block h-4 w-px bg-slate-200"></div>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                  id="btn-reset-data"
                >
                  <RotateCcw className="w-3 h-3" />
                  Clear System
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8" id="application-main-layout">
        {/* Global Hidden File Input - always mounted so it works from both welcome state and sidebar triggers */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          accept=".csv,.txt,.xlsx,.xls" 
          className="hidden" 
        />
        
        {/* Left Side: Upload Panel + Settings Configurations */}
        <section className="lg:col-span-4 space-y-6 flex flex-col" id="panel-configuration-workspace">
          
          {/* File Upload card - only shown after data is parsed, preventing dual upload inputs on initial display */}
          {parsedRows.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative overflow-hidden" id="card-upload-file">
              <div className="flex items-center gap-2.5 mb-4">
                <Upload className="w-4 h-4 text-[#0B7BAE]" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Import Transaction File</h2>
              </div>

              {/* Simulated Drag & Drop Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    processFile(file);
                  }
                }}
                className="border-2 border-dashed border-slate-250 hover:border-[#1CA7E0] rounded-xl p-6 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-[#1CA7E0]/5 group"
                id="upload-dropzone"
              >
                <UploadCloud className="w-8 h-8 mx-auto text-slate-400 group-hover:text-[#0B7BAE] transition-colors mb-2" />
                <p className="text-xs font-semibold text-slate-700 group-hover:text-[#0B7BAE] transition-colors">
                  {fileName ? `Loaded: ${fileName}` : 'Click or Drag File (.csv, .xlsx, .xls)'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">Accepts CSV, TXT, or Excel Spreadsheets</p>
              </div>
            </div>
          )}

          {/* Settings Customizer and mappings card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex-1" id="card-calculation-parameters">
            <div className="flex items-center gap-2.5 mb-4">
              <Sliders className="w-4 h-4 text-[#0B7BAE]" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Processing Settings</h2>
            </div>

            <div className="space-y-4">
              
              {/* Channel Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Payment Channel
                </label>
                <div className="grid grid-cols-2 gap-2" id="channel-pill-group">
                  <button
                    onClick={() => setChannel('POS')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      channel === 'POS'
                        ? 'bg-[#1CA7E0]/10 border-[#1CA7E0]/25 text-[#0B7BAE]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    id="channel-btn-pos"
                  >
                    POS (Terminals)
                    <span className="block text-[9px] font-medium opacity-70">Def: 3.00% MDR</span>
                  </button>
                  <button
                    onClick={() => setChannel('IPG')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      channel === 'IPG'
                        ? 'bg-[#1CA7E0]/10 border-[#1CA7E0]/25 text-[#0B7BAE]'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                    id="channel-btn-ipg"
                  >
                    IPG (Online Gateway)
                    <span className="block text-[9px] font-medium opacity-70">Def: 3.50% MDR</span>
                  </button>
                </div>
              </div>

              {/* Dynamic MID Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Selected MID (Merchant ID)
                </label>
                <div className="flex gap-2">
                  {availableMids.length > 0 ? (
                    <select
                      value={selectedMid}
                      onChange={(e) => setSelectedMid(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#1CA7E0] focus:outline-hidden"
                      id="select-mid-picker"
                    >
                      {availableMids.map((mid) => (
                        <option key={mid} value={mid}>
                          {mid}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={selectedMid}
                      onChange={(e) => setSelectedMid(e.target.value)}
                      placeholder="e.g. 100200300"
                      className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#1CA7E0] focus:outline-hidden"
                      id="input-fallback-mid"
                    />
                  )}
                </div>
              </div>

              {/* Dynamic Currency Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                  Selected Currency
                </label>
                {availableCurrencies.length > 0 ? (
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#1CA7E0] focus:outline-hidden"
                    id="select-currency-picker"
                  >
                    {availableCurrencies.map((curr) => (
                      <option key={curr} value={curr}>
                        {curr} {curr === 'BTN' && '(Bhutanese Ngultrum)'} {curr === 'INR' && '(Indian Rupee)'} {curr === 'USD' && '(US Dollar)'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={selectedCurrency}
                    onChange={(e) => setSelectedCurrency(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#1CA7E0] focus:outline-hidden"
                    id="select-currency-picker-fallback"
                  >
                    <option value="BTN">BTN (Bhutanese Ngultrum - 64)</option>
                    <option value="INR">INR (Indian Rupee - 356)</option>
                    <option value="USD">USD (US Dollar - 840)</option>
                  </select>
                )}
              </div>

              {/* Rates overrides */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex justify-between">
                    <span>MDR Rate %</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={mdrPercent}
                      onChange={(e) => setMdrPercent(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-mono font-semibold text-slate-900 focus:border-[#1CA7E0] focus:outline-hidden"
                      id="input-mdr-override"
                    />
                    <sup className="absolute right-3 top-3 text-[10px] font-semibold text-slate-400">%</sup>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    GST Rate %
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={gstPercent}
                      onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                      className="w-full bg-white border border-slate-200 rounded-xl pl-3 pr-7 py-2 text-xs font-mono font-semibold text-slate-900 focus:border-[#1CA7E0] focus:outline-hidden"
                      id="input-gst-override"
                    />
                    <sup className="absolute right-3 top-3 text-[10px] font-semibold text-slate-400">%</sup>
                  </div>
                </div>
              </div>

              {/* Merchant Details customization */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Merchant Name (Printed)
                  </label>
                  <input
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    className="w-full bg-[#FAFBFC] border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-905 focus:border-[#1CA7E0] focus:outline-hidden"
                    id="input-merchant-name-field"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    GST TIN Number
                  </label>
                  <input
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="w-full bg-[#FAFBFC] border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-semibold text-slate-905 focus:border-[#1CA7E0] focus:outline-hidden"
                    id="input-gst-number-field"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* Right Side: Tabbed Interface for calculations logic steps 3, 4, 5, 6 */}
        <section className="lg:col-span-8 flex flex-col space-y-6" id="panel-output-workspace">
          
          {parsedRows.length === 0 ? (
            /* Welcome Empty State Card */
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs flex-1 flex flex-col justify-center items-center" id="card-welcome-dashboard">
              <div className="p-4 bg-[#1CA7E0]/5 text-[#0B7BAE] rounded-2xl mb-4 shadow-xs border border-[#1CA7E0]/10">
                <Database className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#0B7BAE] tracking-tight">GST Settlement Terminal</h2>
              <p className="text-xs text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
                Import local bank transaction ledger sheets (.csv, .xlsx, .xls) to auto-clean row data, override MDR channel values, estimate GST withholdings, and print compliance certificates.
              </p>
              
              <div className="mt-8 flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-[#1CA7E0] hover:bg-[#1592C6] text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                  id="welcome-btn-upload"
                >
                  <Upload className="w-4 h-4" />
                  Upload Statement File
                </button>
              </div>

              {/* Info Tips */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 w-full text-left pt-8 border-t border-slate-150 text-slate-500 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                    <CheckCircle className="w-3.5 h-3.5 text-[#0B7BAE]" />
                    1. File Cleaning
                  </h4>
                  <p className="mt-1 font-normal leading-relaxed text-[11px] text-slate-400">Removes ledger footers, blank values, mismatching headers, and unapproved transactions.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                    <ListFilter className="w-3.5 h-3.5 text-[#0B7BAE]" />
                    2. Filtering State
                  </h4>
                  <p className="mt-1 font-normal leading-relaxed text-[11px] text-slate-400">Pipes transaction streams by Selected Merchant ID and currencies cleanly.</p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5 font-sans">
                    <Award className="w-3.5 h-3.5 text-[#0B7BAE]" />
                    3. Cert Generation
                  </h4>
                  <p className="mt-1 font-normal leading-relaxed text-[11px] text-slate-400">Creates instant government-ready PDF transaction summary deduction certificates.</p>
                </div>
              </div>
            </div>
          ) : (
            /* Results Presentation Console */
            <>
              {/* Dynamic Instant Download Notice Banner */}
              {monthlyCertificates.length > 0 && (
                <div className="bg-[#1CA7E0] border border-[#1CA7E0]/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 text-white shadow-md relative overflow-hidden" id="fast-track-pdf-downloader">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="flex items-center gap-3.5 text-left relative z-10">
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/20 shrink-0">
                      <Award className="w-5 h-5 text-amber-300 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-widest leading-none mb-1">
                        Official Statement Built
                      </h4>
                      <p className="text-xs text-slate-200 font-normal leading-relaxed">
                        The official Bank of Bhutan GST Deduction audit report for <span className="font-bold underline text-white">{monthlyCertificates[0].monthName}</span> is ready for instant export.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const triggerBtn = document.getElementById(`btn-pdf-download-${monthlyCertificates[0].monthKey}`);
                      if (triggerBtn) {
                        triggerBtn.click();
                      } else {
                        // Switch active tab to certificates as fallback so they see the button on screen
                        setActiveTab('certificates');
                      }
                    }}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-[#E0A915] active:scale-95 text-slate-950 text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2 cursor-pointer whitespace-nowrap relative z-10"
                    id="fast-track-pdf-btn"
                  >
                    <Download className="w-4 h-4 text-slate-950" />
                    Download PDF Certificate
                  </button>
                </div>
              )}

              {/* Action tabs corresponding directly to calculations steps */}
              <div className="flex bg-slate-200/50 p-1 rounded-xl self-start gap-1" id="tab-nav-deck">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-white text-[#0B7BAE] shadow-xs'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
                  }`}
                  id="tab-nav-overview"
                >
                  <TrendingUp className="w-3.5 h-3.5 text-[#0B7BAE]" />
                  Overall Summary
                </button>

                <button
                  onClick={() => setActiveTab('certificates')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'certificates'
                      ? 'bg-white text-[#0B7BAE] shadow-xs'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
                  }`}
                  id="tab-nav-certificates"
                >
                  <Award className="w-3.5 h-3.5 text-[#0B7BAE]" />
                  Deduction Certificate
                </button>

                <button
                  onClick={() => setActiveTab('daily')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'daily'
                      ? 'bg-white text-[#0B7BAE] shadow-xs'
                      : 'text-slate-600 hover:text-slate-800 hover:bg-white/40'
                  }`}
                  id="tab-nav-daily"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#0B7BAE]" />
                  Daily Volumes
                </button>
              </div>

              {/* Tab: Overview (Overall Summary) */}
              {activeTab === 'overview' && (
                <div className="space-y-6" id="overview-pane">
                  {/* Status Banner */}
                  <div className="bg-[#1CA7E0] text-white rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-md relative overflow-hidden border-b-4 border-amber-400" id="overview-banner">
                    <div className="absolute right-0 top-0 w-32 h-32 bg-amber-400/5 rounded-full blur-2xl pointer-events-none"></div>
                    <div className="relative z-10">
                      <h3 className="text-base font-bold tracking-tight">Active Computational Ledger</h3>
                      <p className="text-xs text-slate-200 mt-1 max-w-lg leading-relaxed">
                        Displaying calculated sums for merchant <span className="font-mono font-bold bg-slate-950/40 px-1.5 py-0.5 rounded text-[11px] text-amber-350">{selectedMid}</span> running under channel <span className="font-bold underline">{channel}</span> ({mdrPercent.toFixed(2)}% MDR, {gstPercent.toFixed(2)}% GST).
                      </p>
                    </div>
                    <div className="relative z-10 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs flex flex-col items-end border border-white/15">
                      <span className="font-bold">{calculatedTxns.length} Transactions matched</span>
                      <span className="text-[10px] text-amber-200 font-medium">from {cleanedTxns.length} validated rows</span>
                    </div>
                  </div>

                  {/* Merchant Overall Summary cards */}
                  <StatsCards
                    summary={merchantSummary}
                    settings={{
                      channel,
                      mdrPercent,
                      gstPercent,
                      selectedMid,
                      selectedCurrency
                    }}
                  />

                  {/* Summary progress breakdown info */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 text-slate-600 space-y-4 text-xs shadow-xs">
                    <h4 className="font-bold text-[#0B7BAE] flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-[#0B7BAE]" />
                      Calculations &amp; Formulas Applied (Verification Walkthrough)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded-xl border border-slate-200/50">
                        <span className="font-mono text-[11px] text-slate-400 block mb-1">MDR Rate Deduction</span>
                        <p className="font-semibold text-slate-800">
                          Appr Amt × {mdrPercent}% = MDR Amount
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Example for 1,000 Appr Amt is {(1000 * mdrPercent / 100).toFixed(2)}
                        </p>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200/50">
                        <span className="font-mono text-[11px] text-slate-400 block mb-1">GST Tax on MDR</span>
                        <p className="font-semibold text-slate-800">
                          MDR Amount × {gstPercent}% = GST Amount
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Example for {(1000 * mdrPercent / 100).toFixed(2)} MDR is {((1000 * mdrPercent / 100) * gstPercent / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Certificates (grouping months) */}
              {activeTab === 'certificates' && (
                <div className="space-y-6" id="certificates-pane">
                  <div className="bg-[#1CA7E0] text-white rounded-2xl p-6 shadow-md border-b-4 border-amber-400">
                    <h3 className="text-base font-bold tracking-tight">GST Calculation Certificate</h3>
                    <p className="text-xs text-slate-200 mt-1 max-w-xl leading-relaxed">
                      Official bank compliance reporting certificate generated based on transaction datasets, compliant with revenue guidelines of the Royal Government of Bhutan.
                    </p>
                  </div>

                  {monthlyCertificates.length === 0 ? (
                    <div className="bg-white border rounded-2xl p-12 text-center text-slate-400 font-medium">
                      <Award className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm">No certificate dataset calculated.</p>
                      <p className="text-xs text-slate-400 mt-1">Upload matching transactions to view the deduction certificate.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="split-certificates-grid">
                      {monthlyCertificates.map(summary => (
                        <GstCertificate
                           key={summary.monthKey}
                           summary={summary}
                           settings={{
                             channel,
                             mdrPercent,
                             gstPercent,
                             selectedMid,
                             selectedCurrency,
                             merchantName,
                             gstNumber
                           }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Daily Volumes (grouping days) */}
              {activeTab === 'daily' && (
                <div className="space-y-6" id="daily-pane">
                  <DailySummaryTable
                    dailySummaries={dailySummaries}
                    settings={{
                      channel,
                      mdrPercent,
                      gstPercent,
                      selectedMid,
                      selectedCurrency
                    }}
                  />
                </div>
              )}
            </>
          )}

        </section>
      </main>

      {/* Footer Area with current local system time */}
      <footer className="mt-auto bg-slate-900 border-t border-slate-800 py-6 text-center text-[11px] text-slate-400" id="site-footer">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; 2026 <strong className="text-slate-300">Dorji Lhendup Tenzin</strong> (EID 2892). All rights reserved.</p>
          <div className="flex gap-4">
            <span>Server Time: <strong className="text-slate-300 font-mono">2026-06-09 09:04:06 UTC</strong></span>
            <span>Channel Default Rates: <strong className="text-slate-300">POS (3%), IPG (3.5%), GST (5%)</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
