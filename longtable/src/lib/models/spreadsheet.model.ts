import { WritableSignal } from '@angular/core';

export interface DropdownOption {
  value: string;
  color: string; // Hex color string, e.g., '#bae6fd'
}

export type ColumnType = 'text' | 'dropdown' | 'checkbox' | 'numeric';

export type AnalysisType = 'categorical' | 'numeric' | 'token';

export interface Cell {
  value: string | number | boolean;
  readOnly?: boolean;
}

export interface Coordinates {
  row: number;
  col: number;
}

export interface ColumnConfig {
  name: string;
  field: string;
  readOnly?: boolean;
  width?: number | 'auto';
  description?: string;
  editor?: ColumnType;
  options?: (string | DropdownOption)[];
  lockSettings?: boolean;
}

export interface ContextMenuData {
  insertRowsAboveText: string;
  insertRowsBelowText: string;
  deleteRowText: string;
  deleteColText: string;
  isInsertColumnActionReadOnly: boolean;
  isDeleteColumnActionReadOnly: boolean;
  canDeleteRows: boolean;
  canDeleteCols: boolean;
}

export interface ColumnSettingsFormData {
  name: string;
  description: string;
  type: ColumnType;
  options: { value: string; color: string }[];
  widthValue: number | null;
}

export interface AnalysisOption {
  label: string;
  value: number;
  type: AnalysisType;
}

export interface SavedDistributionAnalysisState {
  analysisField: number | null;
  stackByField: number | null;
  view: 'chart' | 'table';
}

export interface SavedCorrelationAnalysisState {
  fieldX: number | null;
  fieldY: number | null;
  categoryField: number | null;
}

export interface DistributionGraphConfig {
  type: 'distribution';
  state: WritableSignal<SavedDistributionAnalysisState>;
}

export interface CorrelationGraphConfig {
  type: 'correlation';
  state: WritableSignal<SavedCorrelationAnalysisState>;
}

export type GraphConfig = DistributionGraphConfig | CorrelationGraphConfig;

export interface SpreadsheetTheme {
  name: string;
  colorScheme?: 'light' | 'dark';
  colors: {
    // Backgrounds
    bgPrimary: string;
    bgHeader: string;
    bgHeaderHover: string;
    bgSelection: string;
    inputBg: string;
    bgInvalid: string;

    // Text
    textPrimary: string;
    textHeader: string;
    textReadOnly: string;
    textSelection?: string;

    // Borders
    borderDefault: string;
    borderGrid: string;
    borderEditing: string;

    // UI Elements
    fillHandle: string;
    fillHandleBorder: string;
    dropIndicator: string;
    selectionShadow: string;

    // Icons & Popups
    iconDefault: string;
    iconHoverBg: string;
    iconHoverText: string;
    iconActive: string;
    popupBg: string;
    popupBorder: string;

    // Tooltips
    tooltipBg: string;
    tooltipText: string;

    // Buttons
    buttonPrimaryBg: string;
    buttonPrimaryBgHover: string;
    buttonPrimaryText: string;

    // Checkboxes
    checkboxBg: string;
    checkboxBorder: string;

    // Graphs
    graphPrimary: string;
    graphSecondary: string;
  };
  scrollbar?: {
    track: string;
    thumb: string;
    thumbHover: string;
    border: string;
    corner: string;
  };
  fontFamily?: {
    main: string;
    mono: string;
  };
  fontSizes?: {
    tableCell: string;
    header: string;
    modalLargeTitle: string;
    modalTitle: string;
    modalContent: string;
    contextMenu: string;
    input: string;
    chartAxisTitle: string;
    chartAxisLabel: string;
    chartLegend: string;
  };
}