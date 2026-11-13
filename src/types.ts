export interface RawTransaction {
  merchantId?: string;
  apprAmt?: string | number;
  reqDate?: string;
  currency?: string;
  originalRow: Record<string, any>;
  rowIndex: number;
}

export interface CleanedTransaction {
  merchantId: string;
  apprAmt: number;
  reqDate: string; // YYYY-MM-DD or standard parseable format
  currency: string; // BTN, INR, USD, etc.
  originalRow: Record<string, any>;
  rowIndex: number;
}

export interface CalculatedTransaction extends CleanedTransaction {
  mdrAmount: number;
  gstAmount: number;
  totalDeduction: number;
  netPayable: number;
  rrn?: string;
  apprCode?: string;
  cardNo?: string;
}

export type ChannelType = 'POS' | 'IPG';

export interface CalculationSettings {
  channel: ChannelType;
  mdrPercent: number; // e.g. 3.00 for 3%
  gstPercent: number; // e.g. 5.00 for 5%
  selectedMid: string;
  selectedCurrency: string;
  merchantName?: string;
  gstNumber?: string;
}

export interface MerchantSummary {
  grossTransaction: number;
  totalMdrAmount: number;
  totalGstAmount: number;
  totalDeduction: number;
  netPayable: number;
  totalTransactionCount: number;
}

export interface DailySummaryRow {
  date: string;
  dailyGross: number;
  dailyMdr: number;
  dailyGst: number;
  dailyDeduction: number;
  dailyNet: number;
  dailyTxnCount: number;
}

export interface MonthlySummaryRow {
  monthKey: string; // e.g. "2026-06"
  monthName: string; // e.g. "June 2026"
  monthlyGross: number;
  monthlyMdr: number;
  monthlyGst: number;
  monthlyDeduction: number;
  monthlyNetPayable: number;
  monthlyTxnCount: number;
  transactions: CalculatedTransaction[];
}

export interface HeaderMapping {
  merchantIdField: string;
  apprAmtField: string;
  reqDateField: string;
  currencyField: string;
  merchantNameField?: string;
}
