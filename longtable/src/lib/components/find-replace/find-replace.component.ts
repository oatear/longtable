import { ChangeDetectionStrategy, Component, input, output, signal, viewChild, ElementRef, effect, inject, Renderer2, OnDestroy, computed } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpreadsheetTheme } from '../../models/spreadsheet.model';

@Component({
  selector: 'long-find-replace',
  templateUrl: './find-replace.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style]': 'themeCssVariables()',
  }
})
export class FindReplaceComponent implements OnDestroy {
  isVisible = input.required<boolean>();
  container = input<HTMLElement | null>(null);
  theme = input<SpreadsheetTheme | null>(null);

  // Inputs from parent spreadsheet
  resultsCount = input<number>(0);
  currentIndex = input<number>(-1);

  // Outputs to parent spreadsheet
  close = output<void>();
  findQueryChange = output<string>();
  findOptionsChange = output<{ matchCase: boolean, matchEntireCell: boolean }>();
  navigateNext = output<void>();
  navigatePrev = output<void>();
  replaceOne = output<string>();
  replaceAll = output<string>();

  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private appendedToBody = false;

  private panel = viewChild<ElementRef<HTMLDivElement>>('panel');
  private findInput = viewChild<ElementRef<HTMLInputElement>>('findInput');

  findQuery = signal('');
  replaceQuery = signal('');
  matchCase = signal(false);
  matchEntireCell = signal(false);

  // Position is now in viewport coordinates for fixed positioning
  position = signal({ x: 0, y: 0 });
  private hasInitializedPosition = false;

  // Dragging state
  isDragging = signal(false);
  private dragStart = signal<{ panelX: number, panelY: number, mouseX: number, mouseY: number } | null>(null);

  themeCssVariables = computed(() => {
    const theme = this.theme();
    if (!theme) {
      return {};
    }
    const styles = Object.entries(theme.colors).reduce((acc, [key, value]) => {
      const cssVar = `--lt-${key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
      if (typeof value === 'string') {
        acc[cssVar] = value;
      }
      return acc;
    }, {} as { [key: string]: string });

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

  constructor() {
    // Append to body when visible
    effect(() => {
      if (this.isVisible() && !this.appendedToBody) {
        this.renderer.appendChild(this.document.body, this.elementRef.nativeElement);
        this.appendedToBody = true;

        // Initialize position near top-right of container
        if (!this.hasInitializedPosition) {
          const containerEl = this.container();
          if (containerEl) {
            const rect = containerEl.getBoundingClientRect();
            this.position.set({
              x: rect.right - 340, // 320px panel width + 20px margin
              y: rect.top + 20
            });
          }
          this.hasInitializedPosition = true;
        }
      } else if (!this.isVisible() && this.appendedToBody) {
        if (this.elementRef.nativeElement.parentNode) {
          this.renderer.removeChild(this.document.body, this.elementRef.nativeElement);
        }
        this.appendedToBody = false;
      }
    });

    // Emit find query changes
    effect(() => {
      const query = this.findQuery();
      this.findQueryChange.emit(query);
    });

    // Focus find input when panel becomes visible
    effect(() => {
      if (this.isVisible()) {
        setTimeout(() => this.findInput()?.nativeElement.focus(), 0);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.appendedToBody && this.elementRef.nativeElement.parentNode) {
      this.renderer.removeChild(this.document.body, this.elementRef.nativeElement);
      this.appendedToBody = false;
    }
  }

  onMatchCaseChange(checked: boolean): void {
    this.matchCase.set(checked);
    this.findOptionsChange.emit({ matchCase: this.matchCase(), matchEntireCell: this.matchEntireCell() });
  }

  onMatchEntireCellChange(checked: boolean): void {
    this.matchEntireCell.set(checked);
    this.findOptionsChange.emit({ matchCase: this.matchCase(), matchEntireCell: this.matchEntireCell() });
  }

  onReplace(): void {
    this.replaceOne.emit(this.replaceQuery());
  }

  onReplaceAll(): void {
    this.replaceAll.emit(this.replaceQuery());
  }

  onFindKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.shiftKey ? this.navigatePrev.emit() : this.navigateNext.emit();
    }
  }

  onDragStart(event: MouseEvent): void {
    event.preventDefault();

    this.isDragging.set(true);
    const currentPos = this.position();

    this.dragStart.set({
      panelX: currentPos.x,
      panelY: currentPos.y,
      mouseX: event.clientX,
      mouseY: event.clientY,
    });

    const onMouseMove = (moveEvent: MouseEvent) => {
      const start = this.dragStart();
      if (!start) return;

      const deltaX = moveEvent.clientX - start.mouseX;
      const deltaY = moveEvent.clientY - start.mouseY;

      // Calculate new position
      let newX = start.panelX + deltaX;
      let newY = start.panelY + deltaY;

      // Clamp to viewport bounds
      const panelEl = this.panel()?.nativeElement;
      if (panelEl) {
        const panelRect = panelEl.getBoundingClientRect();
        const margin = 10;
        newX = Math.max(margin, Math.min(newX, window.innerWidth - panelRect.width - margin));
        newY = Math.max(margin, Math.min(newY, window.innerHeight - panelRect.height - margin));
      }

      this.position.set({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      this.isDragging.set(false);
      this.dragStart.set(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}