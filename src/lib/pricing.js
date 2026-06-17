// src/lib/pricing.js
// Pure calculation functions — no UI, no side effects.
// Used by OrderForm, InvoiceTab, and PDF generator so numbers always agree.

/**
 * Convert lb to kg
 */
export function lbToKg(lb) {
  return parseFloat(lb) * 0.453592
}

/**
 * Convert kg to lb
 */
export function kgToLb(kg) {
  return parseFloat(kg) * 2.20462
}

/**
 * Calculate volumetric weight in kg from cm dimensions.
 * divisor: 5000 (air standard) or 6000 (some carriers)
 */
export function volumetricWeightKg(lengthCm, widthCm, heightCm, divisor = 5000) {
  const l = parseFloat(lengthCm) || 0
  const w = parseFloat(widthCm)  || 0
  const h = parseFloat(heightCm) || 0
  if (!l || !w || !h) return null
  return (l * w * h) / divisor
}

/**
 * Calculate volumetric weight in kg from inch dimensions.
 * Convert to cm first, then apply divisor.
 */
export function volumetricWeightKgFromIn(lengthIn, widthIn, heightIn, divisor = 5000) {
  const toCm = (v) => (parseFloat(v) || 0) * 2.54
  return volumetricWeightKg(toCm(lengthIn), toCm(widthIn), toCm(heightIn), divisor)
}

/**
 * Determine chargeable weight (kg):
 * = max(actual weight kg, volumetric weight kg)
 * Returns { actualKg, volumetricKg, chargeableKg, usedVolumetric }
 */
export function chargeableWeight({ weightKg, weightLb, weightUnit, lengthCm, widthCm, heightCm, lengthIn, widthIn, heightIn, divisor }) {
  // Actual weight in kg
  let actualKg = 0
  if (weightUnit === 'kg') {
    actualKg = parseFloat(weightKg) || 0
  } else {
    actualKg = weightLb ? lbToKg(weightLb) : 0
  }

  // Volumetric weight in kg
  let volumetricKg = null
  if (weightUnit === 'kg') {
    volumetricKg = volumetricWeightKg(lengthCm, widthCm, heightCm, divisor)
  } else {
    volumetricKg = volumetricWeightKgFromIn(lengthIn, widthIn, heightIn, divisor)
  }

  const chargeableKg  = volumetricKg !== null ? Math.max(actualKg, volumetricKg) : actualKg
  const usedVolumetric = volumetricKg !== null && volumetricKg > actualKg

  return {
    actualKg:      +actualKg.toFixed(3),
    volumetricKg:  volumetricKg !== null ? +volumetricKg.toFixed(3) : null,
    chargeableKg:  +chargeableKg.toFixed(3),
    usedVolumetric,
  }
}

/**
 * Calculate shipping-only price.
 * rate: flat rate per kg (in selected currency)
 * currency: 'USD' or 'IDR'
 * additionalCosts: [{ description, amount }]
 * Returns { weightBreakdown, basePrice, additionalTotal, total, currency }
 */
export function calcShippingOnly({ rate, currency, additionalCosts = [], ...weightParams }) {
  const wb        = chargeableWeight(weightParams)
  const basePrice = +(wb.chargeableKg * (parseFloat(rate) || 0)).toFixed(2)
  const addTotal  = additionalCosts.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
  const total     = +(basePrice + addTotal).toFixed(2)

  return {
    weightBreakdown: wb,
    basePrice,
    additionalTotal: +addTotal.toFixed(2),
    total,
    currency: currency || 'USD',
  }
}

/**
 * Format currency display
 */
export function formatCurrency(amount, currency) {
  if (currency === 'IDR') {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount)
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}
