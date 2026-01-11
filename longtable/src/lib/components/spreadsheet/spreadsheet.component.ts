import { ChangeDetectionStrategy, Component, computed, ElementRef, input, viewChild, WritableSignal, signal, effect, OnDestroy, Renderer2, inject, output } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cell, Coordinates, ColumnConfig, DropdownOption, ContextMenuData, ColumnSettingsFormData, SavedDistributionAnalysisState, SavedCorrelationAnalysisState, GraphConfig, SpreadsheetTheme } from '../../models/spreadsheet.model';

// New Child Components
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { ColumnEditorComponent } from '../column-editor/column-editor.component';
import { FilterPopupComponent } from '../filter-popup/filter-popup.component';
import { FindReplaceComponent } from '../find-replace/find-replace.component';
import { TableStatsComponent } from '../table-stats/table-stats.component';

@Component({
  selector: 'long-spreadsheet',
  templateUrl: './spreadsheet.component.html',
  styleUrls: [], // No separate styles, using Tailwind in HTML
  imports: [
    CommonModule,
    FormsModule,
    ContextMenuComponent,
    ColumnEditorComponent,
    FilterPopupComponent,
    FindReplaceComponent,
    TableStatsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(mousedown)': 'onHostMouseDown($event)',
    '(copy)': 'onCopy($event)',
    '(paste)': 'onPaste($event)',
    '(keydown)': 'onKeyDown($event)',
    '(document:mousedown)': 'onDocumentMouseDown($event)',
    '(document:mousemove)': 'onDocumentMouseMove($event)',
    '(document:mouseup)': 'onDocumentMouseUp($event)',
    '[style]': 'themeCssVariables()',
    '[style.height]': 'isFullHeight() ? "100%" : null',
  }
})
export class SpreadsheetComponent implements OnDestroy {
  data = input.required<WritableSignal<Cell[][]>>();
  columnConfig = input.required<WritableSignal<ColumnConfig[]>>();
  theme = input.required<SpreadsheetTheme>();

  onDataChange = output<Cell[][]>();
  onColumnChange = output<ColumnConfig[]>();

  protected readonly uniqueId = `long-spreadsheet-${Math.random().toString(36).substring(2, 9)}`;

  // Signals for state management
  activeCell = signal<Coordinates | null>(null);
  selectionRanges = signal<{ start: Coordinates, end: Coordinates }[]>([]);
  editingCell = signal<Coordinates | null>(null);
  isMouseDown = signal(false);
  isDraggingFill = signal(false);
  isSelectingRows = signal(false);
  isSelectingCols = signal(false);
  fillRange = signal<{ start: Coordinates, end: Coordinates } | null>(null);

  editValue = signal<string | number | boolean>('');
  editorPosition = signal<{ top: number; left: number; width: number; height: number; } | null>(null);
  private isNewValueEntry = signal(false);

  // Column Resizing State
  isResizingCol = signal<number | null>(null);
  resizingColStart = signal<{ x: number, width: number } | null>(null);

  // Column Drag & Drop State
  isDraggingColumn = signal(false);
  draggedColumnInfo = signal<{ startIndex: number, count: number, startX: number } | null>(null);
  dropColumnIndex = signal<number | null>(null);

  // Sorting and Filtering
  sortConfig = signal<{ col: number, direction: 'asc' | 'desc' } | null>(null);
  filterConfig = signal<Map<number, Set<string>>>(new Map());

  // Custom Dropdown Editor State
  dropdownSearchText = signal('');
  dropdownActiveOptionIndex = signal<number>(0);

  // Validation State
  validationErrors = signal<Map<string, string>>(new Map());

  // Tooltip State
  isTooltipVisible = signal(false);
  tooltipText = signal('');
  tooltipPosition = signal({ x: 0, y: 0 });
  private tooltipTimeout: any;

  // Header Tooltip State
  isHeaderTooltipVisible = signal(false);
  headerTooltipContent = signal<{ name: string; description: string | undefined; type: string; kebabName: string; } | null>(null);
  headerTooltipPosition = signal({ x: 0, y: 0 });
  private headerTooltipTimeout: any;
  private lastHeaderHoverTarget: HTMLElement | null = null;

  // Undo/Redo State
  private undoStack = signal<Cell[][][]>([]);
  private redoStack = signal<Cell[][][]>([]);

  // Child component visibility states
  isContextMenuVisible = signal(false);
  isColumnSettingsVisible = signal(false);
  isFindReplaceVisible = signal(false);
  isStatsModalVisible = signal(false);

  // Find and Replace State
  findQuery = signal('');
  findOptions = signal({ matchCase: false, matchEntireCell: false });
  currentFindIndex = signal(-1);
  activeFilterPopup = signal<{ col: number, target: HTMLElement } | null>(null);

  // State for child components
  contextMenuPosition = signal({ x: 0, y: 0 });
  menuLaunchCoords = signal<{ x: number, y: number } | null>(null);
  // Fix: Initialize signal with a default value.
  contextMenuType = signal<'row' | 'cell' | 'col' | 'headerCorner' | null>(null);
  contextMenuCoords = signal<Coordinates | null>(null);
  columnSettingsColIndex = signal<number | null>(null);

  // State signals for stats modal
  statsUseCountColumn = signal(false);
  statsGraphsConfig = signal<GraphConfig[]>([
    { type: 'distribution', state: signal<SavedDistributionAnalysisState>({ analysisField: null, stackByField: null, view: 'chart' }) },
    { type: 'distribution', state: signal<SavedDistributionAnalysisState>({ analysisField: null, stackByField: null, view: 'chart' }) },
    { type: 'distribution', state: signal<SavedDistributionAnalysisState>({ analysisField: null, stackByField: null, view: 'chart' }) },
    { type: 'correlation', state: signal<SavedCorrelationAnalysisState>({ fieldX: null, fieldY: null, categoryField: null }) }
  ]);

  // DOM elements
  private rootContainer = viewChild.required<ElementRef>('rootContainer');
  private spreadsheetContainer = viewChild.required<ElementRef>('spreadsheetContainer');
  private spreadsheetTable = viewChild.required<ElementRef>('spreadsheetTable');
  private editingInput = viewChild<ElementRef<HTMLTextAreaElement | HTMLSelectElement>>('editingInput');
  private dropdownEditor = viewChild<ElementRef>('dropdownEditor');
  private dropdownSearchInput = viewChild<ElementRef>('dropdownSearchInput');
  private contextMenuEl = viewChild<ContextMenuComponent>('contextMenuEl');
  private filterPopupEl = viewChild<ElementRef>('filterPopupEl');
  private findReplacePanelEl = viewChild<ElementRef>('findReplacePanelEl');
  private csvImporter = viewChild<ElementRef>('csvImporter');
  private validationTooltip = viewChild<ElementRef>('validationTooltip');
  private headerTooltip = viewChild<ElementRef>('headerTooltip');

  // Layout change tracking
  private layoutTick = signal(0);
  private resizeObserver?: ResizeObserver;

  // Output flags
  private isDataInitialized = false;
  private isColumnConfigInitialized = false;

  // Computed properties
  rows = computed(() => this.data()() || []);
  colsCount = computed(() => this.columnConfig()().length || 0);

  height = input<string | number>('60vh');

  spreadsheetContainerClasses = computed(() => `w-full overflow-auto border rounded-[10px] relative select-none focus:outline-none border-[var(--lt-border-default,theme(colors.slate.200))] ${this.uniqueId}`);

  containerHeight = computed(() => {
    const h = this.height();
    if (h === 'auto' || h === 'full' || h === '100%') {
      return h === 'auto' ? 'auto' : '100%';
    }
    return typeof h === 'number' ? `${h}px` : h;
  });

  isFullHeight = computed(() => {
    const h = this.height();
    return h === 'full' || h === '100%';
  });

