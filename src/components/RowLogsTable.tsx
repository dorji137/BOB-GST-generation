import { useState } from 'react';
import { CalculatedTransaction, CleanedTransaction } from '../types';
import { RejectedRow } from '../utils/calculator';
import { CheckCircle, AlertTriangle, HelpCircle, ArrowRight, Table, Search, Sparkles } from 'lucide-react';

interface RowLogsTableProps {
  calculated: CalculatedTransaction[];
  skipped: CleanedTransaction[];
  rejected: RejectedRow[];
  selectedMid: string;
  selectedCurrency: string;
}

export default function RowLogsTable({
  calculated,
  skipped,
  rejected,
  selectedMid,
  selectedCurrency,
}: RowLogsTableProps) {
  const [activeTab, setActiveTab] = useState<'calculated' | 'skipped' | 'rejected'>('calculated');
  const [searchTerm, setSearchTerm] = useState('');

  // Number format helper
  const fNum = (n: number) => {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredCalculated = calculated.filter(tx => {
    return (
      tx.merchantId.includes(searchTerm) ||
      tx.reqDate.includes(searchTerm) ||
      String(tx.apprAmt).includes(searchTerm)
    );
  });

  const filteredSkipped = skipped.filter(tx => {
    return (
      tx.merchantId.includes(searchTerm) ||
      tx.reqDate.includes(searchTerm) ||
      String(tx.apprAmt).includes(searchTerm) ||
      tx.currency.includes(searchTerm)
    );
  });

  const filteredRejected = rejected.filter(rx => {
    // rx.row values search
    return (
      rx.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      Object.values(rx.row).some(v => String(v).toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden" id="raw-row-logs-container">
      {/* Tab controls */}
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {/* Calculated Tab */}
          <button
            onClick={() => { setActiveTab('calculated'); setSearchTerm(''); }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'calculated'
                ? 'bg-[#1CA7E0] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            id="tab-btn-calculated"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Filtered &amp; Calculated ({calculated.length})
          </button>

          {/* Skipped Tab */}
          <button
            onClick={() => { setActiveTab('skipped'); setSearchTerm(''); }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'skipped'
                ? 'bg-[#1CA7E0] text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            id="tab-btn-skipped"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Mismatched MID / Curr ({skipped.length})
          </button>

          {/* Rejected Tab */}
          <button
            onClick={() => { setActiveTab('rejected'); setSearchTerm(''); }}
            className={`px-4 py-2 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'rejected'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
            id="tab-btn-rejected"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Cleaned / Rejected ({rejected.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search records..."
            className="w-full bg-white pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:border-[#1CA7E0] focus:outline-hidden"
            id="logs-search-input"
          />
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>

      {/* Tables container */}
      <div className="overflow-x-auto min-h-64 max-h-[450px]">
        {activeTab === 'calculated' && (
          <table className="w-full text-left text-xs border-collapse" id="table-calculated">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-3">Row #</th>
                <th className="px-6 py-3">Req Date</th>
                <th className="px-6 py-3">Merchant ID</th>
                <th className="px-6 py-3 text-right">Appr Amt ({selectedCurrency})</th>
                <th className="px-6 py-3 text-right">MDR Amt</th>
                <th className="px-6 py-3 text-right">GST on MDR</th>
                <th className="px-6 py-3 text-right">Total Deduction</th>
                <th className="px-6 py-3 text-right font-bold">Net Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCalculated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400 font-medium">
                    No calculated rows found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredCalculated.map((tx, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-6 py-3.5 font-mono text-slate-400">#{tx.rowIndex}</td>
                    <td className="px-6 py-3.5 whitespace-nowrap">{tx.reqDate}</td>
                    <td className="px-6 py-3.5 font-mono font-medium">{tx.merchantId}</td>
                    <td className="px-6 py-3.5 text-right font-semibold">{fNum(tx.apprAmt)}</td>
                    <td className="px-6 py-3.5 text-right text-slate-500">{fNum(tx.mdrAmount)}</td>
                    <td className="px-6 py-3.5 text-right text-slate-500">{fNum(tx.gstAmount)}</td>
                    <td className="px-6 py-3.5 text-right text-amber-600">{fNum(tx.totalDeduction)}</td>
                    <td className="px-6 py-3.5 text-right font-bold text-emerald-600">{fNum(tx.netPayable)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'skipped' && (
          <table className="w-full text-left text-xs border-collapse" id="table-skipped">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-3">Row #</th>
                <th className="px-6 py-3">Req Date</th>
                <th className="px-6 py-3">Merchant ID</th>
                <th className="px-6 py-3">Currency</th>
                <th className="px-6 py-3 text-right">Appr Amt</th>
                <th className="px-6 py-3">Mismatch Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredSkipped.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400 font-medium">
                    No rows were skipped in Step 2. All cleaned rows matched MID "{selectedMid}" and Currency "{selectedCurrency}".
                  </td>
                </tr>
              ) : (
                filteredSkipped.map((tx, idx) => {
                  const isMidMismatch = tx.merchantId !== selectedMid;
                  const isCurrMismatch = tx.currency !== selectedCurrency;
                  let reasons: string[] = [];
                  if (isMidMismatch) reasons.push(`MID is "${tx.merchantId}" (expected "${selectedMid}")`);
                  if (isCurrMismatch) reasons.push(`Currency is "${tx.currency || 'N/A'}" (expected "${selectedCurrency}")`);

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 text-slate-600">
                      <td className="px-6 py-3.5 font-mono text-slate-400">#{tx.rowIndex}</td>
                      <td className="px-6 py-3.5 whitespace-nowrap">{tx.reqDate}</td>
                      <td className="px-6 py-3.5 font-mono">{tx.merchantId}</td>
                      <td className="px-6 py-3.5"><span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-600">{tx.currency}</span></td>
                      <td className="px-6 py-3.5 text-right font-semibold">{fNum(tx.apprAmt)}</td>
                      <td className="px-6 py-3.5 text-amber-600 font-medium">{reasons.join(' & ')}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'rejected' && (
          <table className="w-full text-left text-xs border-collapse" id="table-rejected">
            <thead className="bg-amber-50/50 border-b border-amber-100 text-slate-500 uppercase tracking-wider font-semibold sticky top-0">
              <tr>
                <th className="px-6 py-3 text-amber-800">Row #</th>
                <th className="px-6 py-3 text-amber-800">Validation Error / Clean Reason</th>
                <th className="px-6 py-3 text-amber-800">Raw Input Data Block</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredRejected.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-12 text-slate-400 font-medium">
                    Excellent! No raw rows were rejected in Step 1.
                  </td>
                </tr>
              ) : (
                filteredRejected.map((rx, idx) => (
                  <tr key={idx} className="bg-amber-50/10 hover:bg-amber-50/30">
                    <td className="px-6 py-4 font-mono text-amber-700 font-semibold align-top">#{rx.rowIndex}</td>
                    <td className="px-6 py-4 align-top">
                      <span className="inline-flex items-center gap-1 text-red-600 font-bold bg-red-50 border border-red-100 px-2.5 py-1 rounded-xl">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {rx.reason}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono text-[11px] text-slate-500 w-2/3">
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 max-h-24 overflow-y-auto whitespace-pre-wrap">
                        {JSON.stringify(rx.row, null, 2)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Step description banner */}
      <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-slate-500 flex justify-between items-center text-[11px]">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-[#0B7BAE]" />
          {activeTab === 'calculated' && 'Step 3: Calculating transaction-level results (MDR, GST, payables).'}
          {activeTab === 'skipped' && 'Step 2: Rows filtered out for selected Merchant ID + Currency.'}
          {activeTab === 'rejected' && 'Step 1: Removed rows with missing MID, invalid amounts, unparseable dates, or footers.'}
        </span>
        <span className="font-mono text-slate-400">Total in original file: {(calculated.length + skipped.length + rejected.length)}</span>
      </div>
    </div>
  );
}
