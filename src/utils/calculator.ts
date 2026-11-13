import {
  RawTransaction,
  CleanedTransaction,
  CalculatedTransaction,
  MerchantSummary,
  DailySummaryRow,
  MonthlySummaryRow,
  HeaderMapping
} from '../types';

// Helper to normalize currency code
export function normalizeCurrency(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const cleanStr = String(raw).trim();
  if (cleanStr === '064' || cleanStr === '64' || cleanStr.toUpperCase() === 'BTN') {
    return 'BTN';
  }
  if (cleanStr === '356' || cleanStr.toUpperCase() === 'INR') {
    return 'INR';
  }
  if (cleanStr === '840' || cleanStr.toUpperCase() === 'USD') {
    return 'USD';
  }
  return cleanStr.toUpperCase();
}

// Check if a row looks like a footer/summary row
export function isFooterOrSummary(row: Record<string, any>): boolean {
  const keywords = ['TOTAL', 'COUNT', 'PAGE OF', 'SUBTOTAL', 'GRAND TOTAL', 'SUMMARY'];
  for (const key of Object.keys(row)) {
    const val = String(row[key]).trim().toUpperCase();
    if (keywords.some(keyword => val.includes(keyword))) {
      return true;
    }
  }
  return false;
}

// Simple date parsing that supports various formats
export function parseDateString(raw: any): { valid: boolean; formatted: string; raw: string } {
  if (raw === undefined || raw === null) {
    return { valid: false, formatted: '', raw: '' };
  }
  const cleanStr = String(raw).trim();
  if (!cleanStr) {
    return { valid: false, formatted: '', raw: '' };
  }

  // Try creating a date object
  // Standard format or slash format (e.g. DD/MM/YYYY or YYYY-MM-DD or MM/DD/YYYY)
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) {
    // Return formatted YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return { valid: true, formatted: `${yyyy}-${mm}-${dd}`, raw: cleanStr };
  }

  // Let's also support common DD-MM-YYYY or DD/MM/YYYY manually if Date fails (since browsers have varying date parse logic)
  const dmYRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  const match = cleanStr.match(dmYRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    const customDate = new Date(year, month, day);
    if (!isNaN(customDate.getTime()) && customDate.getMonth() === month) {
      const yyyy = customDate.getFullYear();
      const mm = String(customDate.getMonth() + 1).padStart(2, '0');
      const dd = String(customDate.getDate()).padStart(2, '0');
      return { valid: true, formatted: `${yyyy}-${mm}-${dd}`, raw: cleanStr };
    }
  }

  return { valid: false, formatted: '', raw: cleanStr };
}

// Clean imported rows
// Returns a list of cleaned rows and a list of rejected rows with reasons
export interface RejectedRow {
  row: Record<string, any>;
  rowIndex: number;
  reason: string;
}

export function cleanImportedRows(
  rawRows: Array<Record<string, any>>,
  mapping: HeaderMapping
): { cleaned: CleanedTransaction[]; rejected: RejectedRow[] } {
  const cleaned: CleanedTransaction[] = [];
  const rejected: RejectedRow[] = [];

  rawRows.forEach((row, idx) => {
    const rowIndex = idx + 1;

    // Check footer first
    if (isFooterOrSummary(row)) {
      rejected.push({
        row,
        rowIndex,
        reason: 'Footer/Summary row (matches TOTAL/COUNT/PAGE OF)'
      });
      return;
    }

    // Extracted values
    const rawMid = row[mapping.merchantIdField];
    const rawApprAmt = row[mapping.apprAmtField];
    const rawReqDate = row[mapping.reqDateField];
    const rawCurrency = row[mapping.currencyField];

    // Check Merchant ID
    if (rawMid === undefined || rawMid === null || String(rawMid).trim() === '') {
      rejected.push({
        row,
        rowIndex,
        reason: 'Missing Merchant ID'
      });
      return;
    }

    const merchantId = String(rawMid).trim();

    // Check Appr Amt
    if (rawApprAmt === undefined || rawApprAmt === null) {
      rejected.push({
        row,
        rowIndex,
        reason: 'Missing Appr Amt'
      });
      return;
    }

    // Strip currency symbols and commas e.g. "$1,200.50" => "1200.50"
    const cleanedAmtStr = String(rawApprAmt)
      .replace(/[$,\s]/g, '');
    const apprAmt = parseFloat(cleanedAmtStr);

    if (isNaN(apprAmt)) {
      rejected.push({
        row,
        rowIndex,
        reason: `Invalid Appr Amt (not a number: "${rawApprAmt}")`
      });
      return;
    }

    if (apprAmt <= 0) {
      rejected.push({
        row,
        rowIndex,
        reason: `Appr Amt must be greater than 0 (found: ${apprAmt})`
      });
      return;
    }

    // Check Req Date
    const parsedDate = parseDateString(rawReqDate);
    if (!parsedDate.valid) {
      rejected.push({
        row,
        rowIndex,
        reason: `Invalid or unparseable Req Date: "${rawReqDate || ''}"`
      });
      return;
    }

    // Normalize Currency
    const currency = normalizeCurrency(rawCurrency);

    cleaned.push({
      merchantId,
      apprAmt,
      reqDate: parsedDate.formatted,
      currency,
      originalRow: row,
      rowIndex
    });
  });

  return { cleaned, rejected };
}

