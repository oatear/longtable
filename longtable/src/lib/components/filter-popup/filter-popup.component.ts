import { ChangeDetectionStrategy, Component, computed, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'long-filter-popup',
  templateUrl: './filter-popup.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterPopupComponent {
  isVisible = input.required<boolean>();
  position = input.required<{ display: string; left: string; top: string; }>();
  uniqueValues = input.required<string[]>();
  initialSelection = input.required<Set<string>>();

  apply = output<Set<string>>();
  clear = output<void>();
  close = output<void>();

  searchText = signal('');
  tempSelection = signal<Set<string>>(new Set());

  constructor() {
    effect(() => {
        // Initialize tempSelection when initialSelection changes
        this.tempSelection.set(new Set(this.initialSelection()));
    }, { allowSignalWrites: true });
  }

  displayedValues = computed(() => {
    const search = this.searchText().toLowerCase();
    const values = this.uniqueValues();
    if (!search) return values;
    return values.filter(val => String(val).toLowerCase().includes(search));
  });

  toggleValueSelection(value: string): void {
    this.tempSelection.update(selection => {
      const newSelection = new Set(selection);
      newSelection.has(value) ? newSelection.delete(value) : newSelection.add(value);
      return newSelection;
    });
  }

  selectAll(): void {
    this.tempSelection.set(new Set(this.uniqueValues()));
  }

  clearAll(): void {
    this.tempSelection.set(new Set());
  }

  onApply() {
    this.apply.emit(this.tempSelection());
  }
}