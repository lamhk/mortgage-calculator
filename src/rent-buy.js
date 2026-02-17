import { calcSdlt } from './sdlt.js';
import { repaymentPayment } from './mortgage.js';

export function monthlyMortgagePayment(principal, annualRatePct, years) {
  const r = (annualRatePct / 100) / 12;
  const n = Math.round(years * 12);
  if (n <= 0) return NaN;
  return repaymentPayment(principal, r, n);
}

export function clamp01(x){ return Math.max(0, Math.min(1, x)); }

/**
 * Rent vs buy comparison.
 *
 * Advanced mode includes:
 * - SDLT estimate
 * - legal fees
 * - selling costs
 * - rent inflation
 * - owner cost inflation (optional)
 * - price growth
 *
 * This is still a simplified model — designed to be transparent.
 */
export function rentVsBuy(params){
  const price = params.price;
  const deposit = price * clamp01(params.depositPct/100);
  const principal = Math.max(0, price - deposit);

  const mortgageMonthly = monthlyMortgagePayment(principal, params.mortgageRatePct, params.termYears);
  const ownerMonthly = mortgageMonthly + params.ownerMonthlyCosts;
  const rentMonthly0 = params.rentMonthly + params.rentExtraMonthly;

  const months = Math.round(params.horizonYears * 12);

  // basic totals (no inflation)
  const rentTotalBasic = rentMonthly0 * months;
  const buyTotalBasic = ownerMonthly * months;

  // advanced totals (simple compounding)
  const rentInfl = params.rentInflationPct/100;
  const ownerInfl = params.ownerCostInflationPct/100;

  let rentTotal = 0;
  let buyTotal = 0;
  for (let m=0; m<months; m++){
    const y = m/12;
    rentTotal += rentMonthly0 * Math.pow(1+rentInfl, y);
    buyTotal += ownerMonthly * Math.pow(1+ownerInfl, y);
  }

  // transaction costs
  const sdlt = params.includeSdlt ? calcSdlt(price, { buyerType:'main', additionalProperty:false, nonUkResident:false }) : { ok:true, total:0 };
  const sdltCost = sdlt.ok ? sdlt.total : 0;
  const buyUpfront = (params.legalFees ?? 0) + (params.surveyFees ?? 0) + sdltCost;

  // sale: selling costs (agent + legal)
  const salePrice = price * Math.pow(1 + (params.priceGrowthPct/100), params.horizonYears);
  const selling = salePrice * (params.sellingCostPct/100) + (params.saleLegalFees ?? 0);

  // equity: very rough principal repaid approximation by using schedule for horizon months.
  // For simplicity, treat remaining balance via amortization on repayment mortgage.
  const r = (params.mortgageRatePct/100)/12;
  const n = Math.round(params.termYears*12);
  let balance = principal;
  const pmt = mortgageMonthly;
  for (let i=0; i<Math.min(months,n); i++){
    const interest = balance * r;
    const principalPaid = Math.max(0, pmt - interest);
    balance = Math.max(0, balance - principalPaid);
  }
  const equity = Math.max(0, salePrice - balance - selling);

  // A cashflow view: total paid + upfront - equity (money you “get back” at sale)
  const buyNetCost = buyTotal + buyUpfront - equity;

  return {
    deposit,
    principal,
    mortgageMonthly,
    rentMonthly0,
    ownerMonthly,
    rentTotalBasic,
    buyTotalBasic,
    rentTotal,
    buyTotal,
    sdlt: sdltCost,
    buyUpfront,
    salePrice,
    selling,
    remainingBalance: balance,
    equity,
    buyNetCost,
  };
}