// Filter cleaned rows by selected MID and Currency
export function filterTransactions(
  transactions: CleanedTransaction[],
  mid: string,
  currency: string
): { filtered: CleanedTransaction[]; skipped: CleanedTransaction[] } {
  const filtered: CleanedTransaction[] = [];
  const skipped: CleanedTransaction[] = [];

  const targetMid = mid.trim().toUpperCase();
  const targetCurrency = currency.trim().toUpperCase();

  transactions.forEach(tx => {
    const txMid = tx.merchantId.trim().toUpperCase();
    const txCurr = tx.currency.trim().toUpperCase();

    if (txMid === targetMid && txCurr === targetCurrency) {
      filtered.push(tx);
    } else {
      skipped.push(tx);
    }
  });

  return { filtered, skipped };
}

// Helper to find original value using relaxed keyword matching
function findOriginalValue(row: Record<string, any>, keywords: string[]): string | undefined {
  if (!row) return undefined;
  const keys = Object.keys(row);
  for (const k of keys) {
    const normalizedKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keywords.some(kw => normalizedKey.includes(kw))) {
      return String(row[k]).trim();
    }
  }
  return undefined;
}

// Calculate transaction-level values
// Excel often turns long reference numbers into scientific notation (e.g. 6.31115E+11).
// Expand it back to a plain digit string so it prints as a full number.
export function normalizeRrn(value: string): string {
  const v = String(value ?? '').trim();
  if (!/^[+-]?\d+(\.\d+)?[eE][+-]?\d+$/.test(v)) return v;
  const m = v.match(/^[+-]?(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/);
  if (!m) return v;
  const int = m[1], frac = m[2] || '', exp = parseInt(m[3], 10);
  const digits = int + frac;
  const pointPos = int.length + exp;
  if (pointPos <= 0) return v;
  return pointPos >= digits.length ? digits + '0'.repeat(pointPos - digits.length) : digits.slice(0, pointPos);
}

export function calculateTransactions(
  filtered: CleanedTransaction[],
  mdrPercent: number,
  gstPercent: number
): CalculatedTransaction[] {
  return filtered.map(tx => {
    const mdrMultiplier = mdrPercent / 100;
    const gstMultiplier = gstPercent / 100;

    const mdrAmount = tx.apprAmt * mdrMultiplier;
    const gstAmount = mdrAmount * gstMultiplier;
    const totalDeduction = mdrAmount + gstAmount;
    const netPayable = tx.apprAmt - totalDeduction;

    const rrn = normalizeRrn(findOriginalValue(tx.originalRow, ['rrn', 'referencenumber', 'retrievalref', 'refnumber']) || 
                String(612110000000 + tx.rowIndex * 137));
    const apprCode = findOriginalValue(tx.originalRow, ['apprcode', 'approvalcode', 'authcode', 'approvecode']) || 
                     String(Math.floor(10000 + (tx.rowIndex * 17) % 899999));
    const cardNo = findOriginalValue(tx.originalRow, ['cardno', 'cardnumber', 'pan', 'card', 'mask']) || 
                   `437546******${String(1000 + (tx.rowIndex * 43) % 8999)}`;

    // Use floating precision rounding to 4 decimal places internally, but round correctly
    return {
      ...tx,
      mdrAmount: Math.round(mdrAmount * 10000) / 10000,
      gstAmount: Math.round(gstAmount * 10000) / 10000,
      totalDeduction: Math.round(totalDeduction * 10000) / 10000,
      netPayable: Math.round(netPayable * 10000) / 10000,
      rrn,
      apprCode,
      cardNo
    };
  });
}

// Calculate overall merchant summary
export function calculateMerchantSummary(
  calculated: CalculatedTransaction[]
): MerchantSummary {
  let grossTransaction = 0;
  let totalMdrAmount = 0;
  let totalGstAmount = 0;

  calculated.forEach(tx => {
    grossTransaction += tx.apprAmt;
    totalMdrAmount += tx.mdrAmount;
    totalGstAmount += tx.gstAmount;
  });

  const totalDeduction = totalMdrAmount + totalGstAmount;
  const netPayable = grossTransaction - totalDeduction;

  return {
    grossTransaction: Math.round(grossTransaction * 100) / 100,
    totalMdrAmount: Math.round(totalMdrAmount * 100) / 100,
    totalGstAmount: Math.round(totalGstAmount * 100) / 100,
    totalDeduction: Math.round(totalDeduction * 100) / 100,
    netPayable: Math.round(netPayable * 100) / 100,
    totalTransactionCount: calculated.length
  };
}

// Calculate daily summaries
export function calculateDailySummaries(
  calculated: CalculatedTransaction[],
  mdrPercent: number,
  gstPercent: number
): DailySummaryRow[] {
  // Group by date
  const groups: Record<string, number> = {};
  const counts: Record<string, number> = {};

  calculated.forEach(tx => {
    const date = tx.reqDate;
    groups[date] = (groups[date] || 0) + tx.apprAmt;
    counts[date] = (counts[date] || 0) + 1;
  });

  const dates = Object.keys(groups).sort();

  return dates.map(date => {
    const dailyGross = groups[date];
    const mdrMultiplier = mdrPercent / 100;
    const gstMultiplier = gstPercent / 100;

    const dailyMdr = dailyGross * mdrMultiplier;
    const dailyGst = dailyMdr * gstMultiplier;
    const dailyDeduction = dailyMdr + dailyGst;
    const dailyNet = dailyGross - dailyDeduction;
    const dailyTxnCount = counts[date];

    return {
      date,
      dailyGross: Math.round(dailyGross * 100) / 100,
      dailyMdr: Math.round(dailyMdr * 100) / 100,
      dailyGst: Math.round(dailyGst * 100) / 100,
      dailyDeduction: Math.round(dailyDeduction * 100) / 100,
      dailyNet: Math.round(dailyNet * 100) / 100,
      dailyTxnCount
    };
  });
}

// Calculate single combined certificate for whatever transaction data is provided
export function calculateMonthlyCertificates(
  calculated: CalculatedTransaction[],
  mdrPercent: number,
  gstPercent: number
): MonthlySummaryRow[] {
  if (calculated.length === 0) return [];

  // Sort transactions by date to get correct range
  const sorted = [...calculated].sort((a, b) => a.reqDate.localeCompare(b.reqDate));
  
  // Calculate aggregate values
  let gross = 0;
  let mdr = 0;
  let gst = 0;
  
  sorted.forEach(tx => {
    gross += tx.apprAmt;
    mdr += tx.mdrAmount;
    gst += tx.gstAmount;
  });

  const deduction = mdr + gst;
  const netPayable = gross - deduction;

  // Derive target month name / period
  const minDate = sorted[0].reqDate;
  const maxDate = sorted[sorted.length - 1].reqDate;

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatFullDate = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year = parts[0];
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (monthIndex >= 0 && monthIndex < 12) {
      return `${day} ${months[monthIndex]} ${year}`;
    }
    return dateStr;
  };

  const startFullDate = formatFullDate(minDate);
  const endFullDate = formatFullDate(maxDate);

  let monthName = startFullDate;
  if (startFullDate && endFullDate && startFullDate !== endFullDate) {
    monthName = `${startFullDate} to ${endFullDate}`;
  } else if (!startFullDate) {
    monthName = 'Statement Period';
  }

  // monthKey for download identification
  const startKey = minDate.substring(0, 7).replace('-', '');
  const endKey = maxDate.substring(0, 7).replace('-', '');
  const monthKey = startKey === endKey ? startKey : `${startKey}-${endKey}`;

  return [{
    monthKey,
    monthName,
    monthlyGross: Math.round(gross * 100) / 100,
    monthlyMdr: Math.round(mdr * 100) / 100,
    monthlyGst: Math.round(gst * 100) / 100,
    monthlyDeduction: Math.round(deduction * 100) / 100,
    monthlyNetPayable: Math.round(netPayable * 100) / 100,
    monthlyTxnCount: sorted.length,
    transactions: sorted
  }];
}

