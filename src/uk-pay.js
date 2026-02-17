// UK take-home pay (PAYE-employed) — simplified model
// Tax year: 6 April 2025 to 5 April 2026
// Sources:
// - Income tax bands: https://www.gov.uk/income-tax-rates (captured 2026-02-17)
// - NI thresholds/rates (Category A): https://www.gov.uk/national-insurance-rates-letters (captured 2026-02-17)
// - Student loan thresholds: https://www.gov.uk/repaying-your-student-loan/what-you-pay (captured 2026-02-17)

export const UKPAY_META = {
  capturedOn: '2026-02-17',
  taxYearLabel: '2025/26',
};

export function personalAllowance(adjustedNetIncome) {
  // Standard PA £12,570; reduced £1 for every £2 above £100,000.
  const PA = 12570;
  const taperStart = 100000;
  if (adjustedNetIncome <= taperStart) return PA;
  const reduction = (adjustedNetIncome - taperStart) / 2;
  return Math.max(0, PA - reduction);
}

export function incomeTaxAnnual(taxableIncome) {
  // England/Wales/NI — simplified: uses the GOV.UK bands (not Scotland).
  // Bands are expressed on taxable income after PA.
  const bands = [
    [37700, 0.20], // basic band width (12,571 to 50,270)
    [74870, 0.40], // higher band width (50,271 to 125,140)
    [Infinity, 0.45],
  ];

  let remaining = Math.max(0, taxableIncome);
  let tax = 0;
  let prev = 0;
  const breakdown = [];

  for (const [width, rate] of bands) {
    const slice = Math.max(0, Math.min(remaining, width));
    if (slice > 0) {
      const t = slice * rate;
      tax += t;
      breakdown.push({ slice, rate, tax: t, from: prev, to: prev + slice });
      remaining -= slice;
      prev += slice;
    }
    if (remaining <= 0) break;
  }

  return { tax, breakdown };
}

export function employeeNiAnnualCategoryA(grossAnnual) {
  // GOV.UK gives weekly thresholds for 2025/26 for category A:
  // - 0% up to £242/wk
  // - 8% from £242.01 to £967/wk
  // - 2% above £967/wk
  // We'll convert to annual by multiplying thresholds by 52.
  const PT = 242 * 52; // primary threshold
  const UEL = 967 * 52; // upper earnings limit

  const a = Math.max(0, grossAnnual);
  const band1 = Math.max(0, Math.min(a, UEL) - PT);
  const band2 = Math.max(0, a - UEL);

  const ni = band1 * 0.08 + band2 * 0.02;
  return { ni, thresholds: { PT, UEL } };
}

export const STUDENT_LOAN_PLANS = {
  none: { label: 'None', annualThreshold: Infinity, rate: 0 },
  plan1: { label: 'Plan 1', annualThreshold: 26065, rate: 0.09 },
  plan2: { label: 'Plan 2', annualThreshold: 28470, rate: 0.09 },
  plan4: { label: 'Plan 4', annualThreshold: 32745, rate: 0.09 },
  plan5: { label: 'Plan 5', annualThreshold: 25000, rate: 0.09 },
  pg: { label: 'Postgraduate Loan', annualThreshold: 21000, rate: 0.06 },
};

export function studentLoanAnnual(grossAnnual, planKey) {
  const plan = STUDENT_LOAN_PLANS[planKey] ?? STUDENT_LOAN_PLANS.none;
  const repay = Math.max(0, (grossAnnual - plan.annualThreshold) * plan.rate);
  return { repay, plan };
}

/**
 * Take-home pay (simplified).
 *
 * @param {{
 *  grossAnnual:number,
 *  pensionPct?:number,
 *  pensionMethod?:'salarySacrifice'|'none',
 *  studentLoanPlan?: keyof typeof STUDENT_LOAN_PLANS,
 * }} params
 */
export function takeHomePay(params) {
  const gross = Math.max(0, Number(params.grossAnnual));
  const pensionPct = Math.max(0, Math.min(100, Number(params.pensionPct ?? 0)));
  const method = params.pensionMethod ?? 'none';
  const studentLoanPlan = params.studentLoanPlan ?? 'none';

  const pensionAnnual = gross * (pensionPct / 100);
  const adjustedGross = method === 'salarySacrifice' ? Math.max(0, gross - pensionAnnual) : gross;

  const pa = personalAllowance(adjustedGross);
  const taxable = Math.max(0, adjustedGross - pa);
  const it = incomeTaxAnnual(taxable);
  const ni = employeeNiAnnualCategoryA(adjustedGross);
  const sl = studentLoanAnnual(adjustedGross, studentLoanPlan);

  const netAnnual = adjustedGross - it.tax - ni.ni - sl.repay;
  const netMonthly = netAnnual / 12;

  return {
    grossAnnual: gross,
    adjustedGrossAnnual: adjustedGross,
    pensionAnnual,
    personalAllowance: pa,
    taxableIncome: taxable,
    incomeTax: it.tax,
    ni: ni.ni,
    studentLoan: sl.repay,
    netAnnual,
    netMonthly,
    breakdown: { incomeTaxBands: it.breakdown, niThresholds: ni.thresholds, studentLoanPlan: sl.plan },
  };
}