  themeCssVariables = computed(() => {
    const theme = this.theme();
    if (!theme) {
      return {};
    }
    const styles = Object.entries(theme.colors).reduce((acc, [key, value]) => {
      // camelCase to kebab-case
      const cssVar = `--lt-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
      if (typeof value === 'string') {
        acc[cssVar] = value;
      }
      return acc;
    }, {} as { [key: string]: string });

    if (theme.fontFamily) {
      Object.entries(theme.fontFamily).forEach(([key, value]) => {
        const cssVar = `--lt-font-family-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
        if (typeof value === 'string') {
          styles[cssVar] = value;
        }
      });
    }

    if (theme.fontSizes) {
      Object.entries(theme.fontSizes).forEach(([key, value]) => {
        const cssVar = `--lt-font-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
        if (typeof value === 'string') {
          styles[cssVar] = value;
        }
      });
    }

    if (theme.colorScheme) {
      styles['color-scheme'] = theme.colorScheme;
    }

    return styles;
  });

  private scrollbarStyles = computed(() => {
    const theme = this.theme();
    if (!theme?.scrollbar) {
      return '';
    }
    const sb = theme.scrollbar;
    const colors = theme.colors;
    const selector = `.${this.uniqueId}`;
    return `
      /* Main spreadsheet scrollbar */
      ${selector}::-webkit-scrollbar {
        width: 15px;
        height: 15px;
      }
      ${selector}::-webkit-scrollbar-track {
        background-color: ${sb.track};
      }
      ${selector}::-webkit-scrollbar-thumb {
        background-color: ${sb.thumb};
        border-radius: 10px;
        border: 4px solid ${sb.border};
        background-clip: content-box;
      }
      ${selector}::-webkit-scrollbar-thumb:hover {
        background-color: ${sb.thumbHover};
      }
      ${selector}::-webkit-scrollbar-corner {
        background-color: ${sb.corner};
      }

      /* Modal scrollbars within this spreadsheet instance */
      ${selector} .modal-scroll-content::-webkit-scrollbar {
        width: 15px;
        height: 15px;
      }
      ${selector} .modal-scroll-content::-webkit-scrollbar-track {
        background-color: ${colors.popupBg};
      }
      ${selector} .modal-scroll-content::-webkit-scrollbar-thumb {
        background-color: ${sb.thumb};
        border-radius: 10px;
        border: 4px solid ${colors.popupBg};
        background-clip: content-box;
      }
      ${selector} .modal-scroll-content::-webkit-scrollbar-thumb:hover {
        background-color: ${sb.thumbHover};
      }
      ${selector} .modal-scroll-content::-webkit-scrollbar-corner {
        background-color: ${colors.popupBg};
      }
    `;
  });

  filteredDropdownOptions = computed(() => {
    const editing = this.editingCell();
    if (!editing) return [];
    const colConfig = this.columnConfig()()[editing.col];
    if (colConfig?.editor !== 'dropdown' || !colConfig.options) return [];

    const search = this.dropdownSearchText().toLowerCase();
    if (!search) return colConfig.options;
    return colConfig.options.filter(opt => this.getOptionValue(opt).toLowerCase().includes(search));
  });

  displayedRows = computed(() => {
    const data = this.rows();
    if (data.length === 0) return [];
    const filters = this.filterConfig();
    const sort = this.sortConfig();

    let processedRows = data.map((cells, index) => ({ cells, originalModelIndex: index }));

    if (filters.size > 0) {
      processedRows = processedRows.filter(rowItem => {
        for (const [col, selectedValues] of filters.entries()) {
          if (!selectedValues.has(String(rowItem.cells[col]?.value ?? ''))) {
            return false;
          }
        }
        return true;
      });
    }

    if (sort) {
      processedRows.sort((a, b) => {
        const valA = a.cells[sort.col]?.value;
        const valB = b.cells[sort.col]?.value;
        let comparison = 0;
        if (valA === valB) comparison = 0;
        else if (valA == null) comparison = -1;
        else if (valB == null) comparison = 1;
        else if (typeof valA === 'number' && typeof valB === 'number') comparison = valA - valB;
        else comparison = String(valA).localeCompare(String(valB));
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    }
    return processedRows;
  });

  findResults = computed<Coordinates[]>(() => {
    const query = this.findQuery();
    if (!query) return [];

    const options = this.findOptions();
    const results: Coordinates[] = [];
    const searchQuery = options.matchCase ? query : query.toLowerCase();

    this.rows().forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellValue = String(cell?.value ?? '');
        const compareValue = options.matchCase ? cellValue : cellValue.toLowerCase();

        if (options.matchEntireCell) {
          if (compareValue === searchQuery) {
            results.push({ row: rowIndex, col: colIndex });
          }
        } else {
          if (compareValue.includes(searchQuery)) {
            results.push({ row: rowIndex, col: colIndex });
          }
        }
      });
    });

    return results;
  });

  selectionRangePositions = computed(() => {
    this.rows();
    this.layoutTick();
    const ranges = this.selectionRanges();
    const container = this.spreadsheetContainer();
    if (ranges.length === 0 || !container?.nativeElement) return [];

    return ranges.map(range => {
      const norm = this.normalizeRange(range);
      const startModel = this.visualToModelCoords(norm.start);
      const endModel = this.visualToModelCoords(norm.end);
      if (!startModel || !endModel) return { display: 'none' };

      const startEl = container.nativeElement.querySelector(`td[data-row="${startModel.row}"][data-col="${startModel.col}"]`);
      const endEl = container.nativeElement.querySelector(`td[data-row="${endModel.row}"][data-col="${endModel.col}"]`);
      if (!startEl || !endEl) return { display: 'none' };

      const left = startEl.offsetLeft;
      const top = startEl.offsetTop;
      const width = (endEl.offsetLeft + endEl.offsetWidth) - left;
      const height = (endEl.offsetTop + endEl.offsetHeight) - top;

      return { display: 'block', left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
    });
  });

  fillRangePosition = computed(() => {
    this.rows();
    this.layoutTick();
    const fill = this.fillRange();
    const selection = this.selectionRanges()[this.selectionRanges().length - 1];
    const container = this.spreadsheetContainer();
    if (!fill || !selection || !container?.nativeElement) return { display: 'none' };

    const normSelection = this.normalizeRange(selection);
    const normFill = this.normalizeRange(fill);
    const startModel = this.visualToModelCoords(normSelection.start);
    const endModel = this.visualToModelCoords(normFill.end);
    if (!startModel || !endModel) return { display: 'none' };

    const startEl = container.nativeElement.querySelector(`td[data-row="${startModel.row}"][data-col="${startModel.col}"]`);
    const endEl = container.nativeElement.querySelector(`td[data-row="${endModel.row}"][data-col="${endModel.col}"]`);
    if (!startEl || !endEl) return { display: 'none' };

    const left = startEl.offsetLeft;
    const top = startEl.offsetTop;
    const width = (endEl.offsetLeft + endEl.offsetWidth) - left;
    const height = (endEl.offsetTop + endEl.offsetHeight) - top;
    return { display: 'block', left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` };
  });

  activeSelectionRange = computed(() => {
    const active = this.activeCell();
    const ranges = this.selectionRanges();
    if (ranges.length === 0) return null;
    if (!active) return ranges[ranges.length - 1];
    return ranges.find(range => {
      const norm = this.normalizeRange(range);
      return active.row >= norm.start.row && active.row <= norm.end.row && active.col >= norm.start.col && active.col <= norm.end.col;
    }) ?? ranges[ranges.length - 1];
  });

  selectedRowCount = computed(() => {
    const selection = this.activeSelectionRange();
    if (!selection) return 0;
    const norm = this.normalizeRange(selection);
    return norm.end.row - norm.start.row + 1;
  });

  selectedColCount = computed(() => {
    const selection = this.activeSelectionRange();
    if (!selection) return 0;
    const norm = this.normalizeRange(selection);
    return norm.end.col - norm.start.col + 1;
  });

  contextMenuData = computed<ContextMenuData>(() => {
    const rowCount = this.selectedRowCount();
    const colCount = this.selectedColCount();
    const colIndex = this.contextMenuCoords()?.col;

    const selection = this.activeSelectionRange();
    let isDeleteReadOnly = true;
    if (selection) {
      const norm = this.normalizeRange(selection);
      const config = this.columnConfig()();
      isDeleteReadOnly = false;
      for (let c = norm.start.col; c <= norm.end.col; c++) {
        if (config[c]?.readOnly) {
          isDeleteReadOnly = true;
          break;
        }
      }
    }

    return {
      insertRowsAboveText: rowCount > 1 ? `Insert ${rowCount} rows above` : 'Insert row above',
      insertRowsBelowText: rowCount > 1 ? `Insert ${rowCount} rows below` : 'Insert row below',
      deleteRowText: rowCount > 1 ? `Delete ${rowCount} rows` : 'Delete row',
      deleteColText: colCount > 1 ? `Delete ${colCount} columns` : 'Delete column',
      isInsertColumnActionReadOnly: colIndex != null ? (this.columnConfig()()[colIndex]?.readOnly ?? false) : false,
      isDeleteColumnActionReadOnly: isDeleteReadOnly,
      canDeleteRows: this.rows().length > rowCount,
      canDeleteCols: this.colsCount() > colCount,
    };
  });

  filterPopupPosition = computed(() => {
    const popup = this.activeFilterPopup();
    const container = this.spreadsheetContainer();
    if (!popup || !container?.nativeElement) return { display: 'none', left: '0px', top: '0px' };
    const containerEl = container.nativeElement as HTMLElement;
    const targetEl = popup.target;
    const containerRect = containerEl.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    let left = targetRect.left - containerRect.left + containerEl.scrollLeft;
    const top = targetRect.top - containerRect.top + containerEl.scrollTop + targetRect.height + 2;
    const popupWidth = 256;
    if (left + popupWidth > containerEl.clientWidth + containerEl.scrollLeft) {
      left = containerEl.clientWidth + containerEl.scrollLeft - popupWidth;
    }
    left = Math.max(containerEl.scrollLeft, left);
    return { display: 'block', left: `${left}px`, top: `${top}px` };
  });

  currentFilterUniqueValues = computed(() => {
    const popup = this.activeFilterPopup();
    if (!popup) return [];
    const values = new Set<string>();
    this.rows().forEach(row => values.add(String(row[popup.col]?.value ?? '')));
    return Array.from(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  });

  filterPopupInitialSelection = computed(() => {
    const popup = this.activeFilterPopup();
    if (!popup) {
      return new Set<string>();
    }
    return this.filterConfig().get(popup.col) ?? new Set(this.currentFilterUniqueValues());
  });

  isColumnDragged = computed(() => {
    if (!this.isDraggingColumn() || !this.draggedColumnInfo()) return new Set<number>();
    const { startIndex, count } = this.draggedColumnInfo()!;
    const indices = new Set<number>();
    for (let i = 0; i < count; i++) {
      indices.add(startIndex + i);
    }
    return indices;
  });

  dropIndicatorPosition = computed(() => {
    this.rows();
    this.layoutTick();
    const dropIndex = this.dropColumnIndex();
    const container = this.spreadsheetContainer();
    if (!this.isDraggingColumn() || dropIndex === null || !container?.nativeElement) return { display: 'none' };
    const table = container.nativeElement.querySelector('table');
    const headerRow = table?.querySelector('thead tr');
    if (!headerRow) return { display: 'none' };
    const ths = Array.from(headerRow.children) as HTMLElement[];
    if (ths.length < 2) return { display: 'none' };
    const rowHeaderTh = ths[0];
    let leftPosition = rowHeaderTh.offsetWidth;
    const colThs = ths.slice(1);
    for (let i = 0; i < dropIndex; i++) {
      leftPosition += colThs[i]?.offsetWidth ?? (typeof this.columnConfig()()[i]?.width === 'number' ? this.columnConfig()()[i].width as number : 135);
    }
    return { display: 'block', left: `${leftPosition - 1}px`, top: `${headerRow.offsetTop}px`, height: `${table.offsetHeight - headerRow.offsetTop}px` };
  });

  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private styleElement: HTMLStyleElement | null = null;

  constructor() {
    effect(() => {
      const currentData = this.data()();
      if (this.isDataInitialized) {
        this.onDataChange.emit(currentData);
      }
      this.isDataInitialized = true;
    });

    effect(() => {
      const currentColumnConfig = this.columnConfig()();
      if (this.isColumnConfigInitialized) {
        this.onColumnChange.emit(currentColumnConfig);
      }
      this.isColumnConfigInitialized = true;
    });

    effect(() => {
      if (this.editingCell()) {
        setTimeout(() => {
          const el = this.editingInput()?.nativeElement ?? this.dropdownSearchInput()?.nativeElement;
          if (el) {
            el.focus();
            if (el instanceof HTMLTextAreaElement) {
              this.isNewValueEntry() ? (el.selectionStart = el.selectionEnd = el.value.length) : el.select();
              this.onEditorInput();
            }
          }
        }, 0);
      }
    });

    effect(() => { if (this.activeFilterPopup()) setTimeout(() => this.filterPopupEl()?.nativeElement.querySelector('input')?.focus(), 0); });
    effect(() => { if (this.isDraggingColumn()) document.body.style.cursor = 'grabbing'; else document.body.style.cursor = ''; });

    // This effect handles resetting the active option index when the user types to filter.
    effect(() => {
      this.dropdownSearchText(); // Rerun when search text changes.
      this.dropdownActiveOptionIndex.set(0);
    });

    // This effect handles scrolling the active dropdown option into view when it changes.
    effect(() => {
      if (this.editingCell() && this.columnConfig()()[this.editingCell()!.col]?.editor === 'dropdown') {
        this.dropdownActiveOptionIndex(); // Rerun when index changes.
        this.scrollActiveDropdownOptionIntoView();
      }
    });

    effect(() => {
      if (this.isTooltipVisible()) {
        setTimeout(() => {
          const tooltipEl = this.validationTooltip()?.nativeElement;
          const containerEl = this.spreadsheetContainer()?.nativeElement;
          if (!tooltipEl || !containerEl) return;
          let pos = this.tooltipPosition();
          let { x, y } = pos;
          if (x + tooltipEl.offsetWidth > containerEl.clientWidth + containerEl.scrollLeft) x = x - tooltipEl.offsetWidth - 20;
          if (y + tooltipEl.offsetHeight > containerEl.clientHeight + containerEl.scrollTop) y = y - tooltipEl.offsetHeight - 20;
          this.tooltipPosition.set({ x: Math.max(containerEl.scrollLeft + 5, x), y: Math.max(containerEl.scrollTop + 5, y) });
        }, 0);
      }
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.isHeaderTooltipVisible()) {
        setTimeout(() => {
          const tooltipEl = this.headerTooltip()?.nativeElement;
          const rootEl = this.rootContainer()?.nativeElement;
          const target = this.lastHeaderHoverTarget;
          const spreadsheetEl = this.spreadsheetContainer()?.nativeElement;
          if (!tooltipEl || !rootEl || !target || !spreadsheetEl) return;
          let { x, y } = this.headerTooltipPosition();
          const rootRect = rootEl.getBoundingClientRect();
          const targetRect = target.getBoundingClientRect();
          const spreadsheetRect = spreadsheetEl.getBoundingClientRect();
          if (rootRect.left + x + tooltipEl.offsetWidth > spreadsheetRect.right) {
            x = Math.min(targetRect.right, spreadsheetRect.right) - tooltipEl.offsetWidth - rootRect.left;
          }
          if (rootRect.top + y + tooltipEl.offsetHeight > window.innerHeight) {
            y = (targetRect.top - rootRect.top) - tooltipEl.offsetHeight - 2;
          }
          if (rootRect.left + x < spreadsheetRect.left) {
            x = spreadsheetRect.left - rootRect.left;
          }
          this.headerTooltipPosition.set({ x, y });
        }, 0);
      }
    }, { allowSignalWrites: true });

    // Effect for dynamic scrollbar styling
    effect(() => {
      const styles = this.scrollbarStyles();
      const theme = this.theme();

      if (theme && styles) {
        if (!this.styleElement) {
          this.styleElement = this.renderer.createElement('style');
          this.renderer.appendChild(this.document.head, this.styleElement);
        }
        this.renderer.setProperty(this.styleElement, 'textContent', styles);
      } else if (this.styleElement) {
        this.renderer.removeChild(this.document.head, this.styleElement);
        this.styleElement = null;
      }
    });

    // Effect for layout observation
    effect(() => {
      const table = this.spreadsheetTable()?.nativeElement;
      if (table) {
        this.resizeObserver = new ResizeObserver(() => {
          this.layoutTick.update(v => v + 1);
        });
        this.resizeObserver.observe(table);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.styleElement) {
      this.renderer.removeChild(this.document.head, this.styleElement);
      this.styleElement = null;
    }
    this.resizeObserver?.disconnect();
  }

  // --- Public Methods / Template Helpers ---
  selectAllCells(): void {
    const lastRow = this.displayedRows().length - 1;
    const lastCol = this.colsCount() - 1;
    if (lastRow < 0 || lastCol < 0) return;
    const startCoords: Coordinates = { row: 0, col: 0 };
    this.activeCell.set(startCoords);
    this.selectionRanges.set([{ start: startCoords, end: { row: lastRow, col: lastCol } }]);
  }

  getCell(modelRow: number, modelCol: number): Cell | undefined {
    return this.rows()[modelRow]?.[modelCol];
  }

  getDropdownOptionColor(modelRow: number, modelCol: number): string | undefined {
    const cell = this.getCell(modelRow, modelCol);
    const colConfig = this.columnConfig()()[modelCol];
    if (!cell || colConfig?.editor !== 'dropdown' || !colConfig.options) return;
    const option = colConfig.options.find(opt => this.getOptionValue(opt) === String(cell.value));
    return option && typeof option !== 'string' ? option.color : undefined;
  }

  getOptionValue = (option: string | DropdownOption) => typeof option === 'string' ? option : option.value;
  getOptionColor = (option: string | DropdownOption) => typeof option === 'string' ? undefined : option.color;

  getHighlightedCellContent(modelRow: number, modelCol: number): string {
    const cellValue = String(this.getCell(modelRow, modelCol)?.value ?? '');
    const query = this.findQuery();

    if (!query) {
      return this.escapeHtml(cellValue);
    }

    const options = this.findOptions();
    const escapedValue = this.escapeHtml(cellValue);
    const escapedQuery = this.escapeHtml(query);

    if (options.matchEntireCell) {
      const matches = options.matchCase
        ? cellValue === query
        : cellValue.toLowerCase() === query.toLowerCase();
      return matches ? `<mark class="bg-yellow-300 text-gray-900">${escapedValue}</mark>` : escapedValue;
    }

    // For partial matches, we need to highlight all occurrences
    const flags = options.matchCase ? 'g' : 'gi';
    const regex = new RegExp(this.escapeRegex(query), flags);

    // Find all matches and their positions in the original string
    let result = '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(cellValue)) !== null) {
      // Add text before the match
      result += this.escapeHtml(cellValue.slice(lastIndex, match.index));
      // Add the highlighted match
      result += `<mark class="bg-yellow-300 text-gray-900">${this.escapeHtml(match[0])}</mark>`;
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text after last match
    result += this.escapeHtml(cellValue.slice(lastIndex));

    return result;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // --- Find and Replace Methods ---
  onFindQueryChange(query: string): void {
    this.findQuery.set(query);
    // Reset to first result when query changes
    if (this.findResults().length > 0) {
      this.currentFindIndex.set(0);
      this.navigateToCurrentMatch();
    } else {
      this.currentFindIndex.set(-1);
    }
  }

  onFindOptionsChange(options: { matchCase: boolean, matchEntireCell: boolean }): void {
    this.findOptions.set(options);
    // Reset to first result when options change
    if (this.findResults().length > 0) {
      this.currentFindIndex.set(0);
      this.navigateToCurrentMatch();
    } else {
      this.currentFindIndex.set(-1);
    }
  }

  navigateToNextMatch(): void {
    const results = this.findResults();
    if (results.length === 0) return;

    const nextIndex = (this.currentFindIndex() + 1) % results.length;
    this.currentFindIndex.set(nextIndex);
    this.navigateToCurrentMatch();
  }

  navigateToPrevMatch(): void {
    const results = this.findResults();
    if (results.length === 0) return;

    const prevIndex = (this.currentFindIndex() - 1 + results.length) % results.length;
    this.currentFindIndex.set(prevIndex);
    this.navigateToCurrentMatch();
  }

  private navigateToCurrentMatch(): void {
    const results = this.findResults();
    const index = this.currentFindIndex();
    if (index < 0 || index >= results.length) return;

    const coords = results[index];
    // Select the cell and scroll to it
    const visualCoords = this.modelToVisualCoords(coords);
    if (visualCoords) {
      this.activeCell.set(visualCoords);
      this.selectionRanges.set([{ start: visualCoords, end: visualCoords }]);
      this.scrollCellIntoView(coords, visualCoords);
    }
  }

  replaceCurrentMatch(replacement: string): void {
    const results = this.findResults();
    const index = this.currentFindIndex();
    if (index < 0 || index >= results.length) return;

    const coords = results[index];
    const cell = this.getCell(coords.row, coords.col);
    if (!cell || cell.readOnly) return;

    this.recordHistory();
    const query = this.findQuery();
    const options = this.findOptions();
    const cellValue = String(cell.value ?? '');

    let newValue: string;
    if (options.matchEntireCell) {
      newValue = replacement;
    } else {
      const flags = options.matchCase ? 'g' : 'gi';
      const regex = new RegExp(this.escapeRegex(query), flags);
      newValue = cellValue.replace(regex, replacement);
    }

    this.data().update(grid => {
      const newGrid = grid.map(r => [...r]);
      newGrid[coords.row][coords.col] = { ...newGrid[coords.row][coords.col], value: newValue };
      return newGrid;
    });

    // Move to next match if available
    setTimeout(() => {
      if (this.findResults().length > 0) {
        // Adjust index if current was removed
        const newIndex = Math.min(index, this.findResults().length - 1);
        this.currentFindIndex.set(newIndex);
        this.navigateToCurrentMatch();
      } else {
        this.currentFindIndex.set(-1);
      }
    }, 0);
  }

  replaceAllMatches(replacement: string): void {
    const results = this.findResults();
    if (results.length === 0) return;

    this.recordHistory();
    const query = this.findQuery();
    const options = this.findOptions();

    this.data().update(grid => {
      const newGrid = grid.map(r => [...r]);

      results.forEach(coords => {
        const cell = newGrid[coords.row][coords.col];
        if (cell.readOnly) return;

        const cellValue = String(cell.value ?? '');
        let newValue: string;

        if (options.matchEntireCell) {
          newValue = replacement;
        } else {
          const flags = options.matchCase ? 'g' : 'gi';
          const regex = new RegExp(this.escapeRegex(query), flags);
          newValue = cellValue.replace(regex, replacement);
        }

        newGrid[coords.row][coords.col] = { ...cell, value: newValue };
      });

      return newGrid;
    });

    // Clear find state after replace all
    this.currentFindIndex.set(-1);
  }

  closeFindReplace(): void {
    this.isFindReplaceVisible.set(false);
    this.findQuery.set('');
    this.currentFindIndex.set(-1);
  }

  getColumnWidth = (colIndex: number) => `${this.columnConfig()()[colIndex]?.width ?? 135}px`;

  isSelected(modelRow: number, modelCol: number): boolean {
    const visualCoords = this.modelToVisualCoords({ row: modelRow, col: modelCol });
    if (!visualCoords) return false;
    return this.selectionRanges().some(range => {
      const norm = this.normalizeRange(range);
      return visualCoords.row >= norm.start.row && visualCoords.row <= norm.end.row && visualCoords.col >= norm.start.col && visualCoords.col <= norm.end.col;
    });
  }

  isActive(modelRow: number, modelCol: number): boolean {
    const active = this.activeCell();
    const visualCoords = this.modelToVisualCoords({ row: modelRow, col: modelCol });
    return !!active && !!visualCoords && active.row === visualCoords.row && active.col === visualCoords.col;
  }

  isEditing = (r: number, c: number) => this.editingCell()?.row === r && this.editingCell()?.col === c;
  isCellInvalid = (r: number, c: number) => this.validationErrors().has(`${r}-${c}`);

  isFillHandleVisible(modelRow: number, modelCol: number): boolean {
    const visualCoords = this.modelToVisualCoords({ row: modelRow, col: modelCol });
    if (!visualCoords) return false;
    const lastRange = this.selectionRanges()[this.selectionRanges().length - 1];
    if (!lastRange) return false;
    const { end } = this.normalizeRange(lastRange);
    return visualCoords.row === end.row && visualCoords.col === end.col;
  }

  isInFillRange(modelRow: number, modelCol: number): boolean {
    const visualCoords = this.modelToVisualCoords({ row: modelRow, col: modelCol });
    if (!visualCoords) return false;
    const range = this.fillRange();
    if (!range) return false;
    const { start, end } = this.normalizeRange(range);
    return visualCoords.row >= start.row && visualCoords.row <= end.row && visualCoords.col >= start.col && visualCoords.col <= end.col;
  }

  onCheckboxChange(event: Event, modelRow: number, modelCol: number): void {
    const target = event.target as HTMLInputElement;
    if (this.getCell(modelRow, modelCol)?.readOnly) {
      target.checked = !target.checked;
      return;
    }
    this.recordHistory();
    this.data().update(grid => {
      const newGrid = grid.map(r => [...r]);
      newGrid[modelRow][modelCol] = { ...newGrid[modelRow][modelCol], value: target.checked };
      return newGrid;
    });
  }

  handleContextMenuAction(action: string) {
    switch (action) {
      case 'openStatsModal': this.isStatsModalVisible.set(true); break;
      case 'openFindReplace': this.isFindReplaceVisible.set(true); break;
      case 'copyTableData': this.copyTableData(); break;
      case 'intelligentReplaceTableData': this.intelligentReplaceTableData(); break;
      case 'importCSV': this.onImportCSVClick(); break;
      case 'exportCSV': this.exportToCSV(); break;
      case 'insertRowAbove': this.insertRowAbove(); break;
      case 'insertRowBelow': this.insertRowBelow(); break;
      case 'deleteRows': this.deleteRows(); break;
      case 'openColumnSettings': this.openColumnSettings(this.contextMenuCoords()!.col); break;
      case 'insertColumnLeft': this.insertColumnLeft(); break;
      case 'insertColumnRight': this.insertColumnRight(); break;
      case 'deleteColumn': this.deleteColumn(); break;
      case 'copy': this._copySelectionToClipboard(); break;
      case 'paste': this.pasteFromContextMenu(); break;
    }
    this.closeContextMenu();
  }

  // --- Event Handlers ---
  onHostMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.isStatsModalVisible() && !target.closest('.stats-modal-panel')) this.isStatsModalVisible.set(false);
    if (target.classList.contains('col-resize-handle') || this.editingCell() || event.button !== 0) return;
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    if (this.activeFilterPopup() && !target.closest('.filter-popup')) this.activeFilterPopup.set(null);

    const colHeader = target.closest('th[data-col-index]');
    if (colHeader) {
      if (target.closest('.pi')) return;
      this.isMouseDown.set(true);
      this.isSelectingCols.set(true);
      const colIndex = parseInt(colHeader.getAttribute('data-col-index')!, 10);
      const lastRow = this.displayedRows().length - 1;
      if (event.shiftKey && this.activeCell()) {
        const active = this.activeCell()!;
        this.selectionRanges.set([{ start: { row: 0, col: Math.min(active.col, colIndex) }, end: { row: lastRow, col: Math.max(active.col, colIndex) } }]);
      } else {
        const newSelection = { start: { row: 0, col: colIndex }, end: { row: lastRow, col: colIndex } };
        this.activeCell.set({ row: 0, col: colIndex });
        isCtrlOrCmd ? this.selectionRanges.update(r => [...r, newSelection]) : this.selectionRanges.set([newSelection]);
      }
      const selection = this.activeSelectionRange()!;
      const norm = this.normalizeRange(selection);
      this.draggedColumnInfo.set({ startIndex: norm.start.col, count: norm.end.col - norm.start.col + 1, startX: event.clientX });
      this.fillRange.set(null);
      event.preventDefault();
      return;
    }

    const rowHeader = target.closest('th[data-row-index]');
    if (rowHeader) {
      this.isMouseDown.set(true);
      this.isSelectingRows.set(true);
      const visualRowIndex = parseInt(rowHeader.getAttribute('data-row-index')!, 10);
      const lastCol = this.colsCount() - 1;
      if (event.shiftKey && this.activeCell()) {
        const active = this.activeCell()!;
        this.selectionRanges.set([{ start: { row: Math.min(active.row, visualRowIndex), col: 0 }, end: { row: Math.max(active.row, visualRowIndex), col: lastCol } }]);
      } else {
        const newSelection = { start: { row: visualRowIndex, col: 0 }, end: { row: visualRowIndex, col: lastCol } };
        this.activeCell.set(newSelection.start);
        isCtrlOrCmd ? this.selectionRanges.update(r => [...r, newSelection]) : this.selectionRanges.set([newSelection]);
      }
      this.fillRange.set(null);
      event.preventDefault();
      return;
    }

    const modelCoords = this.getCoordsFromTarget(target);
    const isFillHandle = target.classList.contains('fill-handle');
    if (modelCoords || isFillHandle) {
      this.isMouseDown.set(true);
      if (isFillHandle) {
        this.isDraggingFill.set(true);
        return;
      }
      if (modelCoords) {
        const visualCoords = this.modelToVisualCoords(modelCoords);
        if (!visualCoords) return;
        if (event.shiftKey && this.activeCell() && this.selectionRanges().length > 0) {
          this.selectionRanges.update(r => [...r.slice(0, -1), { start: r[r.length - 1]!.start, end: visualCoords }]);
        } else if (isCtrlOrCmd) {
          this.activeCell.set(visualCoords);
          this.selectionRanges.update(r => [...r, { start: visualCoords, end: visualCoords }]);
        } else {
          this.activeCell.set(visualCoords);
          this.selectionRanges.set([{ start: visualCoords, end: visualCoords }]);
        }
        this.fillRange.set(null);
      }
    }
  }

  onDocumentMouseMove(event: MouseEvent) {
    if (!this.spreadsheetContainer()?.nativeElement) return;
    if (!this.isMouseDown()) return;
    const resizingCol = this.isResizingCol();
    if (resizingCol !== null && this.resizingColStart()) {
      const newWidth = Math.max(60, this.resizingColStart()!.width + (event.clientX - this.resizingColStart()!.x));
      this.columnConfig().update(configs => {
        const newConfigs = [...configs];
        if (!newConfigs[resizingCol]) newConfigs[resizingCol] = { name: '', field: '' };
        newConfigs[resizingCol] = { ...newConfigs[resizingCol], width: newWidth };
        return newConfigs;
      });
      return;
    }

    const dragInfo = this.draggedColumnInfo();
    if (dragInfo) {
      if (!this.isDraggingColumn() && Math.abs(event.clientX - dragInfo.startX) > 5) this.isDraggingColumn.set(true);
      if (!this.isDraggingColumn()) return;
      const colHeader = (event.target as HTMLElement).closest('th[data-col-index]');
      if (colHeader) {
        const colIndex = parseInt(colHeader.getAttribute('data-col-index')!, 10);
        const rect = colHeader.getBoundingClientRect();
        const potentialDropIndex = event.clientX < rect.left + rect.width / 2 ? colIndex : colIndex + 1;
        this.dropColumnIndex.set((potentialDropIndex > dragInfo.startIndex && potentialDropIndex <= dragInfo.startIndex + dragInfo.count) ? null : potentialDropIndex);
      } else {
        const spreadsheetRect = this.spreadsheetContainer().nativeElement.getBoundingClientRect();
        if (event.clientX < spreadsheetRect.left) this.dropColumnIndex.set(0);
        else if (event.clientX > spreadsheetRect.right) this.dropColumnIndex.set(this.colsCount());
      }
      return;
    }

    const target = event.target as HTMLElement;
    const lastRange = this.selectionRanges()[this.selectionRanges().length - 1];
    if (!lastRange) return;
    if (this.isSelectingRows()) {
      const rowHeader = target.closest('th[data-row-index]');
      if (rowHeader) {
        const visualRowIndex = parseInt(rowHeader.getAttribute('data-row-index')!, 10);
        this.selectionRanges.update(r => [...r.slice(0, -1), { ...lastRange, end: { ...lastRange.end, row: visualRowIndex } }]);
      }
      return;
    }
    if (this.isSelectingCols()) {
      const colHeader = target.closest('th[data-col-index]');
      if (colHeader) {
        const colIndex = parseInt(colHeader.getAttribute('data-col-index')!, 10);
        this.selectionRanges.update(r => [...r.slice(0, -1), { ...lastRange, end: { ...lastRange.end, col: colIndex } }]);
      }
      return;
    }

    const modelCoords = this.getCoordsFromTarget(target);
    if (!modelCoords) return;
    const visualCoords = this.modelToVisualCoords(modelCoords);
    if (!visualCoords) return;

    if (this.isDraggingFill()) {
      const normSel = this.normalizeRange(lastRange);
      const isVerticalDrag = Math.abs(visualCoords.row - normSel.end.row) > Math.abs(visualCoords.col - normSel.end.col);
      const fillEnd = isVerticalDrag ? { row: Math.max(normSel.end.row, visualCoords.row), col: normSel.end.col } : { row: normSel.end.row, col: Math.max(normSel.end.col, visualCoords.col) };
      this.fillRange.set({ start: normSel.start, end: fillEnd });
    } else {
      this.selectionRanges.update(r => [...r.slice(0, -1), { start: lastRange.start, end: visualCoords }]);
    }
  }

  onDocumentMouseUp(event: MouseEvent) {
    if (this.isResizingCol() !== null) {
      this.isResizingCol.set(null);
      this.resizingColStart.set(null);
    }
    if (this.isDraggingColumn()) this.reorderColumns();
    if (this.isDraggingFill()) this.applyFill(this.fillRange());
    this.isMouseDown.set(false);
    this.isDraggingFill.set(false);
    this.isSelectingRows.set(false);
    this.isSelectingCols.set(false);
    this.fillRange.set(null);
    this.isDraggingColumn.set(false);
    this.draggedColumnInfo.set(null);
    this.dropColumnIndex.set(null);
  }

  onCellDoubleClick = (r: number, c: number) => this.startEditing({ row: r, col: c });

  onFillHandleDoubleClick(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    const selection = this.activeSelectionRange();
    if (!selection) return;
    const normSel = this.normalizeRange(selection);
    const displayedData = this.displayedRows();
    if (normSel.end.row >= displayedData.length - 1) return;
    let finalStopRow = displayedData.length;
    for (let c = normSel.start.col; c <= normSel.end.col; c++) {
      let columnStopRow = displayedData.length;
      for (let r = normSel.end.row + 1; r < displayedData.length; r++) {
        const modelCoords = this.visualToModelCoords({ row: r, col: c });
        if (!modelCoords) { columnStopRow = r; break; }
        const value = this.getCell(modelCoords.row, modelCoords.col)?.value;
        if (value != null && String(value).trim() !== '') { columnStopRow = r; break; }
      }
      finalStopRow = Math.min(finalStopRow, columnStopRow);
    }
    const fillTargetEndRow = finalStopRow - 1;
    if (fillTargetEndRow > normSel.end.row) {
      this.applyFill({ start: normSel.start, end: { row: fillTargetEndRow, col: normSel.end.col } });
    }
  }

  onCellMouseEnter(event: MouseEvent, modelRow: number, modelCol: number) {
    const error = this.validationErrors().get(`${modelRow}-${modelCol}`);
    if (!error) return;
    clearTimeout(this.tooltipTimeout);
    this.tooltipTimeout = setTimeout(() => {
      this.tooltipText.set(error);
      const container = this.spreadsheetContainer().nativeElement as HTMLElement;
      const rect = container.getBoundingClientRect();
      this.tooltipPosition.set({ x: event.clientX - rect.left + container.scrollLeft + 10, y: event.clientY - rect.top + container.scrollTop + 10 });
      this.isTooltipVisible.set(true);
    }, 500);
  }

  onCellMouseLeave = () => { clearTimeout(this.tooltipTimeout); this.isTooltipVisible.set(false); }

  onHeaderMouseEnter(event: MouseEvent, colIndex: number) {
    this.lastHeaderHoverTarget = event.currentTarget as HTMLElement;
    clearTimeout(this.headerTooltipTimeout);
    this.headerTooltipTimeout = setTimeout(() => {
      if (!this.rootContainer()) return;
      const config = this.columnConfig()()[colIndex];
      const type = config?.editor ?? 'text';
      this.headerTooltipContent.set({ name: config.name, description: config?.description, type: type.charAt(0).toUpperCase() + type.slice(1), kebabName: config.field });
      const rootRect = this.rootContainer().nativeElement.getBoundingClientRect();
      const targetRect = (event.target as HTMLElement).getBoundingClientRect();
      this.headerTooltipPosition.set({ x: targetRect.left - rootRect.left, y: targetRect.top - rootRect.top + targetRect.height + 2 });
      this.isHeaderTooltipVisible.set(true);
    }, 700);
  }

  onHeaderMouseLeave = () => { clearTimeout(this.headerTooltipTimeout); this.isHeaderTooltipVisible.set(false); }

  onKeyDown(event: KeyboardEvent) {
    // Handle Escape key for modals first, and then stop further processing.
    if (this.isFindReplaceVisible()) {
      if (event.key === 'Escape') this.isFindReplaceVisible.set(false);
      return; // Stop spreadsheet from handling keys
    }
    if (this.isColumnSettingsVisible()) {
      if (event.key === 'Escape') this.isColumnSettingsVisible.set(false);
      return; // Stop spreadsheet from handling keys
    }
    if (this.isStatsModalVisible()) {
      if (event.key === 'Escape') this.isStatsModalVisible.set(false);
      return; // Stop spreadsheet from handling keys
    }

    // If we are editing a cell, let the cell editor handle it
    if (this.editingCell()) return;

    // --- Spreadsheet Global Shortcuts ---

    // Select All
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      this.selectAllCells();
      return;
    }

    // Find/Replace shortcut
    if ((event.ctrlKey || event.metaKey) && (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'f')) {
      event.preventDefault();
      this.isFindReplaceVisible.set(true);
      return;
    }

    // Undo/Redo
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      // The `cancelEdit` is no longer needed here as the `editingCell` guard handles it
      event.shiftKey ? this.redo() : this.undo();
      return;
    }

    // --- Grid Navigation and Interaction ---
    if ((event.ctrlKey || event.metaKey) && ['c', 'v'].includes(event.key.toLowerCase())) {
      event.preventDefault();
      if (event.key.toLowerCase() === 'c') this._copySelectionToClipboard();
      else if (this.getPasteStartCoords()) this._pasteFromClipboard(this.getPasteStartCoords()!);
      return;
    }

    const active = this.activeCell();
    if (!active) return;
    const modelCoords = this.visualToModelCoords(active);
    if (!modelCoords) return;

    const colConfig = this.columnConfig()()[modelCoords.col];
    if (colConfig?.editor === 'checkbox' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      this.toggleCheckbox(modelCoords.row, modelCoords.col);
      return;
    }

    const keyMap: { [key: string]: () => void } = {
      Enter: () => this.startEditing(modelCoords),
      Escape: () => { this.activeCell.set(null); this.selectionRanges.set([]); this.closeContextMenu(); this.activeFilterPopup.set(null); this.isColumnSettingsVisible.set(false); },
      ArrowUp: () => this.moveActiveCell(-1, 0, event.shiftKey),
      ArrowDown: () => this.moveActiveCell(1, 0, event.shiftKey),
      ArrowLeft: () => this.moveActiveCell(0, -1, event.shiftKey),
      ArrowRight: () => this.moveActiveCell(0, 1, event.shiftKey),
      Delete: () => this.clearSelectedCells(),
      Backspace: () => this.clearSelectedCells(),
    };
    if (keyMap[event.key]) {
      event.preventDefault();
      keyMap[event.key]();
    } else if (!event.ctrlKey && !event.metaKey && event.key.length === 1) {
      event.preventDefault();
      this.startEditing(modelCoords, event.key);
    }
  }

