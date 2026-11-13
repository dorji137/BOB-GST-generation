import { MerchantSummary, CalculationSettings } from '../types';
import { PiggyBank, Scale, ArrowDownRight, DollarSign, Activity, FileText } from 'lucide-react';

interface StatsCardsProps {
  summary: MerchantSummary;
  settings: CalculationSettings;
}

export default function StatsCards({ summary, settings }: StatsCardsProps) {
  // Format numbers to 2 decimal places
  const fNum = (n: number) => {
    return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const currencySymbol = settings.selectedCurrency;

  const cardList = [
    {
      id: 'gross-volume',
      title: 'Gross Transaction Volume',
      value: `${currencySymbol} ${fNum(summary.grossTransaction)}`,
      icon: DollarSign,
      color: 'border-slate-200 bg-white text-slate-800',
      valueColor: 'text-slate-900 font-mono',
      description: `${summary.totalTransactionCount} Filtered Txns`,
    },
    {
      id: 'total-mdr',
      title: 'Total MDR Deducted',
      value: `${currencySymbol} ${fNum(summary.totalMdrAmount)}`,
      icon: PiggyBank,
      color: 'border-slate-200 bg-white text-slate-800',
      valueColor: 'text-[#0B7BAE] font-mono',
      description: `${settings.mdrPercent.toFixed(2)}% Channel Rate`,
    },
    {
      id: 'total-gst',
      title: 'Total GST Amount',
      value: `${currencySymbol} ${fNum(summary.totalGstAmount)}`,
      icon: Scale,
      color: 'border-slate-200 bg-white text-slate-800',
      valueColor: 'text-amber-600 font-mono',
      description: `${settings.gstPercent.toFixed(2)}% Tax on MDR`,
    },
    {
      id: 'net-payable',
      title: 'Net Payable to Merchant',
      value: `${currencySymbol} ${fNum(summary.netPayable)}`,
      icon: FileText,
      color: 'border-slate-900 bg-[#1CA7E0] text-white shadow-md border-b-4 border-amber-400',
      valueColor: 'text-amber-400 font-mono font-extrabold',
      description: `Total Deductions: ${currencySymbol} ${fNum(summary.totalDeduction)}`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="stats-cards-grid">
      {cardList.map((card) => {
        const IconComponent = card.icon;
        const isDark = card.id === 'net-payable';
        return (
          <div
            key={card.id}
            id={`stat-card-${card.id}`}
            className={`border rounded-xl p-5 transition-all hover:shadow-md ${card.color}`}
          >
            <div className="flex justify-between items-center mb-3">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-200' : 'text-slate-500'}`}>
                {card.title}
              </span>
              <div className={`p-1.5 rounded-lg ${isDark ? 'bg-white/10 text-amber-300' : 'bg-[#1CA7E0]/5 text-[#0B7BAE]'}`}>
                <IconComponent className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl md:text-2xl font-bold tracking-tight mb-1 ${card.valueColor}`}>
              {card.value}
            </div>
            <p className={`text-[10px] ${isDark ? 'text-slate-300' : 'text-slate-400'} font-semibold`}>
              {card.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