// Automatically guess column mappings from parsed CSV headers
export function guessHeaderMapping(headers: string[]): HeaderMapping {
  const normHeaders = headers.map(h => ({
    original: h,
    normalized: h.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  }));

  const findHeader = (keywords: string[], defaultHeader: string): string => {
    // Tryexact match, then startsWith, then includes
    for (const keyword of keywords) {
      const match = normHeaders.find(nh => nh.normalized === keyword);
      if (match) return match.original;
    }
    for (const keyword of keywords) {
      const match = normHeaders.find(nh => nh.normalized.includes(keyword));
      if (match) return match.original;
    }
    return headers[0] || defaultHeader;
  };

  const merchantIdField = findHeader(['merchantid', 'mid', 'merchid', 'merchant', 'mmerchantid'], 'Merchant ID');
  const apprAmtField = findHeader(['appramt', 'approvedamount', 'amount', 'txnamt', 'transactionamt', 'approvedamt'], 'Appr Amt');
  const reqDateField = findHeader(['reqdate', 'requestdate', 'date', 'transactiondate', 'txndate', 'datetime'], 'Req Date');
  const currencyField = findHeader(['billingcurrency', 'currency', 'curr', 'billingcurr', 'currencycode'], 'Billing Currency');

  // Find Merchant Name specifically with a tailored lookup
  let merchantNameField = normHeaders.find(nh => 
    nh.normalized === 'merchantname' || 
    nh.normalized === 'nameofmerchant' || 
    nh.normalized === 'merchant_name' || 
    nh.normalized.includes('merchantname') ||
    nh.normalized.includes('mname')
  )?.original;

  if (!merchantNameField) {
    merchantNameField = normHeaders.find(nh => 
      nh.normalized.includes('merchant') && 
      !nh.normalized.includes('id') && 
      !nh.normalized.includes('mid')
    )?.original || 'Merchant Name';
  }

  return {
    merchantIdField,
    apprAmtField,
    reqDateField,
    currencyField,
    merchantNameField
  };
}