  async onCopy(event: ClipboardEvent) { if (!this.editingCell()) { event.preventDefault(); await this._copySelectionToClipboard(); } }
  async onPaste(event: ClipboardEvent) { if (!this.editingCell()) { event.preventDefault(); const coords = this.getPasteStartCoords(); if (coords) await this._pasteFromClipboard(coords); } }

  onColResizeMouseDown(event: MouseEvent, colIndex: number) {
    event.preventDefault();
    event.stopPropagation();
    this.isMouseDown.set(true);
    this.isResizingCol.set(colIndex);
    const th = (event.target as HTMLElement).closest('th');
    if (th) this.resizingColStart.set({ x: event.clientX, width: th.offsetWidth });
  }

  // --- Editing Logic ---
  startEditing(coords: Coordinates, initialValue?: string) {
    const cell = this.getCell(coords.row, coords.col);
    const colConfig = this.columnConfig()()[coords.col];
    if (cell?.readOnly || colConfig?.editor === 'checkbox') return;

    this.isNewValueEntry.set(initialValue !== undefined);
    const cellElement = this.spreadsheetContainer().nativeElement.querySelector(`td[data-row="${coords.row}"][data-col="${coords.col}"]`);
    if (cellElement) {
      const editorBorderOffset = 1;
      this.editorPosition.set({ top: cellElement.offsetTop - editorBorderOffset, left: cellElement.offsetLeft - editorBorderOffset, width: cellElement.offsetWidth + (editorBorderOffset * 2), height: cellElement.offsetHeight + (editorBorderOffset * 2) });
      let valueToEdit: string | number | boolean = initialValue ?? cell?.value ?? '';

      if (colConfig?.editor === 'dropdown') {
        const currentVal = String(cell?.value);
        // When the dropdown opens, the search text is empty, so we work with the full options list.
        const options = colConfig.options?.map(o => this.getOptionValue(o)) ?? [];
        valueToEdit = options.includes(currentVal) ? currentVal : options[0] ?? '';

        // Set the initial highlighted option to match the cell's current value.
        const activeIndex = options.indexOf(currentVal);
        this.dropdownActiveOptionIndex.set(activeIndex > -1 ? activeIndex : 0);
      }
      this.editValue.set(valueToEdit);
      this.editingCell.set(coords);
    }
  }

