import { ChangeDetectionStrategy, Component, input, output, ElementRef, Renderer2, effect, inject, OnDestroy, computed } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { ContextMenuData, SpreadsheetTheme } from '../../models/spreadsheet.model';

@Component({
  selector: 'long-context-menu',
  templateUrl: './context-menu.component.html',
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style]': 'themeCssVariables()',
  }
})
export class ContextMenuComponent implements OnDestroy {
  isVisible = input.required<boolean>();
  position = input.required<{ x: number; y: number }>();
  type = input.required<'row' | 'cell' | 'col' | 'headerCorner' | null>();
  data = input.required<ContextMenuData>();
  appendTo = input<'body' | null>(null);
  theme = input<SpreadsheetTheme | null>(null);

  menuAction = output<string>();

  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private appendedToBody = false;

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
    effect(() => {
      if (this.appendTo() === 'body') {
        if (this.isVisible() && !this.appendedToBody) {
          this.renderer.appendChild(this.document.body, this.elementRef.nativeElement);
          this.appendedToBody = true;
        } else if (!this.isVisible() && this.appendedToBody) {
          // Check if elementRef.nativeElement still has a parent before removing
          if (this.elementRef.nativeElement.parentNode) {
            this.renderer.removeChild(this.document.body, this.elementRef.nativeElement);
          }
          this.appendedToBody = false;
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.appendedToBody && this.elementRef.nativeElement.parentNode) {
      this.renderer.removeChild(this.document.body, this.elementRef.nativeElement);
      this.appendedToBody = false;
    }
  }

  emit(action: string) {
    this.menuAction.emit(action);
  }
}