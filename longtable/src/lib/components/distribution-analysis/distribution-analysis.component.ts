import { ChangeDetectionStrategy, Component, computed, input, effect, viewChild, ElementRef, ChangeDetectorRef, inject, WritableSignal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Cell, AnalysisType, AnalysisOption, DropdownOption, SavedDistributionAnalysisState, ColumnConfig } from '../../models/spreadsheet.model';
import {
  select,
  max,
  scaleLinear,
  scaleBand,
  axisBottom,
  axisLeft,
  axisRight,
  stack,
  scaleOrdinal,
  schemeSet2,
  scaleSequential,
  interpolatePlasma,
  extent,
  range,
  format,
  Selection,
  ScaleSequential as ScaleSequentialType
} from 'd3';

type SimpleTableData = { isStacked: false; headers: string[]; rows: { value: string; count: number; }[] };
type StackedTableData = { isStacked: true; headers: string[]; stackKeys: string[]; rows: { primaryValue: string; total: number;[key: string]: any }[] };
type TableData = SimpleTableData | StackedTableData;

@Component({
  selector: 'long-distribution-analysis',
  templateUrl: './distribution-analysis.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DistributionAnalysisComponent {
  rows = input.required<{ cells: Cell[], originalModelIndex: number }[]>();
  useCountColumn = input.required<boolean>();
  initialAnalysisField = input<number | null>(null);
  state = input.required<WritableSignal<SavedDistributionAnalysisState>>();
  columnConfig = input.required<ColumnConfig[]>();

  private chartContainer = viewChild<ElementRef<HTMLDivElement>>('distributionChartContainer');
  private tooltip = viewChild<ElementRef<HTMLDivElement>>('statsTooltip');

  copyState = signal<'idle' | 'copied'>('idle');
  private copyTimeout: any;

  private cdr = inject(ChangeDetectorRef);
  private hasInitialized = false;

  private stopWords = new Set(['a', 'an', 'and', 'the', 'is', 'in', 'of', 'for', 'on', 'with', 'to', 'it', 'that', 'this', 'was', 'were', 'be', 'are', 'as', 'at', 'by', 'but', 'or', 'from', 'has', 'have', 'he', 'she', 'they', 'i', 'we', 'you', 'not']);

  constructor() {
    effect(() => {
      // This effect runs when inputs change.
      this.rows();
      this.columnConfig();
      this.initializeFields();
      this.cdr.markForCheck();
    });

    effect(() => {
      // This effect runs when view-affecting state changes.
      if (this.chartContainer()) {
        this.renderChart();
      }
    });
  }

  private initializeFields() {
    const state = this.state();
    const options = this.analysisOptions();

    if (state().analysisField !== null && !options.some(o => o.value === state().analysisField)) {
      state.update(s => ({ ...s, analysisField: null, stackByField: null }));
    }

    const stackOptions = this.stackByOptions();
    if (state().stackByField !== null && !stackOptions.some(o => o.value === state().stackByField)) {
      state.update(s => ({ ...s, stackByField: null }));
    }

    if (this.hasInitialized) {
      return;
    }

    if (state().analysisField === null) {
      const initialField = this.initialAnalysisField();
      if (initialField !== null && options.some(o => o.value === initialField)) {
        state.update(s => ({ ...s, analysisField: initialField }));
      } else if (options.length > 0) {
        const categoricalOption = options.find(opt => opt.type === 'categorical');
        state.update(s => ({ ...s, analysisField: categoricalOption ? categoricalOption.value : options[0].value }));
      }
    }

    this.hasInitialized = true;
  }

  private renderChart() {
    const data = this.distributionData();
    setTimeout(() => {
      if (this.state()().view === 'chart') {
        if (data && this.chartContainer()) {
          const analysisFieldInfo = this.analysisOptions().find(opt => opt.value === this.state()().analysisField);
          const stackByFieldInfo = this.analysisOptions().find(opt => opt.value === this.state()().stackByField);
          let dropdownOptions: DropdownOption[] | undefined;
          if (stackByFieldInfo && this.rows().length > 0) {
            const colConfig = this.columnConfig()[stackByFieldInfo.value];
            if (colConfig?.editor === 'dropdown' && colConfig.options) {
              dropdownOptions = colConfig.options.map(opt => typeof opt === 'string' ? { value: opt, color: '#e5e7eb' } : opt);
            }
          }
          this.renderAnalysisChart(this.chartContainer()!.nativeElement, data, analysisFieldInfo?.type, stackByFieldInfo?.type, dropdownOptions);
        } else if (this.chartContainer()) {
          select(this.chartContainer()!.nativeElement).html('<p class="text-sm text-center text-gray-500 dark:text-slate-400 p-4">Select a field to analyze.</p>');
        }
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

  stackByOptions = computed(() => this.analysisOptions().filter(opt => opt.value !== this.state()().analysisField));

  chartTitle = computed(() => {
    const field = this.state()().analysisField;
    if (field === null) return '';
    const options = this.analysisOptions();
    const analysisLabel = options.find(o => o.value === field)?.label;
    if (!analysisLabel) return '';

    let title = `Distribution of ${analysisLabel}`;
    const stackField = this.state()().stackByField;
    if (stackField !== null) {
      const stackLabel = options.find(o => o.value === stackField)?.label;
      if (stackLabel) title += ` by ${stackLabel}`;
    }
    return title;
  });

  distributionData = computed(() => {
    const dataRows = this.rows();
    const countIdx = this.countColumnIndex();
    const useCount = this.useCountColumn() && countIdx > -1;

    const { analysisField, stackByField } = this.state()();
    const fieldInfo = this.analysisOptions().find(opt => opt.value === analysisField);
    if (analysisField === null || !fieldInfo) return null;

    const dataMap = new Map<string, any>();
    const title = this.columnConfig()[analysisField].name;

    dataRows.forEach(row => {
      const value = row.cells[analysisField]?.value;
      const count = useCount ? Number(row.cells[countIdx]?.value ?? 1) : 1;
      const stackValue = stackByField !== null ? String(row.cells[stackByField]?.value ?? 'N/A') : null;

      const processValue = (val: string) => {
        if (stackByField !== null) {
          if (!dataMap.has(val)) {
            dataMap.set(val, new Map<string, number>());
          }
          const innerMap = dataMap.get(val) as Map<string, number>;
          innerMap.set(stackValue!, (innerMap.get(stackValue!) || 0) + count);
        } else {
          dataMap.set(val, (dataMap.get(val) || 0) + count);
        }
      };

      if (fieldInfo.type === 'token') {
        String(value).toLowerCase().split(/[\s,.;:()]+/).forEach(token => {
          if (token && !this.stopWords.has(token)) processValue(token);
        });
      } else {
        processValue(String(value ?? 'N/A'));
      }
    });
    return { title, data: dataMap };
  });

  tableData = computed<TableData | null>(() => {
    const data = this.distributionData();
    if (!data) return null;
    const isStacked = this.state()().stackByField !== null;
    if (!isStacked) {
      const rows = Array.from((data.data as Map<string, number>).entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count);
      return { isStacked: false, headers: [data.title, 'Count'], rows: rows };
    } else {
      const dataMap = data.data as Map<string, Map<string, number>>;
      const stackKeys = Array.from(new Set(Array.from(dataMap.values()).flatMap(innerMap => Array.from(innerMap.keys())))).sort();
      const rows = Array.from(dataMap.entries()).map(([key, innerMap]) => {
        const row: { [key: string]: any } = { primaryValue: key, total: 0 };
        stackKeys.forEach(stackKey => {
          const value = innerMap.get(stackKey) || 0;
          row[stackKey] = value;
          row.total += value;
        });
        return row;
      }).sort((a, b) => b.total - a.total);
      return { isStacked: true, headers: [data.title, ...stackKeys, 'Total'], stackKeys: stackKeys, rows: rows as unknown as StackedTableData['rows'] };
    }
  });

  copyTableDataToClipboard(): void {
    const table = this.tableData();
    if (!table) return;

    const headers = table.headers;
    const rows = table.rows;

    let dataGrid: (string | number)[][] = [];
    dataGrid.push(headers);

    if (!table.isStacked) {
      (rows as { value: string; count: number }[]).forEach(row => {
        dataGrid.push([row.value, row.count]);
      });
    } else {
      (rows as any[]).forEach(row => {
        const rowData: (string | number)[] = [row.primaryValue];
        (table.stackKeys as string[]).forEach(key => {
          rowData.push(row[key] || 0);
        });
        rowData.push(row.total);
        dataGrid.push(rowData);
      });
    }

    const tsv = dataGrid.map(row =>
      row.map(cell => {
        const v = String(cell ?? '');
        return v.match(/["\n\t]/) ? `"${v.replace(/"/g, '""')}"` : v;
      }).join('\t')
    ).join('\n');

    navigator.clipboard.writeText(tsv).then(() => {
      this.copyState.set('copied');
      clearTimeout(this.copyTimeout);
      this.copyTimeout = setTimeout(() => this.copyState.set('idle'), 2000);
    }).catch(err => {
      console.error('Failed to copy table data: ', err);
    });
  }

  onAnalysisFieldChange(v: any) {
    const newValue = v === 'null' ? null : Number(v);
    this.state().update(s => {
      const newStackBy = s.stackByField === newValue ? null : s.stackByField;
      return { ...s, analysisField: newValue, stackByField: newStackBy };
    });
  }

  onStackByChange(v: any) {
    const newValue = v === 'null' ? null : Number(v);
    this.state().update(s => ({ ...s, stackByField: newValue }));
  }

  setView(view: 'chart' | 'table') {
    this.state().update(s => ({ ...s, view }));
  }

  private renderAnalysisChart(container: HTMLElement, config: { title: string, data: Map<string, any> }, analysisFieldType?: AnalysisType, stackByFieldType?: AnalysisType, dropdownOptions?: DropdownOption[]) {
    if (this.state()().stackByField !== null) {
      this._renderStackedBarChart(container, config.title, config.data, analysisFieldType, stackByFieldType === 'numeric' ? 'numeric' : 'categorical', dropdownOptions);
    } else {
      this._renderSimpleBarChart(container, config.title, config.data, analysisFieldType);
    }
  }

  private _renderSimpleBarChart(container: HTMLElement, title: string, dataMap: Map<string, number>, analysisFieldType?: AnalysisType) {
    select(container).html('');

    let data = Array.from(dataMap.entries()).map(([key, value]) => ({ key, value }));

    if (analysisFieldType === 'numeric') {
      data.sort((a, b) => Number(b.key) - Number(a.key));
    } else {
      data.sort((a, b) => b.value - a.value);
    }

    data = data.slice(0, 50);

    if (data.length === 0) return;

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b'; // More visible
    const barStep = 25;
    const margin = { top: 5, right: 20, bottom: 60, left: 120 };
    const height = data.length * barStep;
    const width = container.clientWidth - margin.left - margin.right;

    const svg = select(container).append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxValue = max(data, d => d.value) || 0;
    const x = scaleLinear().domain([0, maxValue]).nice().range([0, width]);
    const y = scaleBand().domain(data.map(d => d.key)).range([0, height]).padding(0.2);

    const niceMax = x.domain()[1];
    let tickCount;
    if (niceMax > 1 && niceMax <= 10) {
      tickCount = Math.floor(niceMax);
    } else if (niceMax > 10 && niceMax <= 20) {
      tickCount = 10;
    } else {
      tickCount = Math.max(5, Math.round(width / 75));
    }
    const maxTicksForWidth = Math.floor(width / 40);
    const finalTickCount = Math.min(tickCount, maxTicksForWidth);

    const xAxisGroup = svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x).ticks(finalTickCount));
    xAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');
    xAxisGroup.select('.domain').style('stroke', textColor);
    xAxisGroup.selectAll('.tick line').style('stroke', textColor);

    const yAxisGroup = svg.append('g').call(axisLeft(y).tickSize(0).tickFormat(d => this.truncateText(String(d), 15)));
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');

    // X-axis Title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + 40)
      .style('fill', textColor)
      .style('font-size', 'var(--lt-font-chart-axis-title, 12px)')
      .text('Count');

    // Y-axis Title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 40)
      .attr('x', -height / 2)
      .style('fill', textColor)
      .style('font-size', 'var(--lt-font-chart-axis-title, 12px)')
      .text(title);

    const tooltip = select(this.tooltip()!.nativeElement);

    svg.selectAll('.bar').data(data).enter().append('rect')
      .attr('class', 'bar').attr('x', x(0)).attr('y', d => y(d.key)!)
      .attr('width', d => x(d.value) - x(0)).attr('height', y.bandwidth()).attr('fill', '#3b82f6')
      .on('mouseover', (event, d) => {
        select(event.currentTarget).style('opacity', '0.85');
        tooltip.style('opacity', '1').html(`<strong>${d.key}</strong><br/>Count: ${d.value}`);
      })
      .on('mousemove', (event) => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
      .on('mouseout', (event) => {
        select(event.currentTarget).style('opacity', '1');
        tooltip.style('opacity', '0');
      });
  }

  private _renderStackedBarChart(container: HTMLElement, title: string, dataMap: Map<string, Map<string, number>>, analysisFieldType: AnalysisType | undefined, stackByFieldType: 'numeric' | 'categorical', dropdownOptions?: DropdownOption[]) {
    select(container).html('');
    const stackKeys = Array.from(new Set(Array.from(dataMap.values()).flatMap(innerMap => Array.from(innerMap.keys())))).sort((a, b) => stackByFieldType === 'numeric' ? Number(a) - Number(b) : a.localeCompare(b));

    let data = Array.from(dataMap.entries()).map(([key, innerMap]) => {
      const entry: { [key: string]: any } = { key, total: 0 };
      stackKeys.forEach(stackKey => { entry[stackKey] = innerMap.get(stackKey) || 0; entry.total += entry[stackKey]; });
      return entry;
    });

    if (analysisFieldType === 'numeric') {
      data.sort((a, b) => Number(b.key) - Number(a.key));
    } else {
      data.sort((a, b) => b.total - a.total);
    }

    data = data.slice(0, 50);

    if (data.length === 0) return;
    const series = stack().keys(stackKeys)(data as any);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b'; // More visible
    const barStep = 30;
    const margin = { top: 5, right: 120, bottom: 60, left: 120 };
    const height = data.length * barStep;
    const width = container.clientWidth - margin.left - margin.right;

    const svg = select(container).append('svg').attr('width', width + margin.left + margin.right).attr('height', height + margin.top + margin.bottom).append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxValue = max(data, d => d.total) || 0;
    const x = scaleLinear().domain([0, maxValue]).nice().range([0, width]);
    const y = scaleBand().domain(data.map(d => d.key)).range([0, height]).padding(0.2);

    let color: any;
    if (dropdownOptions) {
      const colorMap = new Map(dropdownOptions.map(opt => [opt.value, opt.color]));
      color = scaleOrdinal(stackKeys.map(key => colorMap.get(key) || '#cccccc')).domain(stackKeys);
    } else if (stackByFieldType === 'numeric') {
      const numericKeys = stackKeys.map(Number);
      color = scaleSequential(interpolatePlasma).domain(extent(numericKeys) as [number, number]);
    } else {
      color = scaleOrdinal(schemeSet2).domain(stackKeys);
    }

    const stackField = this.state()().stackByField;
    const stackLabel = stackField !== null ? this.analysisOptions().find(o => o.value === stackField)?.label : '';

    const niceMax = x.domain()[1];
    let tickCount;
    if (niceMax > 1 && niceMax <= 10) {
      tickCount = Math.floor(niceMax);
    } else if (niceMax > 10 && niceMax <= 20) {
      tickCount = 10;
    } else {
      tickCount = Math.max(5, Math.round(width / 75));
    }
    const maxTicksForWidth = Math.floor(width / 40);
    const finalTickCount = Math.min(tickCount, maxTicksForWidth);

    const xAxisGroup = svg.append('g').attr('transform', `translate(0,${height})`).call(axisBottom(x).ticks(finalTickCount));
    xAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');
    xAxisGroup.select('.domain').style('stroke', textColor);
    xAxisGroup.selectAll('.tick line').style('stroke', textColor);

    const yAxisGroup = svg.append('g').call(axisLeft(y).tickSize(0).tickFormat(d => this.truncateText(String(d), 15)));
    yAxisGroup.select(".domain").remove();
    yAxisGroup.selectAll('text').style('fill', textColor).style('font-size', 'var(--lt-font-chart-axis-label, 10px)');

    // X-axis Title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('x', width / 2)
      .attr('y', height + 40)
      .style('fill', textColor)
      .style('font-size', 'var(--lt-font-chart-axis-title, 12px)')
      .text('Total Count');

    // Y-axis Title
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left + 40)
      .attr('x', -height / 2)
      .style('fill', textColor)
      .style('font-size', 'var(--lt-font-chart-axis-title, 12px)')
      .text(title);

    const tooltip = select(this.tooltip()!.nativeElement);

    svg.append('g').selectAll('g').data(series).join('g')
      .attr('fill', d => (stackByFieldType === 'numeric' && !dropdownOptions) ? (color as any)(Number(String(d.key))) : (color as any)(String(d.key)))
      .selectAll('rect').data(d => d).join('rect')
      .attr('x', d => x(d[0] as any)).attr('y', d => y(String(d.data.key))!).attr('width', d => x(d[1] as any) - x(d[0] as any)).attr('height', y.bandwidth())
      .on('mouseover', (event, d) => {
        select(event.currentTarget).style('opacity', '0.85');
        const seriesKey = (select((event.currentTarget as any).parentNode).datum() as any).key;
        const value = d.data[seriesKey];
        const seriesColor = (stackByFieldType === 'numeric' && !dropdownOptions) ? (color as any)(Number(String(seriesKey))) : (color as any)(String(seriesKey));
        tooltip.style('opacity', '1').html(`<strong>${d.data.key}</strong><br/><span style="color:${seriesColor}">■</span> ${stackLabel}: ${seriesKey}<br/>Count: ${value}<hr class="my-1 border-slate-500">Total: ${d.data.total}`);
      }).on('mousemove', (event) => tooltip.style('left', (event.clientX + 15) + 'px').style('top', (event.clientY + 15) + 'px'))
      .on('mouseout', (event) => {
        select(event.currentTarget).style('opacity', '1');
        tooltip.style('opacity', '0');
      });

    if (stackByFieldType === 'numeric' && !dropdownOptions) {
      this._renderGradientLegend(svg, color, width + 20, 0, 150, "Value");
    } else {
      const legend = svg.selectAll('.legend').data(color.domain()).enter().append('g')
        .attr('class', 'legend')
        .attr('transform', (d, i) => `translate(${width + 20}, ${i * 20})`)
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

      // FIX: The datum `d` from the d3 domain can be inferred as a number, but the ordinal color scale expects a string.
      // Explicitly convert `d` to a string to ensure type compatibility.
      legend.append('rect').attr('width', 18).attr('height', 18).style('fill', (d) => color(String(d)));
      legend.append('text').attr('x', 24).attr('y', 9).attr('dy', '.35em').style('text-anchor', 'start').text((d) => this.truncateText(String(d), 12)).style('fill', textColor).style('font-size', 'var(--lt-font-chart-legend, 12px)');
    }
  }

  private _renderGradientLegend(svg: Selection<SVGGElement, unknown, null, undefined>, colorScale: ScaleSequentialType<string>, legendX: number, legendY: number, height: number, title: string) {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#94a3b8' : '#64748b';
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