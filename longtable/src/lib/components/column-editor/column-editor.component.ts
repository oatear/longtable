import { ChangeDetectionStrategy, Component, computed, input, output, signal, effect, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cell, ColumnConfig, ColumnSettingsFormData, ColumnType } from '../../models/spreadsheet.model';

@Component({
  selector: 'long-column-editor',
  templateUrl: './column-editor.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnEditorComponent {
  isVisible = input.required<boolean>();
  columnIndex = input.required<number | null>();
  allRows = input.required<Cell[][]>();
  columnConfig = input.required<WritableSignal<ColumnConfig[]>>();

  close = output<void>();
  save = output<{ colIndex: number; config: ColumnConfig; formState: ColumnSettingsFormData }>();

  form = signal<ColumnSettingsFormData | null>(null);

  private readonly colorPalette: string[] = [
    '#fca5a5', '#fdba74', '#fcd34d', '#bef264', '#86efac', '#5eead4',
    '#67e8f9', '#7dd3fc', '#93c5fd', '#a5b4fc', '#c4b5fd', '#f9a8d4', '#fda4af',
  ];

  constructor() {
    effect(() => {
      if (this.isVisible()) {
        this.initializeForm();
      }
    });
  }

  private initializeForm(): void {
    const idx = this.columnIndex();
    if (idx === null) {
      this.form.set(null);
      return;
    }

    const config = this.columnConfig()()[idx];
    const header = config.name;
    const currentType: ColumnType = config?.editor ?? 'text';
    const currentOptionsRaw = config?.options ?? [];
    const currentWidth = config?.width;
    const currentDescription = config?.description;

    const currentOptions = currentOptionsRaw.map(opt => 
      typeof opt === 'string'
        ? { value: opt, color: '#e5e7eb' }
        : { value: opt.value, color: opt.color || '#e5e7eb' }
    );

    this.form.set({
      name: String(header),
      description: currentDescription ?? '',
      type: currentType,
      options: currentOptions,
      widthValue: typeof currentWidth === 'number' ? currentWidth : null,
    });
  }

  addOption(): void {
    this.form.update(form => form ? { ...form, options: [...form.options, { value: '', color: '#e5e7eb' }] } : null);
  }

  removeOption(index: number): void {
    this.form.update(form => {
      if (!form) return null;
      const newOptions = [...form.options];
      newOptions.splice(index, 1);
      return { ...form, options: newOptions };
    });
  }

  inferOptions(): void {
    const colIndex = this.columnIndex();
    if (colIndex === null) return;

    const uniqueValues = new Set<string>();
    for (let r = 0; r < this.allRows().length; r++) {
      const value = this.allRows()[r][colIndex]?.value;
      if (value != null && String(value).trim() !== '') {
        uniqueValues.add(String(value));
      }
    }

    this.form.update(currentForm => {
      if (!currentForm) return null;
      const newForm = { ...currentForm, options: [...currentForm.options] };
      const existingValues = new Set(newForm.options.map(opt => opt.value));
      uniqueValues.forEach(value => {
        if (!existingValues.has(value)) {
          newForm.options.push({ value, color: this.getUniqueColor(newForm.options) });
        }
      });
      return newForm;
    });
  }

  onSave(): void {
    const colIndex = this.columnIndex();
    const formState = this.form();
    if (colIndex === null || !formState) return;
    
    const config = this.columnConfig()()[colIndex] ?? { name: '', field: ''};
    const newConfig: ColumnConfig = { ...config };

    newConfig.width = (formState.widthValue != null && String(formState.widthValue).trim() !== '') 
      ? Math.max(60, Number(formState.widthValue)) 
      : 135;
      
    if (formState.description) {
      newConfig.description = formState.description;
    } else {
      delete newConfig.description;
    }

    this.save.emit({ colIndex, config: newConfig, formState });
  }

  private getUniqueColor(existingOptions: { color: string }[]): string {
    const usedColors = new Set(existingOptions.map(opt => opt.color));
    const availableColor = this.colorPalette.find(color => !usedColors.has(color));
    return availableColor || this.colorPalette[existingOptions.length % this.colorPalette.length];
  }
}