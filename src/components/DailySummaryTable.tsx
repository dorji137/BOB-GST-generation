import { DailySummaryRow, CalculationSettings } from '../types';
import { Calendar, TrendingUp, Inbox } from 'lucide-react';

interface DailySummaryTableProps {
  dailySummaries: DailySummaryRow[];
  settings: CalculationSettings;
}

export default function DailySummaryTable({ dailySummaries, settings }: DailySummaryTableProps) {
  // Format numbers to 2 decimal places
  const fNum = (n: number) => {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden" id="daily-summaries-container">
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#0B7BAE]" />
            Daily Transaction Summaries
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Calculated by grouping filtered transactions by Request Date
          </p>
        </div>
        
        {dailySummaries.length > 0 && (
          <div className="bg-[#1CA7E0]/5 border border-[#1CA7E0]/10 text-[#0B7BAE] text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 self-start">
            <TrendingUp className="w-3.5 h-3.5 text-[#0B7BAE]" />
            {dailySummaries.length} Days Processed
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        {dailySummaries.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium flex flex-col items-center justify-center">
            <Inbox className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-sm">No transaction summaries to show.</p>
            <p className="text-xs text-slate-400 mt-1">Upload a merchant database file above to begin.</p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse" id="table-daily-summary">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-400 uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3.5">Req Date</th>
                <th className="px-6 py-3.5 text-center">Txn Count</th>
                <th className="px-6 py-3.5 text-right">Gross Volume ({settings.selectedCurrency})</th>
                <th className="px-6 py-3.5 text-right font-medium">MDR Paid ({settings.mdrPercent.toFixed(2)}%)</th>
                <th className="px-6 py-3.5 text-right font-medium">GST on MDR ({settings.gstPercent.toFixed(2)}%)</th>
                <th className="px-6 py-3.5 text-right text-amber-700 font-bold">Total Deduction</th>
                <th className="px-6 py-3.5 text-right font-bold text-emerald-700">Daily Net Payable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {dailySummaries.map((row) => {
                return (
                  <tr key={row.date} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-mono font-semibold whitespace-nowrap text-slate-900">{row.date}</td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-semibold font-mono text-[11px]">
                        {row.dailyTxnCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 font-mono">{fNum(row.dailyGross)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-mono">{fNum(row.dailyMdr)}</td>
                    <td className="px-6 py-4 text-right text-slate-500 font-mono">{fNum(row.dailyGst)}</td>
                    <td className="px-6 py-4 text-right text-amber-600 font-bold font-mono">{fNum(row.dailyDeduction)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600 font-mono">{fNum(row.dailyNet)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
