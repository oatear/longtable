import { ChangeDetectionStrategy, Component, computed, input, signal, effect, viewChild, ElementRef, ChangeDetectorRef, inject, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cell, AnalysisType, AnalysisOption, DropdownOption, SavedCorrelationAnalysisState, ColumnConfig, SpreadsheetTheme } from '../../models/spreadsheet.model';
// Fix: Import d3 functions and types directly instead of using the d3 namespace.
import {
  select,
  extent,
  max,
  scaleLinear,
  scaleSqrt,
  scaleOrdinal,
  schemeSet2,
  scaleSequential,
  interpolatePlasma,
  axisBottom,
  axisLeft,
  axisRight,
  format,
  range,
  Selection,
  ScaleSequential as ScaleSequentialType
} from 'd3';

type CorrelationDataPoint = { x: number; y: number; category?: string; name: string };

@Component({
  selector: 'long-correlation-analysis',
  templateUrl: './correlation-analysis.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrelationAnalysisComponent {
  rows = input.required<{ cells: Cell[], originalModelIndex: number }[]>();
  useCountColumn = input.required<boolean>();
  state = input.required<WritableSignal<SavedCorrelationAnalysisState>>();
  columnConfig = input.required<ColumnConfig[]>();
  theme = input.required<SpreadsheetTheme>();

  private chartContainer = viewChild<ElementRef<HTMLDivElement>>('correlationChartContainer');
  private tooltip = viewChild<ElementRef<HTMLDivElement>>('statsTooltip');

  private cdr = inject(ChangeDetectorRef);
  private hasInitialized = false;

  constructor() {
    effect(() => {
      this.rows();
      this.columnConfig();
      this.initializeFields();
      this.cdr.markForCheck();
    });

    effect(() => {
      if (this.chartContainer()) {
        this.renderChart();
      }
    });
  }

  private initializeFields() {
    const state = this.state();
    const numericCols = this.numericColumns();

    if (state().fieldX !== null && !numericCols.some(c => c.value === state().fieldX)) {
      state.update(s => ({ ...s, fieldX: null }));
    }
    if (state().fieldY !== null && !numericCols.some(c => c.value === state().fieldY)) {
      state.update(s => ({ ...s, fieldY: null }));
    }

    const catOptions = this.categoryOptions();
    if (state().categoryField !== null && !catOptions.some(o => o.value === state().categoryField)) {
      state.update(s => ({ ...s, categoryField: null }));
    }

    if (this.hasInitialized) return;

    if (state().fieldX === null && numericCols.length > 0) {
      state.update(s => ({ ...s, fieldX: numericCols[0].value }));
    }
    if (state().fieldY === null) {
      state.update(s => ({ ...s, fieldY: numericCols.length > 1 ? numericCols[1].value : (numericCols.length > 0 ? numericCols[0].value : null) }));
    }

    this.hasInitialized = true;
  }

  private renderChart() {
    const data = this.correlationData();
    setTimeout(() => {
      if (this.chartContainer()) {
        const xLabel = this.numericColumns().find(c => c.value === this.state()().fieldX)?.label ?? 'X-Axis';
        const yLabel = this.numericColumns().find(c => c.value === this.state()().fieldY)?.label ?? 'Y-Axis';
        const catField = this.state()().categoryField;
        const catFieldInfo = catField !== null ? this.analysisOptions().find(opt => opt.value === catField) : undefined;
        let dropdownOptions: DropdownOption[] | undefined;
        if (catFieldInfo && this.rows().length > 0) {
          const colConfig = this.columnConfig()[catFieldInfo.value];
          if (colConfig?.editor === 'dropdown' && colConfig.options) {
            dropdownOptions = colConfig.options.map(opt => typeof opt === 'string' ? { value: opt, color: '#e5e7eb' } : opt);
          }
        }
        this.renderScatterPlot(this.chartContainer()!.nativeElement, data, xLabel, yLabel, catFieldInfo?.type, dropdownOptions);
      }
    });
  }

  countColumnIndex = computed<number>(() => this.columnConfig().findIndex(c => c.name.toLowerCase() === 'count'));

  analysisOptions = computed<AnalysisOption[]>(() => {
    return this.columnConfig()
      .map((col, index) => {
        const editor = col?.editor;
        let type: AnalysisType = 'token';
        if (editor === 'dropdown' || editor === 'checkbox') type = 'categorical';
        else if (editor === 'numeric') type = 'numeric';
        if (this.countColumnIndex() === index && this.useCountColumn()) return null;
        return { label: col.name, value: index, type };
      })
      .filter((c): c is AnalysisOption => c !== null);
  });

  numericColumns = computed(() => {
    return this.analysisOptions()
      .filter(opt => opt.type === 'numeric')
      .map(opt => ({ label: opt.label, value: opt.value }));
  });

  categoryOptions = computed(() => this.analysisOptions().filter(opt => opt.value !== this.state()().fieldX && opt.value !== this.state()().fieldY));

  chartTitle = computed(() => {
    const state = this.state()();
    if (state.fieldX === null || state.fieldY === null) return '';
    const numericOptions = this.numericColumns();
    const xLabel = numericOptions.find(o => o.value === state.fieldX)?.label;
    const yLabel = numericOptions.find(o => o.value === state.fieldY)?.label;
    if (!xLabel || !yLabel) return '';

    let title = `Correlation between ${xLabel} and ${yLabel}`;
    const catField = state.categoryField;
    if (catField !== null) {
      const catLabel = this.categoryOptions().find(o => o.value === catField)?.label;
      if (catLabel) title += `, categorized by ${catLabel}`;
    }
    return title;
  });

  correlationData = computed<CorrelationDataPoint[]>(() => {
    const dataRows = this.rows();
    const { fieldX, fieldY, categoryField } = this.state()();
    if (fieldX === null || fieldY === null) return [];

    const nameColIndex = this.columnConfig().findIndex(c => { const val = c.name.toLowerCase(); return val.includes('name') || val.includes('title'); });

    // FIX: Replaced map/filter with flatMap to resolve a complex TypeScript type inference error with the type guard.
    // flatMap naturally handles filtering out null/empty values while mapping and ensures the correct output type.
    return dataRows.flatMap((row): CorrelationDataPoint[] => {
      const x = row.cells[fieldX]?.value;
      const y = row.cells[fieldY]?.value;
      if (typeof x !== 'number' || typeof y !== 'number') return [];

      const point: CorrelationDataPoint = {
        x: x,
        y: y,
        category: categoryField !== null ? String(row.cells[categoryField]?.value ?? 'N/A') : undefined,
        name: nameColIndex > -1 ? String(row.cells[nameColIndex]?.value ?? `Row ${row.originalModelIndex}`) : `Row ${row.originalModelIndex}`
      };
      return [point];
    });
  });

  onFieldXChange(v: any) { this.state().update(s => ({ ...s, fieldX: v === 'null' ? null : Number(v) })); }
  onFieldYChange(v: any) { this.state().update(s => ({ ...s, fieldY: v === 'null' ? null : Number(v) })); }
  onCategoryFieldChange(v: any) { this.state().update(s => ({ ...s, categoryField: v === 'null' ? null : Number(v) })); }

  private renderScatterPlot(container: HTMLElement, data: CorrelationDataPoint[], xLabel: string, yLabel: string, categoryType?: AnalysisType, dropdownOptions?: DropdownOption[]) {
    select(container).html('');
    if (data.length === 0) { select(container).html(`<p class="text-sm text-center text-gray-500 dark:text-slate-400 p-4">Select two numeric fields to see their correlation.</p>`); return; }

    const pointMap = new Map<string, { x: number; y: number; count: number; category?: string; names: string[] }>();
    data.forEach(p => {
      const key = `${p.x}-${p.y}-${p.category}`;
      if (pointMap.has(key)) {
        const point = pointMap.get(key)!;
        point.count++;
        point.names.push(p.name);
      } else {
        pointMap.set(key, { x: p.x, y: p.y, category: p.category, count: 1, names: [p.name] });
      }
    });
    const aggregatedData = Array.from(pointMap.values());

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = this.theme().colors.graphSecondary;
    const margin = { top: 5, right: 100, bottom: 60, left: 60 };
    const width = container.clientWidth - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = select(container).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom).append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const x = scaleLinear().domain(extent(data, d => d.x) as [number, number]).range([0, width]).nice();
    const y = scaleLinear().domain(extent(data, d => d.y) as [number, number]).range([height, 0]).nice();

    const maxCount = max(aggregatedData, d => d.count) || 1;
    const radius = scaleSqrt().domain([1, maxCount]).range([4, 15]);

    const categories = Array.from(new Set(data.map(d => d.category))).filter(c => c !== undefined);
    let color: any;
    const hasCategory = categories.length > 0;
    if (hasCategory && dropdownOptions) {
      const colorMap = new Map(dropdownOptions.map(opt => [opt.value, opt.color]));
      color = scaleOrdinal(categories.map(cat => colorMap.get(cat as string) || '#cccccc')).domain(categories as string[]);
    } else if (hasCategory && categoryType === 'numeric') {
      const numericCategories = categories.map(c => Number(c)).filter(n => !isNaN(n));
      if (numericCategories.length > 0) {
        color = scaleSequential(interpolatePlasma).domain(extent(numericCategories) as [number, number]);
      }
    } else if (hasCategory) {
      color = scaleOrdinal(schemeSet2).domain(categories as string[]);
    }

    const xAxisGroup = svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x));
    xAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');
    xAxisGroup.select('.domain').style('stroke', textColor);
    xAxisGroup.selectAll('.tick line').style('stroke', textColor);

    svg.append('text').attr('text-anchor', 'middle').attr('x', width / 2).attr('y', height + 45).text(xLabel).style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-title, 12px)');

    const yAxisGroup = svg.append('g').call(axisLeft(y));
    yAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');
    yAxisGroup.select('.domain').style('stroke', textColor);
    yAxisGroup.selectAll('.tick line').style('stroke', textColor);

    svg.append('text').attr('text-anchor', 'end').attr('transform', 'rotate(-90)').attr('y', -margin.left + 20).attr('x', -height / 2).text(yLabel).style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-title, 12px)');

    const tooltip = select(this.tooltip()!.nativeElement);

    svg.append('g').selectAll('dot').data(aggregatedData).enter().append('circle').attr('cx', d => x(d.x)).attr('cy', d => y(d.y)).attr('r', d => radius(d.count))
      // Fix: Corrected the logic for point coloring. The original code incorrectly passed a number to an ordinal scale 
      // when a category was numeric but also had dropdown options. This ensures the correct value type is always used.
      .style('fill', d => d.category && color ? (categoryType === 'numeric' && !dropdownOptions ? color(Number(d.category)) : color(d.category)) : this.theme().colors.graphPrimary).style('opacity', '0.7')
      .on('mouseover', (event, d) => {
        select(event.currentTarget).attr('stroke', isDark ? '#fff' : '#000').attr('stroke-width', 2).style('opacity', '1');
        let tipHtml = `<strong>${xLabel}:</strong> ${d.x}<br/><strong>${yLabel}:</strong> ${d.y}`;
        if (d.category) tipHtml += `<br/><strong>Category:</strong> ${d.category}`;
        tipHtml += `<br/><strong>Count:</strong> ${d.count}`;
        if (d.names?.length) {
          tipHtml += `<hr class="my-1 border-slate-500">`;
          const maxNames = 5;
          d.names.slice(0, maxNames).forEach(name => {
            tipHtml += `<div class="truncate">- ${name}</div>`;
          });
          if (d.names.length > maxNames) {
            tipHtml += `<div>...and ${d.names.length - maxNames} more</div>`;
          }
        }
        tooltip.style('opacity', '1').html(tipHtml);
      }).on('mousemove', (event) => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
      .on('mouseout', (event) => {
        select(event.currentTarget).attr('stroke', null).attr('stroke-width', null).style('opacity', '0.7');
        tooltip.style('opacity', '0');
      });

    if (color && hasCategory) {
      if (categoryType === 'numeric' && !dropdownOptions) {
        this._renderGradientLegend(svg, color, width + 20, 0, 150, "Value");
      } else {
        const legend = svg.selectAll('.legend').data(color.domain()).enter().append('g')
          .attr('class', 'legend')
          .attr('transform', (d, i) => `translate(0,${i * 20})`)
          .style('cursor', 'default')
          .on('mouseover', (event, d) => {
            select(event.currentTarget).select('text').style('font-weight', 'bold');
            tooltip.style('opacity', '1').html(String(d));
          })
          .on('mousemove', (event) => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
          .on('mouseout', (event) => {
            select(event.currentTarget).select('text').style('font-weight', 'normal');
            tooltip.style('opacity', '0');
          });

        legend.append('rect').attr('x', width + 10).attr('width', 18).attr('height', 18).style('fill', d => color(String(d)));
        legend.append('text').attr('x', width + 34).attr('y', 9).attr('dy', '.35em').style('text-anchor', 'start').text(d => this.truncateText(String(d), 12)).style('fill', textColor).style('font-size', 'var(--lt-font-chart-legend, 12px)');
      }
    }
  }

  // Fix: The ScaleSequentialType was incorrectly defined with a 'never' parameter. 
  // This has been corrected to align with modern D3 typings, preventing potential type errors during compilation.
  private _renderGradientLegend(svg: Selection<SVGGElement, unknown, null, undefined>, colorScale: ScaleSequentialType<string>, legendX: number, legendY: number, height: number, title: string) {
    const textColor = this.theme().colors.graphSecondary;
    const [min, max] = colorScale.domain();
    if (min === undefined || max === undefined) return;
    const legendId = `legend-gradient-${Math.random().toString(36).substring(2, 9)}`;

    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
      .attr("id", legendId)
      .attr("x1", "0%").attr("y1", "100%")
      .attr("x2", "0%").attr("y2", "0%");

    linearGradient.selectAll("stop")
      .data(range(0, 1.01, 0.1).map(t => ({ offset: `${t * 100}%`, color: colorScale(min + t * (max - min)) })))
      .enter().append("stop")
      .attr("offset", d => d.offset)
      .attr("stop-color", d => d.color);

    const legendWidth = 18;
    svg.append("rect")
      .attr("x", legendX)
      .attr("y", legendY)
      .attr("width", legendWidth)
      .attr("height", height)
      .style("fill", `url(#${legendId})`);

    const legendScale = scaleLinear().domain([min, max]).range([height, 0]);
    const legendAxis = axisRight(legendScale).ticks(5).tickFormat(format(".2s"));

    const legendAxisGroup = svg.append("g")
      .attr("class", "legend-axis")
      .attr("transform", `translate(${legendX + legendWidth}, ${legendY})`)
      .call(legendAxis)
      .style('font-size', 'var(--lt-font-chart-axis-label, 10px)');

    legendAxisGroup.select(".domain").remove();
    legendAxisGroup.selectAll('text').style('fill', textColor);
    legendAxisGroup.selectAll('.tick line').style('stroke', textColor);

    svg.append("text")
      .attr("x", legendX)
      .attr("y", legendY - 5)
      .style("text-anchor", "start")
      .text(title)
      .style("font-weight", "bold")
      .style("fill", textColor)
      .style('font-size', 'var(--lt-font-chart-legend, 12px)');
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1) + '…';
  }
}