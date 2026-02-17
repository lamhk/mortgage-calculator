// UK Stamp Duty Land Tax (SDLT) — England / Northern Ireland (residential)
// Source: GOV.UK “Stamp Duty Land Tax — residential property rates”
// https://www.gov.uk/stamp-duty-land-tax/residential-property-rates
// Captured: 2026-02-17 (tax year 2025 to 2026 page)

/**
 * @typedef {{
 *   buyerType: 'main'|'ftb',
 *   additionalProperty: boolean,
 *   nonUkResident: boolean,
 * }} SdltOptions
 */

export const SDLT_META = {
  sourceUrl: "https://www.gov.uk/stamp-duty-land-tax/residential-property-rates",
  capturedOn: "2026-02-17",
  notes: [
    "Bands implemented for England / Northern Ireland residential purchases.",
    "Additional property surcharge implemented as +5% on top of standard rates (simplified).",
    "Non-UK resident surcharge implemented as +2% on top of applicable rates (simplified).",
    "First-time buyer relief implemented with the £300k / £500k structure (eligibility is simplified).",
  ],
};

// Standard rates if the property is the only residential property owned after purchase.
// Each band: [upToInclusive, rate]
export const BANDS_MAIN = [
  [125000, 0.00],
  [250000, 0.02],
  [925000, 0.05],
  [1500000, 0.10],
  [Infinity, 0.12],
];

// First-time buyer relief (simplified):
// - 0% up to £300,000
// - 5% on portion £300,001 to £500,000
// If price > £500,000: not eligible.
export const BANDS_FTB = [
  [300000, 0.00],
  [500000, 0.05],
  [Infinity, null], // not eligible over cap
];

export function calcBandedTax(price, bands, extraRate = 0) {
  let prevCap = 0;
  let tax = 0;
  /** @type {Array<{from:number,to:number|null,slice:number,rate:number,tax:number}>} */
  const lines = [];

  for (const [cap, rate] of bands) {
    if (rate == null) {
      return {
        ok: false,
        tax: NaN,
        lines: [],
        reason: "Not eligible for the selected relief at this price (simplified rule).",
      };
    }

    const slice = Math.max(0, Math.min(price, cap) - prevCap);
    if (slice > 0) {
      const effRate = rate + extraRate;
      const sliceTax = slice * effRate;
      tax += sliceTax;
      lines.push({ from: prevCap, to: cap === Infinity ? null : cap, slice, rate: effRate, tax: sliceTax });
    }

    prevCap = cap;
    if (price <= cap) break;
  }

  return { ok: true, tax, lines };
}

/**
 * Calculate SDLT.
 *
 * @param {number} price
 * @param {SdltOptions} options
 * @returns {{ ok:boolean, total:number, base:number, extraRate:number, lines:Array, reason?:string }}
 */
export function calcSdlt(price, options) {
  const buyerType = options?.buyerType ?? 'main';
  const additionalProperty = !!options?.additionalProperty;
  const nonUkResident = !!options?.nonUkResident;

  const extraRate = (additionalProperty ? 0.05 : 0) + (nonUkResident ? 0.02 : 0);

  // Prevent nonsense combos in UI, but keep calc defensive.
  const bands = buyerType === 'ftb' ? BANDS_FTB : BANDS_MAIN;

  const res = calcBandedTax(price, bands, extraRate);
  if (!res.ok) return { ok:false, total: NaN, base: NaN, extraRate, lines: [], reason: res.reason };

  // base is tax without surcharges for readability
  const baseRes = calcBandedTax(price, bands, 0);
  const base = baseRes.ok ? baseRes.tax : NaN;

  return { ok:true, total: res.tax, base, extraRate, lines: res.lines };
}