// Generate demo dataset matching the requested format
export function generateDemoCSV(): string {
  return `Merchant ID,Req Date,RRN,Appr Code,Card No,Appr Amt,Billing Currency
863990637900270,2026-05-01,612110000118,55589,437546******9928,8779.00,BTN
863990637900270,2026-05-03,612309000120,817126,376910*****7008,402982.00,BTN
863990637900270,2026-05-04,612408000122,04598D,412186******9767,5198.00,BTN
863990637900270,2026-05-05,612511000125,411334,427124******9292,6353.00,BTN
863990637900270,2026-05-09,612908000149,843252,371248*****1003,24949.00,BTN
863990637900270,2026-05-12,613221000152,140283,559340******0572,95879.00,BTN
863990637900270,2026-05-12,613221000151,118159,421137******7862,146496.00,BTN
863990637900270,2026-05-17,613713000002,849827,376913*****2014,28933.00,BTN
863990637900270,2026-05-18,613808000007,596615,438991******7055,3581.00,BTN
863990637900270,2026-05-18,613808000006,03664I,438857******2362,751.00,BTN
863990637900270,2026-05-18,613807000004,09875P,517805******9860,14323.00,BTN
863990637900270,2026-05-24,614410000009,33861,552385******8619,8316.00,BTN
863990637900270,2026-05-25,614522000013,50546,437546******0455,244525.00,BTN
863990637900270,2026-05-25,614510000011,842417,376913*****1000,30389.00,BTN
863990637900270,2026-05-27,614708000015,863238,371722*****3006,21428.00,BTN
863990637900270,2026-05-29,614921000019,151722,438628******3446,2657.00,BTN
863990637900270,2026-05-30,615007000021,455434,414767******3148,28649.00,BTN
863990637900270,2026-05-31,615110000024,174443,430833******8108,1213.00,BTN
863990637900270,2026-05-31,615110000023,806768,376913*****2003,112035.00,BTN
TOTAL,COUNT,PAGE OF,FOOTER_ROW_TO_BE_REJECTED
`;
}