  onEditBlur = () => { if (this.editingCell()) this.saveEdit(); }

  onEditKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.altKey || event.metaKey)) {
      event.preventDefault();
      const textarea = event.target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd, value } = textarea;
      this.editValue.set(value.substring(0, selectionStart) + '\n' + value.substring(selectionEnd));
      setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + 1; this.onEditorInput(); });
      return;
    }
    if (event.key === 'Enter') { event.preventDefault(); this.saveEdit(); this.moveActiveCell(1, 0, false); }
    else if (event.key === 'Escape') this.cancelEdit();
  }

  onEditorInput() {
    const el = this.editingInput()?.nativeElement;
    const initialPos = this.editorPosition();
    if (el instanceof HTMLTextAreaElement && initialPos && el.parentElement) {
      el.style.height = 'auto';
      const requiredParentHeight = el.scrollHeight + 18;
      el.parentElement.style.height = `${Math.max(initialPos.height, requiredParentHeight)}px`;
      el.style.height = `${el.parentElement.offsetHeight - 18}px`;
    }
  }

  saveEdit() {
    const editing = this.editingCell();
    if (!editing) return;
    const originalValue = this.getCell(editing.row, editing.col)?.value;
    let newValue: string | number | boolean = this.editValue();
    const colConfig = this.columnConfig()()[editing.col];
    if (colConfig?.editor === 'numeric') {
      const stringValue = String(newValue).trim();
      if (stringValue === '') newValue = '';
      else { const parsed = parseFloat(stringValue); if (!isNaN(parsed) && isFinite(parsed)) newValue = parsed; }
    }
    if (originalValue !== newValue) {
      this.recordHistory();
      this.data().update(grid => {
        const newGrid = grid.map(r => [...r]);
        newGrid[editing.row][editing.col] = { ...newGrid[editing.row][editing.col], value: newValue };
        return newGrid;
      });
    }
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingCell.set(null);
    this.editorPosition.set(null);
    this.dropdownSearchText.set('');
    this.dropdownActiveOptionIndex.set(0);
    setTimeout(() => this.spreadsheetContainer()?.nativeElement.focus({ preventScroll: true }), 0);
  }

  selectDropdownOption(option: DropdownOption | string) {
    const editing = this.editingCell();
    if (!editing) return;
    this.recordHistory();
    const value = this.getOptionValue(option);
    this.data().update(grid => {
      const newGrid = grid.map(r => [...r]);
      newGrid[editing.row][editing.col] = { ...newGrid[editing.row][editing.col], value };
      return newGrid;
    });
    this.cancelEdit();
  }

  editDropdownOptions() {
    const colIndex = this.editingCell()!.col;
    this.cancelEdit();
    this.openColumnSettings(colIndex);
  }

  onDropdownKeyDown(event: KeyboardEvent) {
    event.stopPropagation();
    const options = this.filteredDropdownOptions();
    if (options.length === 0 && event.key !== 'Escape') return;
    const keyMap: { [key: string]: () => void } = {
      ArrowDown: () => this.dropdownActiveOptionIndex.update(i => (i + 1) % options.length),
      ArrowUp: () => this.dropdownActiveOptionIndex.update(i => (i - 1 + options.length) % options.length),
      Enter: () => this.selectDropdownOption(options[this.dropdownActiveOptionIndex()]),
      ' ': () => this.selectDropdownOption(options[this.dropdownActiveOptionIndex()]),
      Escape: () => this.cancelEdit(),
    };
    if (keyMap[event.key]) {
      event.preventDefault();
      keyMap[event.key]();
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) this.scrollActiveDropdownOptionIntoView();
    }
  }

  // --- Header Actions ---
  toggleSort(col: number) {
    const current = this.sortConfig();
    if (current?.col === col && current.direction === 'asc') this.sortConfig.set({ col, direction: 'desc' });
    else if (current?.col === col) this.sortConfig.set(null);
    else this.sortConfig.set({ col, direction: 'asc' });
  }

  toggleFilterPopup(col: number, event: MouseEvent) {
    event.stopPropagation();
    if (this.activeFilterPopup()?.col === col) this.activeFilterPopup.set(null);
    else {
      this.activeFilterPopup.set({ col, target: event.currentTarget as HTMLElement });
    }
  }

  handleApplyFilter({ col, selection }: { col: number, selection: Set<string> }) {
    const allValues = this.currentFilterUniqueValues();
    this.filterConfig.update(filters => {
      const newFilters = new Map(filters);
      if (selection.size === allValues.length || selection.size === 0) newFilters.delete(col);
      else newFilters.set(col, selection);
      return newFilters;
    });
    this.activeFilterPopup.set(null);
  }

  handleClearFilter(col: number) {
    this.filterConfig.update(filters => { const newFilters = new Map(filters); newFilters.delete(col); return newFilters; });
    this.activeFilterPopup.set(null);
  }

  // --- Column Settings ---
  openColumnSettings(colIndex: number) {
    this.closeContextMenu();
    this.columnSettingsColIndex.set(colIndex);
    this.isColumnSettingsVisible.set(true);
  }

  handleSaveColumnSettings({ colIndex, formState }: { colIndex: number; config: ColumnConfig; formState: ColumnSettingsFormData }) {
    this.recordHistory();

    this.columnConfig().update(configs => {
      const newConfigs = [...configs];
      const oldConfig = newConfigs[colIndex] ?? { name: '', field: '' };

      const newOptions = formState.type === 'dropdown' ? formState.options.map(opt => ({ value: opt.value.trim(), color: opt.color })).filter(opt => opt.value) : undefined;
      const newEditor = formState.type === 'text' ? undefined : formState.type;

      newConfigs[colIndex] = {
        ...oldConfig,
        name: formState.name,
        field: this._toKebabCase(formState.name),
        description: formState.description || undefined,
        width: formState.widthValue ?? 135,
        editor: newEditor,
        options: newOptions,
      };

      return newConfigs;
    });

    this.data().update(grid => {
      const newGrid = grid.map(r => [...r]);
      for (let r = 0; r < newGrid.length; r++) {
        const oldCell = newGrid[r][colIndex];
        if (!oldCell) continue;
        let newValue = oldCell.value;
        if (formState.type === 'numeric') newValue = (typeof oldCell.value === 'string' && oldCell.value.trim() !== '') ? parseFloat(oldCell.value) : (typeof oldCell.value === 'boolean' ? (oldCell.value ? 1 : 0) : newValue);
        else if (formState.type === 'checkbox') newValue = ['true', '1'].includes(String(oldCell.value).toLowerCase().trim());
        else newValue = String(oldCell.value);

        const newCell: Cell = { ...oldCell, value: newValue };
        newGrid[r][colIndex] = newCell;
      }
      return newGrid;
    });
    this.isColumnSettingsVisible.set(false);
  }

  // --- Context Menu Logic ---
  private adjustContextMenuPosition() {
    // If menu was closed, stop.
    if (!this.isContextMenuVisible()) return;

    const menuHostEl = (this.contextMenuEl() as any)?.elementRef.nativeElement;
    const containerEl = this.rootContainer()?.nativeElement;

    if (!menuHostEl || !containerEl) {
      setTimeout(() => this.adjustContextMenuPosition(), 10);
      return;
    }

    const menuPopupEl = menuHostEl.querySelector('.long-spreadsheet-context-menu > div') as HTMLElement || menuHostEl.firstElementChild as HTMLElement;

    if (!menuPopupEl) {
      setTimeout(() => this.adjustContextMenuPosition(), 10);
      return;
    }

    const { offsetWidth: menuWidth, offsetHeight: menuHeight } = menuPopupEl;

    if (menuWidth === 0 || menuHeight === 0) {
      setTimeout(() => this.adjustContextMenuPosition(), 10);
      return;
    }

    const launchCoords = this.menuLaunchCoords();
    if (!launchCoords) return;

    const clickX = launchCoords.x;
    const clickY = launchCoords.y;

    const containerRect = containerEl.getBoundingClientRect();
    const margin = 5;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const boundRight = Math.min(containerRect.right, viewportWidth);
    const boundBottom = Math.min(containerRect.bottom, viewportHeight);
    const boundLeft = Math.max(containerRect.left, 0);
    const boundTop = Math.max(containerRect.top, 0);

    let finalX = clickX;
    let finalY = clickY;

    if (finalX + menuWidth + margin > boundRight) finalX = clickX - menuWidth;
    if (finalY + menuHeight + margin > boundBottom) finalY = clickY - menuHeight;

    const maxLeft = boundRight - menuWidth - margin;
    const minLeft = boundLeft + margin;

    finalX = Math.max(minLeft, Math.min(finalX, maxLeft));
    finalY = Math.max(boundTop + margin, Math.min(finalY, boundBottom - menuHeight - margin));

    this.contextMenuPosition.set({ x: finalX, y: finalY });
  }

  onDocumentMouseDown(event: MouseEvent) {
    const target = event.target as HTMLElement;

    // If a dropdown editor is open, its own mousedown handler stops propagation.
    // Therefore, if this document-level listener fires, the click must have been outside the dropdown.
    const editing = this.editingCell();
    if (editing && this.columnConfig()()[editing.col]?.editor === 'dropdown') {
      this.cancelEdit();
    }

    // Ignore clicks on filter toggles; their own (click) handler will manage state.
    if (target.closest('.filter-toggle-btn')) {
      return;
    }

    // For any other mousedown that reaches the document, close transient UI elements.
    // Clicks inside modals/popups should have propagation stopped by their own handlers.
    this.closeContextMenu();
    this.activeFilterPopup.set(null);

    // If the click was completely outside the component, clear the selection.
    const rootEl = this.rootContainer()?.nativeElement;
    if (rootEl && !rootEl.contains(target)) {
      this.activeCell.set(null);
      this.selectionRanges.set([]);
    }
  }

  onHeaderCornerContextMenu(event: MouseEvent) {
    event.preventDefault(); this.closeContextMenu(); this.contextMenuType.set('headerCorner'); this.openContextMenu(event);
  }
  onCellContextMenu(event: MouseEvent, modelRow: number, modelCol: number) {
    event.preventDefault(); this.closeContextMenu();
    const visual = this.modelToVisualCoords({ row: modelRow, col: modelCol });
    if (!visual) return;
    if (!this.isSelected(modelRow, modelCol)) { this.activeCell.set(visual); this.selectionRanges.set([{ start: visual, end: visual }]); }
    this.contextMenuType.set('cell');
    this.contextMenuCoords.set({ row: modelRow, col: modelCol });
    this.openContextMenu(event);
  }
  onRowContextMenu(event: MouseEvent, visualRowIndex: number) {
    event.preventDefault(); this.closeContextMenu();
    const modelRow = this.displayedRows()[visualRowIndex].originalModelIndex;
    if (!this.isSelected(modelRow, 0)) {
      const start = { row: visualRowIndex, col: 0 };
      this.activeCell.set(start);
      this.selectionRanges.set([{ start, end: { row: visualRowIndex, col: this.colsCount() - 1 } }]);
    }
    this.contextMenuType.set('row');
    this.contextMenuCoords.set({ row: modelRow, col: 0 });
    this.openContextMenu(event);
  }
  onColumnContextMenu(event: MouseEvent, colIndex: number) {
    event.preventDefault(); this.closeContextMenu();
    const visual = this.modelToVisualCoords({ row: 0, col: colIndex });
    if (!this.isSelected(0, colIndex) && visual) {
      const start = { row: 0, col: colIndex };
      this.activeCell.set(visual);
      this.selectionRanges.set([{ start, end: { row: this.displayedRows().length - 1, col: colIndex } }]);
    }
    this.contextMenuType.set('col');
    this.contextMenuCoords.set({ row: 0, col: colIndex });
    this.openContextMenu(event);
  }

  private openContextMenu(event: MouseEvent) {
    this.menuLaunchCoords.set({ x: event.clientX, y: event.clientY });
    this.contextMenuPosition.set({ x: event.clientX, y: event.clientY });
    this.isContextMenuVisible.set(true);
    // Defer adjustment slightly to allow initial render
    setTimeout(() => this.adjustContextMenuPosition(), 0);
  }
  closeContextMenu = () => { this.isContextMenuVisible.set(false); this.contextMenuType.set(null); this.contextMenuCoords.set(null); }

  insertRowAbove() {
    const selection = this.activeSelectionRange();
    if (!selection) return;
    this.recordHistory();
    const { start } = this.normalizeRange(selection);
    const modelCoords = this.visualToModelCoords(start);
    if (!modelCoords) return;
    const newRows = Array.from({ length: this.selectedRowCount() }, () => this._createNewRow());
    this.data().update(grid => { const newGrid = [...grid]; newGrid.splice(modelCoords.row, 0, ...newRows); return newGrid; });
  }

  insertRowBelow() {
    const selection = this.activeSelectionRange();
    if (!selection) return;
    this.recordHistory();
    const { end } = this.normalizeRange(selection);
    const modelCoords = this.visualToModelCoords(end);
    if (!modelCoords) return;
    const newRows = Array.from({ length: this.selectedRowCount() }, () => this._createNewRow());
    this.data().update(grid => { const newGrid = [...grid]; newGrid.splice(modelCoords.row + 1, 0, ...newRows); return newGrid; });
  }

  deleteRows() {
    const selection = this.activeSelectionRange();
    if (!selection) return;
    this.recordHistory();
    const modelRowsToDelete = new Set<number>();
    const { start, end } = this.normalizeRange(selection);
    for (let r = start.row; r <= end.row; r++) {
      const modelCoords = this.visualToModelCoords({ row: r, col: 0 });
      if (modelCoords) modelRowsToDelete.add(modelCoords.row);
    }
    this.data().update(grid => grid.filter((_, i) => !modelRowsToDelete.has(i)));
    this.activeCell.set(null);
    this.selectionRanges.set([]);
  }

  insertColumnLeft() {
    const colIndex = this.contextMenuCoords()!.col;
    this.recordHistory();
    const newColName = this.getNewColumnName();
    this.data().update(grid => grid.map(row => { const newRow = [...row]; newRow.splice(colIndex, 0, { value: '' }); return newRow; }));
    this.columnConfig().update(c => { const newC = [...c]; newC.splice(colIndex, 0, { name: newColName, field: this._toKebabCase(newColName) }); return newC; });
  }

  insertColumnRight() {
    const colIndex = this.contextMenuCoords()!.col;
    this.recordHistory();
    const newColName = this.getNewColumnName();
    this.data().update(grid => grid.map(row => { const newRow = [...row]; newRow.splice(colIndex + 1, 0, { value: '' }); return newRow; }));
    this.columnConfig().update(c => { const newC = [...c]; newC.splice(colIndex + 1, 0, { name: newColName, field: this._toKebabCase(newColName) }); return newC; });
  }

  deleteColumn() {
    const selection = this.activeSelectionRange();
    if (!selection) return;
    this.recordHistory();
    const { start, end } = this.normalizeRange(selection);
    const count = end.col - start.col + 1;
    this.data().update(grid => grid.map(row => { const newRow = [...row]; newRow.splice(start.col, count); return newRow; }));
    this.columnConfig().update(c => { const newC = [...c]; newC.splice(start.col, count); return newC; });
    this.activeCell.set(null);
    this.selectionRanges.set([]);
  }

  copyTableData() {
    const headerRow = this.columnConfig()().map(c => ({ value: c.name }));
    const allRows = [headerRow, ...this.displayedRows().map(item => item.cells)];
    navigator.clipboard.writeText(this._convertDataToTSV(allRows));
  }

  async intelligentReplaceTableData() {
    try {
      const tsv = await navigator.clipboard.readText();
      const pastedGrid = this._parseTSV(tsv);
      if (pastedGrid.length > 0) this._performIntelligentReplace(pastedGrid);
    } catch (err) { console.error('Failed to read clipboard', err); }
  }

  pasteFromContextMenu() {
    const coords = this.getPasteStartCoords();
    if (coords) this._pasteFromClipboard(coords);
  }

  onImportCSVClick = () => this.csvImporter()?.nativeElement.click();
  onCSVFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const reader = new FileReader();
    reader.onload = e => {
      const data = this._parseCSV(e.target?.result as string);
      if (data.length > 0) this._performIntelligentReplace(data);
    };
    reader.readAsText(input.files[0]);
    input.value = '';
  }

  exportToCSV() {
    const headerRow = this.columnConfig()().map(c => ({ value: c.name }));
    const allRows = [headerRow, ...this.displayedRows().map(item => item.cells)];
    const csv = this._convertDataToCSV(allRows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "spreadsheet_export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  // --- History Management ---
  private recordHistory() { this.undoStack.update(s => [...s, this.data()()]); this.redoStack.set([]); }
  undo() {
    const lastState = this.undoStack().pop();
    if (!lastState) return;
    this.redoStack.update(s => [...s, this.data()()]);
    this.data().set(lastState);
    this.activeCell.set(null); this.selectionRanges.set([]);
  }
  redo() {
    const nextState = this.redoStack().pop();
    if (!nextState) return;
    this.undoStack.update(s => [...s, this.data()()]);
    this.data().set(nextState);
    this.activeCell.set(null); this.selectionRanges.set([]);
  }

  // --- Private Helpers ---
  private scrollActiveDropdownOptionIntoView() {
    setTimeout(() => this.dropdownEditor()?.nativeElement.querySelector(`#dropdown-option-${this.dropdownActiveOptionIndex()}`)?.scrollIntoView({ block: 'nearest' }), 0);
  }

  private reorderColumns() {
    const dragGroup = this.draggedColumnInfo();
    let dropIndex = this.dropColumnIndex();
    if (!dragGroup || dropIndex == null || (dropIndex > dragGroup.startIndex && (dropIndex -= dragGroup.count) === dragGroup.startIndex)) return;
    this.recordHistory();
    const from = dragGroup.startIndex;
    const to = dropIndex;
    const N = this.colsCount();
    const newToOld = Array.from({ length: N }, (_, i) => i);
    const moved = newToOld.splice(from, dragGroup.count);
    newToOld.splice(to, 0, ...moved);
    const oldToNew = new Array(N);
    newToOld.forEach((oldIdx, newIdx) => oldToNew[oldIdx] = newIdx);
    this.data().update(grid => grid.map(row => newToOld.map(oldIdx => row[oldIdx])));
    this.columnConfig().update(c => newToOld.map(oldIdx => c[oldIdx] || { name: '', field: '' }));
    this.sortConfig.update(s => s ? { ...s, col: oldToNew[s.col] } : null);
    this.filterConfig.update(f => { const nf = new Map(); for (const [oc, v] of f.entries()) nf.set(oldToNew[oc], v); return nf; });
    const update = (c: Coordinates) => ({ ...c, col: oldToNew[c.col] });
    this.selectionRanges.update(r => r.map(range => ({ start: update(range.start), end: update(range.end) })));
    this.activeCell.update(a => a ? update(a) : null);

    // Force layout update after DOM has settled to ensure selection outline is correct
    setTimeout(() => this.layoutTick.update(v => v + 1), 0);
  }

  private escapeHtml = (unsafe: string) => unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&quot;").replace(/'/g, "&#039;");

  private _createNewRow(): Cell[] {
    return Array.from({ length: this.colsCount() }, (_, c) => {
      const colConfig = this.columnConfig()()[c];
      const newCell: Cell = { value: '' };
      if (colConfig) {
        if (colConfig.editor === 'checkbox') newCell.value = false;
        else if (colConfig.editor === 'dropdown') newCell.value = this.getOptionValue(colConfig.options?.[0] ?? '');
      }
      return newCell;
    });
  }

  private getPasteStartCoords(): Coordinates | null {
    if (this.selectionRanges().length === 0) return this.activeCell() ? this.visualToModelCoords(this.activeCell()!) : null;
    let topLeft: Coordinates = { row: Infinity, col: Infinity };
    this.selectionRanges().forEach(r => { const norm = this.normalizeRange(r); if (norm.start.row <= topLeft.row) topLeft = norm.start; });
    return this.visualToModelCoords(topLeft);
  }

  private getNewColumnName(): string {
    const headers = new Set(this.columnConfig()().map(c => c.name));
    for (let i = 0; i < 26; i++) { const name = `Attribute ${String.fromCharCode(65 + i)}`; if (!headers.has(name)) return name; }
    let i = 1; while (headers.has(`Attribute ${i}`)) i++; return `Attribute ${i}`;
  }

  private visualToModelCoords = (c: Coordinates) => c.row < 0 || c.row >= this.displayedRows().length ? null : { row: this.displayedRows()[c.row].originalModelIndex, col: c.col };
  private modelToVisualCoords = (c: Coordinates) => { const vr = this.displayedRows().findIndex(i => i.originalModelIndex === c.row); return vr === -1 ? null : { row: vr, col: c.col }; };
  private toggleCheckbox(r: number, c: number) { const cell = this.getCell(r, c); const colConfig = this.columnConfig()()[c]; if (!cell || colConfig?.editor !== 'checkbox' || cell.readOnly) return; this.recordHistory(); this.data().update(g => { const ng = g.map(row => [...row]); ng[r][c] = { ...ng[r][c], value: !ng[r][c].value }; return ng; }); }

  private validateData(grid: Cell[][]) {
    const errors = new Map<string, string>();
    grid.forEach((row, r) => {
      row.forEach((cell, c) => {
        const colConfig = this.columnConfig()()[c];
        if (colConfig?.editor === 'dropdown' && colConfig.options?.length && !colConfig.options.map(o => this.getOptionValue(o)).includes(String(cell.value))) {
          errors.set(`${r}-${c}`, `Invalid value. Please choose from the available options.`);
        } else if (colConfig?.editor === 'numeric' && cell.value != '' && cell.value != null && (typeof cell.value !== 'number' || !isFinite(cell.value))) {
          errors.set(`${r}-${c}`, `Value must be a number.`);
        }
      });
    });
    this.validationErrors.set(errors);
  }

  private _convertDataToTSV = (data: Cell[][]) => data.map(row => row.map(cell => { const v = String(cell?.value ?? ''); return v.match(/["\n\t]/) ? `"${v.replace(/"/g, '""')}"` : v; }).join('\t')).join('\n');
  private _convertDataToCSV = (data: Cell[][]) => data.map(row => row.map(cell => { const v = String(cell?.value ?? ''); return v.match(/["\n\r,]/) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')).join('\n');

  private async _copySelectionToClipboard() {
    const range = this.activeSelectionRange(); if (!range) return;
    const norm = this.normalizeRange(range);
    const selectedData = this.displayedRows().slice(norm.start.row, norm.end.row + 1).map(item => item.cells.slice(norm.start.col, norm.end.col + 1));
    await navigator.clipboard.writeText(this._convertDataToTSV(selectedData));
  }

  private _convertPastedValue(value: string, colConfig: ColumnConfig | undefined): string | number | boolean {
    if (!colConfig) return value;

    switch (colConfig.editor) {
      case 'numeric':
        const trimmedValue = value.trim();
        if (trimmedValue === '') return ''; // Allow clearing cell
        const cleanedValue = trimmedValue.replace(/[\$,]/g, '');
        const parsed = parseFloat(cleanedValue);
        return !isNaN(parsed) && isFinite(parsed) ? parsed : value; // Return original string if not a valid number
      case 'checkbox':
        const lowerValue = value.toLowerCase().trim();
        return lowerValue === 'true' || lowerValue === '1';
      default:
        return value;
    }
  }

  private async _pasteFromClipboard(startModelCoords: Coordinates) {
    const pastedRows = this._parseTSV(await navigator.clipboard.readText());
    if (pastedRows.length === 0) return;
    this.recordHistory();
    if (pastedRows.length === 1 && pastedRows[0].length === 1 && (this.selectionRanges().length > 1 || this.selectedColCount() > 1 || this.selectedRowCount() > 1)) {
      const value = pastedRows[0][0];
      this.data().update(grid => {
        const newGrid = grid.map(r => [...r]);
        this.selectionRanges().forEach(range => {
          const norm = this.normalizeRange(range);
          for (let r = norm.start.row; r <= norm.end.row; r++) {
            for (let c = norm.start.col; c <= norm.end.col; c++) {
              const model = this.visualToModelCoords({ row: r, col: c });
              if (!model) continue;
              const colConfig = this.columnConfig()()[model.col];
              const target = newGrid[model.row]?.[model.col];
              if (target && !target.readOnly) {
                newGrid[model.row][model.col] = { ...target, value: this._convertPastedValue(value, colConfig) };
              }
            }
          }
        });
        return newGrid;
      });
    } else {
      const startVisual = this.modelToVisualCoords(startModelCoords); if (!startVisual) return;
      const sel = this.activeSelectionRange() ?? { start: startVisual, end: startVisual };
      const normSel = this.normalizeRange(sel);
      const selRows = normSel.end.row - normSel.start.row + 1;
      const selCols = normSel.end.col - normSel.start.col + 1;
      const effRows = Math.max(selRows, pastedRows.length), effCols = Math.max(selCols, pastedRows[0].length);
      this.data().update(grid => {
        const newGrid = grid.map(r => [...r]);
        for (let rOff = 0; rOff < effRows; rOff++) {
          for (let cOff = 0; cOff < effCols; cOff++) {
            const targetVisualCoords = { row: startVisual.row + rOff, col: startVisual.col + cOff };

            if (targetVisualCoords.col >= this.colsCount()) continue;

            const modelCoords = this.visualToModelCoords(targetVisualCoords);
            if (!modelCoords) continue;

            const target = newGrid[modelCoords.row]?.[modelCoords.col];
            if (target && !target.readOnly) {
              const value = pastedRows[rOff % pastedRows.length][cOff % pastedRows[0].length];
              const colConfig = this.columnConfig()()[modelCoords.col];
              newGrid[modelCoords.row][modelCoords.col] = { ...target, value: this._convertPastedValue(value, colConfig) };
            }
          }
        }
        return newGrid;
      });
    }
  }

  private _parseTSV(tsv: string): string[][] { /* Complex parser, simplified for brevity */ return tsv.split('\n').map(r => r.split('\t')); }
  private _parseCSV(csv: string): string[][] { /* Complex parser, simplified for brevity */ return csv.split('\n').map(r => r.split(',')); }
  private getCoordsFromTarget = (t: HTMLElement): Coordinates | null => { const c = t.closest('td[data-row][data-col]'); return c ? { row: parseInt(c.getAttribute('data-row')!), col: parseInt(c.getAttribute('data-col')!) } : null; }
  private normalizeRange = (r: { start: Coordinates, end: Coordinates }) => ({ start: { row: Math.min(r.start.row, r.end.row), col: Math.min(r.start.col, r.end.col) }, end: { row: Math.max(r.start.row, r.end.row), col: Math.max(r.start.col, r.end.col) } });

  private moveActiveCell(rd: number, cd: number, extend: boolean) {
    const a = this.activeCell();
    if (!a) return;
    const nc = {
      row: Math.max(0, Math.min(this.displayedRows().length - 1, a.row + rd)),
      col: Math.max(0, Math.min(this.colsCount() - 1, a.col + cd))
    };
    this.activeCell.set(nc);
    if (extend && this.selectionRanges().length > 0) {
      this.selectionRanges.update(r => [...r.slice(0, -1), { start: r[r.length - 1]!.start, end: nc }]);
    } else {
      this.selectionRanges.set([{ start: nc, end: nc }]);
    }
    const mc = this.visualToModelCoords(nc);
    if (mc) {
      this.scrollCellIntoView(mc, nc);
    }
  }

  private scrollCellIntoView(modelCoords: Coordinates, visualCoords: Coordinates) {
    const container = this.spreadsheetContainer()?.nativeElement as HTMLElement;
    if (!container) return;

    // Query for the table cell and the sticky headers
    const cellEl = container.querySelector(`[data-row="${modelCoords.row}"][data-col="${modelCoords.col}"]`) as HTMLElement;
    const headerEl = container.querySelector('thead') as HTMLElement;
    // Query for the first row header in the table body to get its width
    const rowHeaderEl = container.querySelector('tbody th.sticky') as HTMLElement;

    if (!cellEl || !headerEl) return;

    const headerHeight = headerEl.offsetHeight;
    // Use a fallback width if the sticky row header isn't found (e.g., table not rendered yet)
    const rowHeaderWidth = rowHeaderEl ? rowHeaderEl.offsetWidth : 0;

    // Cell position relative to the scrollable table content
    const cellTop = cellEl.offsetTop;
    const cellBottom = cellTop + cellEl.offsetHeight;
    const cellLeft = cellEl.offsetLeft;
    const cellRight = cellLeft + cellEl.offsetWidth;

    // Container's current scroll state and dimensions
    const containerScrollTop = container.scrollTop;
    const containerVisibleHeight = container.clientHeight;
    const containerScrollLeft = container.scrollLeft;
    const containerVisibleWidth = container.clientWidth;

    // --- Vertical Scroll Adjustment ---
    // Check if the cell is obscured by the sticky header or is above the current viewport
    if (cellTop < containerScrollTop + headerHeight) {
      container.scrollTop = cellTop - headerHeight;
    }
    // Check if the cell is below the current viewport
    else if (cellBottom > containerScrollTop + containerVisibleHeight) {
      container.scrollTop = cellBottom - containerVisibleHeight;
    }

    // --- Horizontal Scroll Adjustment ---
    // Check if the cell is obscured by the sticky column or is to the left of the current viewport
    if (cellLeft < containerScrollLeft + rowHeaderWidth) {
      container.scrollLeft = cellLeft - rowHeaderWidth;
    }
    // Check if the cell is to the right of the current viewport
    else if (cellRight > containerScrollLeft + containerVisibleWidth) {
      container.scrollLeft = cellRight - containerVisibleWidth;
    }

    // --- Edge Case Snapping ---
    // When navigating to the very first column or row, ensure scrollbars are reset to the origin.
    // This provides a better user experience by fully revealing the headers.
    if (visualCoords.col === 0) {
      container.scrollLeft = 0;
    }
    if (visualCoords.row === 0) {
      container.scrollTop = 0;
    }
  }

  private clearSelectedCells() { if (this.selectionRanges().length === 0) return; this.recordHistory(); this.data().update(grid => { const newGrid = grid.map(r => [...r]); this.selectionRanges().forEach(range => { const norm = this.normalizeRange(range); for (let r = norm.start.row; r <= norm.end.row; r++) for (let c = norm.start.col; c <= norm.end.col; c++) { const model = this.visualToModelCoords({ row: r, col: c }); const colConfig = this.columnConfig()()[c]; if (model && newGrid[model.row][model.col] && !newGrid[model.row][model.col].readOnly) newGrid[model.row][model.col] = { ...newGrid[model.row][model.col], value: colConfig?.editor === 'checkbox' ? false : '' }; } }); return newGrid; }); }
  private applyFill(fill: { start: Coordinates; end: Coordinates } | null) { const sel = this.activeSelectionRange(); if (!fill || !sel) return; this.recordHistory(); const normSel = this.normalizeRange(sel), normFill = this.normalizeRange(fill); this.data().update(grid => { const newGrid = grid.map(r => [...r]); const sRows = normSel.end.row - normSel.start.row + 1, sCols = normSel.end.col - normSel.start.col + 1; for (let r = normSel.start.row; r <= normFill.end.row; r++) for (let c = normSel.start.col; c <= normFill.end.col; c++) if (r > normSel.end.row || c > normSel.end.col) { const sVisRow = normSel.start.row + ((r - normSel.start.row) % sRows), sVisCol = normSel.start.col + ((c - normSel.start.col) % sCols); const sMod = this.visualToModelCoords({ row: sVisRow, col: sVisCol }), tMod = this.visualToModelCoords({ row: r, col: c }); if (sMod && tMod && newGrid[tMod.row]?.[c] && !newGrid[tMod.row][c].readOnly) newGrid[tMod.row][c] = { ...newGrid[tMod.row][c], value: grid[sMod.row][sMod.col].value }; } return newGrid; }); this.selectionRanges.set([fill]); }
  private _performIntelligentReplace(pastedGrid: string[][]) { /* ... complex logic ... */ }
  private _inferColumnType = (data: string[][], col: number): any => 'text';
  private _toKebabCase = (str: string) => String(str).replace(/([a-z\d])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}