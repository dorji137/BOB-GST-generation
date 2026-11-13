import React, { useState } from 'react';
import { MonthlySummaryRow, CalculationSettings } from '../types';
import { Download, Printer, Loader2, Award, Calendar, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import headerImg from '../assets/header.png';
import footerImg from '../assets/footer.png';

// Letterhead taken from the official "Header footer format" Word sample (A4 @ 96dpi = 794x1123px)
const PdfHeader = () => (
  <div style={{ position: 'absolute', top: '57px', left: '96px', width: '602px' }}>
    <img src={headerImg} alt="" style={{ display: 'block', width: '600px', height: '101px' }} />
    <div style={{ position: 'absolute', left: '0px', top: '40px', fontFamily: 'Calibri, Carlito, Arial, sans-serif', fontSize: '13.3px', color: '#000000', whiteSpace: 'nowrap' }}>
      Digital Banking Services Department
    </div>
  </div>
);

const PdfFooter = () => (
  <div style={{ position: 'absolute', bottom: '52px', left: '96px', width: '602px', textAlign: 'center' }}>
    <img src={footerImg} alt="" style={{ display: 'inline-block', width: '450px', height: '31px' }} />
  </div>
);

interface GstCertificateProps {
  key?: string | number;
  summary: MonthlySummaryRow;
  settings: CalculationSettings;
}

export default function GstCertificate({ summary, settings }: GstCertificateProps) {
  const [downloading, setDownloading] = useState(false);

  const formattedMdr = settings.mdrPercent.toFixed(2);
  const formattedGst = settings.gstPercent.toFixed(2);
  const certId = `BOB-GST-${summary.monthKey.replace('-', '')}-${settings.selectedMid.substring(0, 5)}`;

  // Helper inside formatting
  const fNum = (num: number) => {
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getCurrencyISO = (curr: string) => {
    if (curr === 'BTN') return 'code 64';
    if (curr === 'INR') return 'code 356';
    if (curr === 'USD') return 'code 840';
    return `code ${curr}`;
  };

  // Dedicated high quality PDF export function using secure sandbox iframe to bypass oklch parsing errors
  const handleDownloadPDF = async () => {
    setDownloading(true);
    const pdfNode = document.getElementById(`bob-pdf-generator-sandbox-${summary.monthKey}`);
    if (!pdfNode) {
      setDownloading(false);
      return;
    }

    // Create sandbox iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '794px';
    iframe.style.height = '1123px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      iframe.remove();
      setDownloading(false);
      alert('Failed to initialize rendering sandbox. Please try again.');
      return;
    }

    // Initialize document with clean styling and premium typography
    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            body {
              margin: 0;
              padding: 0;
              background-color: #ffffff;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          </style>
        </head>
        <body>
          <div id="render-target"></div>
        </body>
      </html>
    `);
    iframeDoc.close();

    // Await fonts loading completely inside the rendering sandbox
    if (iframeDoc.fonts && iframeDoc.fonts.ready) {
      try {
        await iframeDoc.fonts.ready;
      } catch (fontErr) {
        console.warn('Sandbox fonts failed to preload, falling back on system typography:', fontErr);
      }
    }

    const renderTarget = iframeDoc.getElementById('render-target');
    if (!renderTarget) {
      iframe.remove();
      setDownloading(false);
      alert('Failed to query rendering sandbox targets. Please try again.');
      return;
    }

    try {
      // Temporarily reveal sandbox node
      pdfNode.style.display = 'block';

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageElements = pdfNode.querySelectorAll('.bob-pdf-page');

      for (let i = 0; i < pageElements.length; i++) {
        const pageEl = pageElements[i] as HTMLElement;
        
        // Clone and mount inside sandbox
        renderTarget.innerHTML = '';
        const clonedPage = pageEl.cloneNode(true) as HTMLElement;
        renderTarget.appendChild(clonedPage);

        // Wait minor tick for mounting / layout computations
        await new Promise((resolve) => setTimeout(resolve, 30));
        await Promise.all(Array.from(clonedPage.querySelectorAll('img')).map((im) => im.complete ? Promise.resolve() : new Promise((r) => { im.onload = im.onerror = () => r(null); })));

        // Render high resolution canvas from inside the iframe's context!
        const canvas = await html2canvas(clonedPage, {
          scale: 2.2, // extra crisp vector emulation
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 210; // A4 standard width in mm
        const pageHeight = 297; // A4 standard height in mm

        if (i > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, pageHeight, undefined, 'FAST');
      }

      const filename = `BOB_GST_Certificate_${summary.monthKey}_MID_${settings.selectedMid}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Failed to compile PDF certificate:', err);
      alert('Error during PDF conversion. Please reload and try again.');
    } finally {
      pdfNode.style.display = 'none';
      iframe.remove();
      setDownloading(false);
    }
  };

  const hrPrint = () => {
    window.print();
  };

  // Chunking detailed transactions into batches for multi-page Annexure A
  const itemsPerPage = 20;
  const txList = summary.transactions || [];
  const chunkedTxList: any[][] = [];
  if (txList.length === 0) {
    chunkedTxList.push([]);
  } else {
    for (let i = 0; i < txList.length; i += itemsPerPage) {
      chunkedTxList.push(txList.slice(i, i + itemsPerPage));
    }
  }

  // Custom metadata variables
  const merchantNamePrint = settings.merchantName || 'POSTCARD DEWA THIMPHU BT';
  const gstNumberPrint = settings.gstNumber || 'C10035414';

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-full" id={`card-cert-${summary.monthKey}`}>
      {/* Visual Header */}
      <div className="bg-slate-950 p-5 text-white flex justify-between items-center border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] bg-slate-850 text-sky-200 font-bold px-2 py-0.5 rounded-md border border-slate-700/80 uppercase">
              Bhutanese Standard Compliant
            </span>
          </div>
          <h3 className="text-sm font-bold mt-1 tracking-tight">{summary.monthName} Certificate</h3>
        </div>
        
        <div className="flex gap-2">
          {/* Main download PDF Trigger */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-3.5 py-1.5 bg-[#1CA7E0] hover:bg-[#1592C6] text-white rounded-lg transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
            id={`btn-pdf-download-${summary.monthKey}`}
          >
            {downloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-white" />
                Download Bank Of Bhutan PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Screen Preview Card Component Wrapper */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-5">
          {/* Top visual summary card */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100 font-medium">
              <span className="font-bold text-slate-800 uppercase tracking-wide">Statement Details</span>
              <span className="text-slate-400 break-all">MID: {settings.selectedMid}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block font-medium">Settlement Month</span>
                <span className="font-bold text-slate-800">{summary.monthName}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Merchant Business</span>
                <span className="font-bold text-slate-800 truncate block">{merchantNamePrint}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">GST Registry</span>
                <span className="font-mono font-bold text-[#0B7BAE]">{gstNumberPrint}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Deductions Applied</span>
                <span className="font-bold text-slate-800">{formattedMdr}% MDR &amp; {formattedGst}% GST</span>
              </div>
            </div>
          </div>

          {/* Quick core ledger figures */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <div className="flex justify-between text-xs font-semibold py-1">
              <span className="text-slate-500">Gross Transaction Volume</span>
              <span className="font-mono text-slate-900">{fNum(summary.monthlyGross)} {settings.selectedCurrency}</span>
            </div>
            <div className="flex justify-between text-xs py-1">
              <span className="text-slate-500">Total Charged Commission (MDR)</span>
              <span className="font-mono text-slate-600">-{fNum(summary.monthlyMdr)} {settings.selectedCurrency}</span>
            </div>
            <div className="flex justify-between text-xs py-1">
              <span className="text-slate-500">GST on Commission ({formattedGst}%)</span>
              <span className="font-mono text-slate-600">-{fNum(summary.monthlyGst)} {settings.selectedCurrency}</span>
            </div>
            <div className="flex justify-between text-xs font-bold py-1 bg-amber-50/50 -mx-2 px-2 rounded-lg">
              <span className="text-amber-800">Total Deduction amount</span>
              <span className="font-mono text-amber-900">{fNum(summary.monthlyDeduction)} {settings.selectedCurrency}</span>
            </div>
            <div className="flex justify-between text-xs font-extrabold py-2 bg-slate-900 text-white rounded-lg px-3 mt-2 font-sans tracking-tight">
              <span>Net Settled Payable</span>
              <span className="font-mono text-amber-300">{fNum(summary.monthlyNetPayable)} {settings.selectedCurrency}</span>
            </div>
          </div>
        </div>

        {/* Small footer print indicator */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400">
          <span className="flex items-center gap-1 font-mono uppercase bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 text-[9px] font-bold text-[#0B7BAE]">
            {summary.monthlyTxnCount} transactions verified
          </span>
          <span>Click Button to Download Official PDF</span>
        </div>
      </div>

      {/* =====================================================================
          HIDDEN OFFSCREEN VECTOR-PERFECT BOB PDF GENERATOR TEMPLATE
          We shape it exactly like the bank's corporate layouts.
          ===================================================================== */}
      <div 
        id={`bob-pdf-generator-sandbox-${summary.monthKey}`} 
        className="hidden select-none outline-none"
        style={{ width: '0px', height: '0px', overflow: 'hidden' }}
      >
        <div style={{ width: '794px', background: '#ffffff' }}>
          
          {/* PAGE 1: OFFICIAL REGISTERED GST DEDUCTION CERTIFICATE */}
          <div 
            className="bob-pdf-page"
            style={{ 
              width: '794px', 
              height: '1123px', 
              padding: '172px 60px 100px', 
              backgroundColor: '#ffffff',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: "'Inter', sans-serif",
              position: 'relative',
              pageBreakAfter: 'always'
            }}
          >
            <div style={{ width: '100%' }}>
              
{/* Official letterhead header (from Header footer format .docx) */}
<PdfHeader />

              {/* Premium Title Card */}
              <div style={{ 
                backgroundColor: '#f8fafc', 
                border: '1px solid #e2e8f0',
                borderLeft: '6px solid #1CA7E0', 
                padding: '14px 24px', 
                borderRadius: '8px',
                marginBottom: '14px'
              }}>
                <h1 style={{ 
                  fontSize: '28px', 
                  fontWeight: '800', 
                  color: '#0B7BAE', 
                  margin: 0, 
                  fontFamily: "'Inter', sans-serif",
                  letterSpacing: '-0.5px'
                }}>
                  GST DEDUCTION CERTIFICATE
                </h1>
                <p style={{ fontSize: '11px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
                  Issued in accordance with the Fiscal Incentives Act of Bhutan
                </p>
              </div>

              {/* Section 1 Card: Merchant & Registry Details */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                padding: '12px 20px',
                marginBottom: '14px'
              }}>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: '700', 
                  color: '#0B7BAE', 
                  marginBottom: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px' 
                }}>
                  I. Merchant & Registry Details
                </div>
                
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: '1px solid #cbd5e1' 
                }}>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', height: '26px' }}>
                      <td style={{ width: '40%', padding: '5px 14px', fontSize: '11px', color: '#64748b', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Merchant Name</td>
                      <td style={{ width: '60%', padding: '5px 14px', fontSize: '11px', color: '#1e293b', fontWeight: '600' }}>{merchantNamePrint}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#64748b', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Merchant ID (MID)</td>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#0B7BAE', fontWeight: '600', fontFamily: "'JetBrains Mono', monospace" }}>{settings.selectedMid}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#64748b', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Tax / GST Registration No.</td>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#1e293b', fontWeight: '600', fontFamily: "'JetBrains Mono', monospace" }}>{gstNumberPrint}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#64748b', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Statement Period</td>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#1e293b', fontWeight: '600' }}>{summary.monthName}</td>
                    </tr>
                    <tr style={{ height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#64748b', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Acquiring Channel</td>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#1e293b', fontWeight: '600', textTransform: 'capitalize' }}>{settings.channel}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 2 Card: Financial Statement Particulars */}
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                backgroundColor: '#ffffff',
                padding: '12px 20px',
                marginBottom: '14px'
              }}>
                <div style={{ 
                  fontSize: '15px', 
                  fontWeight: '700', 
                  color: '#0B7BAE', 
                  marginBottom: '12px', 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.5px' 
                }}>
                  II. Financial Statement Particulars
                </div>

                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'collapse', 
                  borderRadius: '8px', 
                  overflow: 'hidden', 
                  border: '1px solid #cbd5e1' 
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1CA7E0', height: '42px' }}>
                      <th style={{ width: '60%', padding: '5px 14px', fontSize: '11px', textTransform: 'uppercase', color: '#ffffff', borderRight: '1px solid rgba(255,255,255,0.15)', textAlign: 'left', fontWeight: '700', letterSpacing: '0.5px' }}>
                        Particulars
                      </th>
                      <th style={{ width: '40%', padding: '5px 14px', fontSize: '11px', textTransform: 'uppercase', color: '#ffffff', textAlign: 'right', fontWeight: '700', letterSpacing: '0.5px' }}>
                        Amount ({settings.selectedCurrency})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#475569', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Gross Acquiring Transaction Volume</td>
                      <td style={{ padding: '5px 14px', fontSize: '12px', color: '#101827', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600' }}>{fNum(summary.monthlyGross)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', backgroundColor: '#f8fafc', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#475569', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Bank Merchant Discount Rate Commission (MDR {formattedMdr}%)</td>
                      <td style={{ padding: '5px 14px', fontSize: '12px', color: '#C44B4B', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600' }}>-{fNum(summary.monthlyMdr)}</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#475569', borderRight: '1px solid #cbd5e1', fontWeight: '500' }}>Goods and Services Tax on Commission ({formattedGst}%)</td>
                      <td style={{ padding: '5px 14px', fontSize: '12px', color: '#C44B4B', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600' }}>-{fNum(summary.monthlyGst)}</td>
                    </tr>
                    <tr style={{ borderBottom: '2px solid #1CA7E0', backgroundColor: '#f8fafc', height: '26px' }}>
                      <td style={{ padding: '5px 14px', fontSize: '11px', color: '#475569', borderRight: '1px solid #cbd5e1', fontWeight: 'bold' }}>Total Withholding Deduction (MDR + GST)</td>
                      <td style={{ padding: '5px 14px', fontSize: '12px', color: '#C44B4B', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '700' }}>-{fNum(summary.monthlyDeduction)}</td>
                    </tr>
                    <tr style={{ backgroundColor: '#E6F4EA', height: '34px' }}>
                      <td style={{ padding: '8px 14px', fontSize: '13.5px', color: '#137333', borderRight: '1px solid #cbd5e1', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                        Net Settlement Disbursed to Merchant
                      </td>
                      <td style={{ padding: '8px 14px', fontSize: '13.5px', color: '#137333', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: '800', borderBottom: '3px double #137333' }}>
                        {fNum(summary.monthlyNetPayable)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section 3 Card: Declaration */}
              <div style={{ 
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 20px',
                backgroundColor: '#f8fafc',
                marginBottom: '14px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: '#0B7BAE', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  DECLARATION
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', textAlign: 'justify' }}>
                  This is to certify that GST amounting to <strong style={{ fontWeight: '700', color: '#0B7BAE' }}>{settings.selectedCurrency || 'BTN'} {fNum(summary.monthlyGst)}</strong> has been deducted for the <strong style={{ fontWeight: '700', color: '#0B7BAE' }}>{summary.monthName}</strong>.
                </div>
                <div style={{ fontSize: '12px', color: '#475569', lineHeight: '1.6', textAlign: 'justify', marginTop: '6px' }}>
                  The GST collected is remitted to the relevant authority. This certificate may be used by the merchant as proof of GST deduction.
                </div>
              </div>

              {/* Signatory Block */}
              <div style={{ 
                marginTop: '12px', 
                display: 'flex', 
                justifyContent: 'flex-end', 
                width: '100%',
                fontFamily: "'Inter', sans-serif"
              }}>
                <div style={{ textAlign: 'center', width: '220px' }}>
                  <div style={{ height: '24px' }}></div>
                  <div style={{ borderTop: '1px solid #cbd5e1', margin: '4px 0', width: '220px' }} />
                  <div style={{ fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>
                    Authorized Signatory
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', fontWeight: '500' }}>
                    For Bank of Bhutan Ltd
                  </div>
                </div>
              </div>
            </div>

{/* Official letterhead footer (from Header footer format .docx) */}
<PdfFooter />
          </div>

          {/* PAGE 2 / MULTIPLE: ANNEXURE A TRANSACTION DETAILS */}
          {chunkedTxList.map((chunk, index) => (
            <div 
              key={index}
              className="bob-pdf-page"
              style={{ 
                width: '794px', 
                height: '1123px', 
                padding: '172px 60px 100px', 
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: "'Inter', sans-serif",
                position: 'relative',
                pageBreakAfter: index === chunkedTxList.length - 1 ? 'avoid' : 'always'
              }}
            >
              <div style={{ width: '100%' }}>
{/* Official letterhead header (from Header footer format .docx) */}
<PdfHeader />

                {/* Annexure Doc Title */}
                <div style={{ 
                  fontSize: '24px', 
                  fontWeight: '800', 
                  color: '#0B7BAE', 
                  marginBottom: '6px', 
                  textTransform: 'uppercase',
                  letterSpacing: '-0.3px'
                }}>
                  Annexure A - Transaction Ledger
                </div>
                
                {/* Billing Currency label */}
                <div style={{ 
                  fontSize: '11px', 
                  color: '#64748b', 
                  marginBottom: '20px', 
                  borderBottom: '1px solid #e2e8f0', 
                  paddingBottom: '10px' 
                }}>
                  Selected Filter Currency: <strong style={{ color: '#0B7BAE' }}>{settings.selectedCurrency} ({getCurrencyISO(settings.selectedCurrency)})</strong> | Merchant ID: <strong style={{ color: '#0B7BAE' }}>{settings.selectedMid}</strong>
                </div>

                {/* Ledger Grid Data Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #cbd5e1' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1CA7E0', height: '38px' }}>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'left', color: '#ffffff' }}>Req Date</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'left', color: '#ffffff' }}>RRN</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'left', color: '#ffffff' }}>Appr Code</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'left', color: '#ffffff' }}>Card No</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'right', color: '#ffffff' }}>Appr Amt</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'right', color: '#ffffff' }}>MDR</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'right', color: '#ffffff' }}>GST</th>
                      <th style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '10px', fontWeight: '700', textAlign: 'right', color: '#ffffff' }}>Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chunk.map((tx: any, rowIdx) => (
                      <tr 
                        key={tx.rowIndex || rowIdx}
                        style={{ 
                          borderBottom: '1px solid #e2e8f0',
                          backgroundColor: rowIdx % 2 === 1 ? '#f8fafc' : '#ffffff' 
                        }}
                      >
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', color: '#334155' }}>{tx.reqDate}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{tx.rrn || ''}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{tx.apprCode || ''}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{tx.cardNo || ''}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{fNum(tx.apprAmt)}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{fNum(tx.mdrAmount)}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#334155' }}>{fNum(tx.gstAmount)}</td>
                        <td style={{ border: '1px solid #e2e8f0', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#111827', fontWeight: '600' }}>{fNum(tx.netPayable)}</td>
                      </tr>
                    ))}

                    {/* ONLY display total row on the very last page chunk */}
                    {index === chunkedTxList.length - 1 && (
                      <tr style={{ 
                        borderBottom: '1px solid #1CA7E0', 
                        borderTop: '2px solid #1CA7E0', 
                        backgroundColor: '#f1f5f9', 
                        fontWeight: 'bold',
                        height: '42px'
                      }}>
                        <td colSpan={4} style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', color: '#0B7BAE', fontWeight: '800' }}>Total Summary</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#111827', fontWeight: '800' }}>{fNum(summary.monthlyGross)}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#C44B4B', fontWeight: '800' }}>{fNum(summary.monthlyMdr)}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#C44B4B', fontWeight: '800' }}>{fNum(summary.monthlyGst)}</td>
                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', whiteSpace: 'nowrap', lineHeight: '16px', verticalAlign: 'middle', fontSize: '11px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", color: '#137333', fontWeight: '800' }}>{fNum(summary.monthlyNetPayable)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

{/* Official letterhead footer (from Header footer format .docx) */}
<PdfFooter />
            </div>
          ))}

        </div>
      </div>

    </div>
  );
}
