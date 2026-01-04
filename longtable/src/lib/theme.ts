import { SpreadsheetTheme } from './models/spreadsheet.model';

const fontFamily = {
  main: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'`,
  mono: `'SF Mono', SFMono-Regular, ui-monospace, 'DejaVu Sans Mono', 'Liberation Mono', Menlo, Monaco, Consolas, monospace`,
};

const fontSizes = {
  tableCell: '14px',
  header: '14px',
  modalLargeTitle: '20px',
  modalTitle: '18px',
  modalContent: '14px',
  contextMenu: '14px',
  input: '14px',
  chartAxisTitle: '12px',
  chartAxisLabel: '10px',
  chartLegend: '12px',
};

export const longLight: SpreadsheetTheme = {
  name: 'long-light',
  colorScheme: 'light',
  colors: {
    // Backgrounds
    bgPrimary: '#ffffff',
    bgHeader: '#f1f5f9',
    bgHeaderHover: '#e2e8f0',
    bgSelection: '#dbeafe', // blue-100
    inputBg: '#f7f8f9',
    bgInvalid: '#fee2e2', // red-100
    
    // Text
    textPrimary: '#0f172a',
    textHeader: '#475569',
    textReadOnly: '#64748b',
    textSelection: '#1e40af', // blue-800
    
    // Borders
    borderDefault: '#e2e8f0',
    borderGrid: '#e2e8f0',
    borderEditing: '#2563eb', // blue-600

    // UI Elements
    fillHandle: '#2563eb',
    fillHandleBorder: '#ffffff',
    dropIndicator: '#3b82f6',
    selectionShadow: '#2563eb',
    
    // Icons & Popups
    iconDefault: '#94a3b8',
    iconHoverBg: '#cbd5e1',
    iconHoverText: '#1e293b',
    iconActive: '#3b82f6', // blue-500
    popupBg: '#ffffff',
    popupBorder: '#e2e8f0',

    // Tooltips
    tooltipBg: '#1e293b', // slate-800
    tooltipText: '#ffffff',

    // Buttons
    buttonPrimaryBg: '#2563eb', // blue-600
    buttonPrimaryBgHover: '#1d4ed8', // blue-700
    buttonPrimaryText: '#ffffff',

    // Checkboxes
    checkboxBg: '#ffffff',
    checkboxBorder: '#cbd5e1', // slate-300
  },
  scrollbar: {
    track: '#f1f5f9',
    thumb: '#cbd5e1',
    thumbHover: '#94a3b8',
    border: '#f1f5f9',
    corner: '#f1f5f9',
  },
  fontFamily,
  fontSizes,
};

export const longDark: SpreadsheetTheme = {
  name: 'long-dark',
  colorScheme: 'dark',
  colors: {
    // Backgrounds
    bgPrimary: '#262c35',
    bgHeader: '#353d48',
    bgHeaderHover: '#434d5b',
    bgSelection: 'rgba(30, 64, 175, 0.5)', // blue-900 with opacity
    inputBg: '#181c21',
    bgInvalid: 'rgba(153, 27, 27, 0.4)', // red-900 with opacity

    // Text
    textPrimary: '#bbc1cb',
    textHeader: '#bbc1cb',
    textReadOnly: '#64748b',
    textSelection: '#dbeafe', // blue-100

    // Borders
    borderDefault: '#424d5d',
    borderGrid: '#424d5d',
    borderEditing: '#60a5fa', // blue-400

    // UI Elements
    fillHandle: '#60a5fa',
    fillHandleBorder: '#262c35',
    dropIndicator: '#60a5fa',
    selectionShadow: '#60a5fa',

    // Icons & Popups
    iconDefault: '#64748b',
    iconHoverBg: '#4b5563',
    iconHoverText: '#e5e7eb',
    iconActive: '#60a5fa',
    popupBg: '#262c35',
    popupBorder: '#424d5d',

    // Tooltips
    tooltipBg: '#434d5b',
    tooltipText: '#e5e7eb',

    // Buttons
    buttonPrimaryBg: '#3b82f6', // blue-500
    buttonPrimaryBgHover: '#2563eb', // blue-600
    buttonPrimaryText: '#ffffff',

    // Checkboxes
    checkboxBg: '#353d48',
    checkboxBorder: '#424d5d',
  },
  scrollbar: {
    track: '#353d48',
    thumb: '#4f5b6b',
    thumbHover: '#647080',
    border: '#353d48',
    corner: '#353d48',
  },
  fontFamily,
  fontSizes,
};

export const cosmicDark: SpreadsheetTheme = {
  ...longDark,
  name: 'cosmic-dark',
  colors: {
    ...longDark.colors,
    // Backgrounds with a single subtle purple "nebula" glow
    bgPrimary: 'radial-gradient(circle at 15% 25%, rgb(199 63 187 / 15%) 0%, rgba(34, 211, 238, 0) 25%), radial-gradient(circle at 85% 75%, rgba(167, 139, 250, 0.12) 0%, rgba(167, 139, 250, 0) 25%), linear-gradient(170deg, #201f28 0%, #282634 100%)',
    bgHeader: '#2c2a38',
    bgHeaderHover: '#383645',
    popupBg: 'radial-gradient(circle at 15% 75%, rgb(199 63 187 / 15%) 0%, rgba(34, 211, 238, 0) 25%), radial-gradient(circle at 80% 20%, rgba(167, 139, 250, 0.1) 0%, rgba(167, 139, 250, 0) 20%), linear-gradient(160deg, #2a2836 0%, #2e2c3b 100%)',
    
    // Selection colors using purple accent
    bgSelection: 'rgba(139, 92, 246, 0.4)', // violet-500/40
    textSelection: '#ede9fe', // violet-100

    // Interactive elements using purple accent
    borderEditing: '#a78bfa', // violet-400
    selectionShadow: '#a78bfa', // violet-400
    iconActive: '#a78bfa', // violet-400
    fillHandle: '#a78bfa', // violet-400
    dropIndicator: '#a78bfa', // violet-400

    // Buttons remain a deeper purple for contrast
    buttonPrimaryBg: '#7c3aed', // violet-600
    buttonPrimaryBgHover: '#6d28d9', // violet-700

    // Themed text colors
    textPrimary: '#c7c4d0',
    textHeader: '#c7c4d0',
    textReadOnly: '#5b5869',

    // Themed borders
    borderDefault: '#413e4f',
    borderGrid: '#413e4f',
    popupBorder: '#413e4f',

    // Themed icons
    iconDefault: '#7a768d',
    iconHoverBg: '#383645',
    iconHoverText: '#ede9fe',

    // Tooltips
    tooltipBg: '#383645',
    tooltipText: '#c7c4d0',

    // Themed checkboxes
    checkboxBorder: '#413e4f',
    checkboxBg: '#2c2a38',
  },
  fontFamily,
  scrollbar: {
    track: '#2c2a38',
    thumb: '#4f4b63',
    thumbHover: '#66617a',
    border: '#2c2a38',
    corner: '#2c2a38',
  },
};