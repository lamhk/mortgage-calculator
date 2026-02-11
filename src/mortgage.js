// Core mortgage calculation logic (UI-agnostic)
// Supports repayment + interest-only, payment frequencies, and offset accounts.

/**
 * @typedef {"monthly"|"fortnightly"|"weekly"} Frequency
 * @typedef {"repayment"|"interestOnly"} PaymentType
 */

export function periodsPerYear(frequency) {
  switch (frequency) {
    case "monthly": return 12;
    case "fortnightly": return 26;
    case "weekly": return 52;
    default: throw new Error(`Unsupported frequency: ${frequency}`);
  }
}

export function toNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

export function clampMin0(x) {
  return x < 0 ? 0 : x;
}

export function effectivePrincipal(balance, offsetBalance) {
  return Math.max(0, balance - Math.max(0, offsetBalance));
}

export function repaymentPayment(principal, periodicRate, nPeriods) {
  if (nPeriods <= 0) return NaN;
  if (periodicRate === 0) return principal / nPeriods;
  const pow = Math.pow(1 + periodicRate, nPeriods);
  return principal * (periodicRate * pow) / (pow - 1);
}

/**
 * Build amortization schedule.
 * Assumptions:
 * - offsetBalance is constant over time.
 * - interest is calculated each period on max(0, balance - offsetBalance).
 * - repayment payment amount is fixed for the selected frequency.
 *
 * @param {{
 *  principal: number,
 *  annualRatePct: number,
 *  years: number,
 *  frequency: Frequency,
 *  type: PaymentType,
 *  offsetBalance?: number,
 * }} params
 * @returns {{
 *  payment: number,
 *  periodicRate: number,
 *  nPeriods: number,
 *  schedule: Array<{period:number, payment:number, interest:number, principalPaid:number, balance:number, effectivePrincipal:number}>
 * }}
 */
export function buildSchedule(params) {
  const principal = clampMin0(params.principal);
  const annualRatePct = clampMin0(params.annualRatePct);
  const years = clampMin0(params.years);
  const frequency = params.frequency;
  const type = params.type;
  const offsetBalance = clampMin0(params.offsetBalance ?? 0);

  const ppy = periodsPerYear(frequency);
  const nPeriods = Math.round(years * ppy);
  const periodicRate = (annualRatePct / 100) / ppy;

  let payment;
  if (type === "interestOnly") {
    payment = principal * periodicRate;
  } else {
    payment = repaymentPayment(principal, periodicRate, nPeriods);
  }

  const schedule = [];
  let balance = principal;

  for (let period = 1; period <= nPeriods; period++) {
    if (balance <= 0) break;

    const eff = effectivePrincipal(balance, offsetBalance);
    const interest = eff * periodicRate;

    let principalPaid = 0;
    if (type === "interestOnly") {
      principalPaid = 0;
    } else {
      principalPaid = Math.max(0, payment - interest);
      if (principalPaid > balance) principalPaid = balance;
    }

    const newBalance = Math.max(0, balance - principalPaid);

    schedule.push({
      period,
      payment,
      interest,
      principalPaid,
      balance: newBalance,
      effectivePrincipal: eff,
    });

    balance = newBalance;
  }

  return { payment, periodicRate, nPeriods, schedule };
}
