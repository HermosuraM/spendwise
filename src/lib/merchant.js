// Card descriptions are noisy ("NETFLIX.COM 866-579-7172", "SQ *BLUE BOTTLE #42"). Normalizing them lets
// repeat purchases from the same merchant group together.
const PROCESSORS = /^(SQ ?\*|TST\* ?|SP ?\* ?|PAYPAL ?\*|PP ?\*)\s*/

export function normalizeMerchant(description) {
  return String(description ?? '')
    .toUpperCase()
    .replace(PROCESSORS, '')
    .replace(/\.(COM|NET|ORG)\b.*$/, '')
    .replace(/[#*]\S*/g, ' ')
    .replace(/\b\S*\d\S*\b/g, ' ')
    .replace(/[^A-Z& ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
