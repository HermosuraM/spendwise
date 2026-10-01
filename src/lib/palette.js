// Categorical slots in a fixed, colorblind-validated order (never cycled); a category keeps its slot
// everywhere. Dark mode uses its own steps chosen for the dark surface, not an automatic inversion.
export const SERIES = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
}

// Categories without a slot fold into one neutral "Other" mark.
export const OTHER = { light: '#8a8983', dark: '#6b6a65' }

export const CHROME = {
  light: { surface: '#fcfcfb', grid: '#e1e0d9', axis: '#c3c2b7', ink: '#0b0b0b', ink2: '#52514e', muted: '#706e69' },
  dark: { surface: '#1a1a19', grid: '#2c2c2a', axis: '#383835', ink: '#ffffff', ink2: '#c3c2b7', muted: '#96948d' },
}

export function slotColor(slot, mode = 'light') {
  return slot == null ? OTHER[mode] : SERIES[mode][slot % SERIES[mode].length]
}
