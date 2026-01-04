import { ChangeDetectionStrategy, Component, computed, input, output, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cell, ColumnConfig, AnalysisOption, AnalysisType, GraphConfig, DistributionGraphConfig, CorrelationGraphConfig } from '../../models/spreadsheet.model';
import { DistributionAnalysisComponent } from '../distribution-analysis/distribution-analysis.component';
import { CorrelationAnalysisComponent } from '../correlation-analysis/correlation-analysis.component';

@Component({
  selector: 'long-table-stats',
  templateUrl: './table-stats.component.html',
  imports: [CommonModule, FormsModule, DistributionAnalysisComponent, CorrelationAnalysisComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableStatsComponent {
  isVisible = input.required<boolean>();
  rows = input.required<{ cells: Cell[], originalModelIndex: number }[]>();
  columnConfig = input.required<ColumnConfig[]>();
  graphs = input.required<GraphConfig[]>();
  useCountColumn = input.required<WritableSignal<boolean>>();

  close = output<void>();

  countColumnIndex = computed<number>(() => this.columnConfig().findIndex(c => c.name.toLowerCase() === 'count'));

  analysisOptions = computed<AnalysisOption[]>(() => {
    return this.columnConfig()
      .map((col, index) => {
        const editor = col?.editor;
        let type: AnalysisType = 'token';
        if (editor === 'dropdown' || editor === 'checkbox') type = 'categorical';
        else if (editor === 'numeric') type = 'numeric';
        if (this.countColumnIndex() === index && this.useCountColumn()()) return null;
        return { label: col.name, value: index, type };
      })
      .filter((c): c is AnalysisOption => c !== null);
  });

  categoricalOptions = computed(() => {
    return this.analysisOptions().filter(opt => opt.type === 'categorical');
  });

  initialAnalysisFields = computed<(number | null)[]>(() => {
    const catOptions = this.categoricalOptions();
    const allOptions = this.analysisOptions();
    const usedFields = new Set<number>();
    
    const distributionGraphCount = this.graphs().filter(g => g.type === 'distribution').length;
    
    const result: (number | null)[] = [];
    for (let i = 0; i < distributionGraphCount; i++) {
      // Try to find an unused categorical option first
      let bestOption = catOptions.find(opt => !usedFields.has(opt.value));
      if (bestOption) {
        usedFields.add(bestOption.value);
        result.push(bestOption.value);
        continue;
      }

      // Then try to find any unused option
      bestOption = allOptions.find(opt => !usedFields.has(opt.value));
      if (bestOption) {
        usedFields.add(bestOption.value);
        result.push(bestOption.value);
        continue;
      }

      // If all are used, just return the first available option
      result.push(allOptions.length > 0 ? allOptions[0].value : null);
    }
    return result;
  });

  getDistributionIndex(graphIndex: number): number {
    let distIndex = -1;
    for (let i = 0; i <= graphIndex; i++) {
      if(this.graphs()[i].type === 'distribution') {
        distIndex++;
      }
    }
    return distIndex;
  }
}