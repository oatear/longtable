import { ChangeDetectionStrategy, Component, signal, inject, Renderer2, computed, effect, OnInit } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { SpreadsheetComponent } from '@longtable/angular-spreadsheet';
import { Cell, ColumnConfig, DropdownOption, SpreadsheetTheme } from '@longtable/angular-spreadsheet';
import { longLight, longDark, cosmicDark, goldDust } from '@longtable/angular-spreadsheet';
import { SafeHtmlPipe } from './safe-html.pipe';

import { marked } from 'marked';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpreadsheetComponent, SafeHtmlPipe],
})
export class AppComponent implements OnInit {
  title = 'Longtable - Documentation';

  docs = signal({
    introduction: '',
    features: '',
    liveDemo: '',
    setup: '',
    dataModels: '',
    theming: '',
  });

  isLoading = signal(false);

  toggleLoading() {
    this.isLoading.update(v => !v);
  }

  private classOptions: DropdownOption[] = [
    { value: 'Warrior', color: '#fca5a5' }, // red-300
    { value: 'Mage', color: '#93c5fd' },    // blue-300
    { value: 'Rogue', color: '#94a3b8' },    // slate-400
    { value: 'Cleric', color: '#fcd34d' },   // amber-300
  ];

  private allegianceOptions: DropdownOption[] = [
    { value: 'Kingdom of Light', color: '#67e8f9' }, // cyan-300
    { value: 'Shadow Syndicate', color: '#d8b4fe' }, // purple-300
    { value: 'Neutral Guilds', color: '#86efac' },   // green-300
    { value: 'Unaffiliated', color: '#d1d5db' },    // gray-300
  ];

  initialData = signal<Cell[][]>(this.generateInitialData(24, 7));

  columnConfig = signal<ColumnConfig[]>(
    [
      { name: 'Character Name', field: 'character-name', width: 200, description: "The full name of the adventurer." },
      { name: 'Class', field: 'class', width: 120, description: "The character's primary specialization or archetype.", editor: 'dropdown', options: this.classOptions },
      { name: 'Level', field: 'level', width: 80, description: "The character's current experience level.", editor: 'numeric' },
      { name: 'HP', field: 'hp', width: 80, description: "Hit Points, representing the character's health.", editor: 'numeric' },
      { name: 'Allegiance', field: 'allegiance', width: 180, description: "The faction or group the character is aligned with.", editor: 'dropdown', options: this.allegianceOptions },
      { name: 'Has Familiar', field: 'has-familiar', width: 120, description: "Indicates if the character is accompanied by a magical companion.", editor: 'checkbox' },
      { name: 'Count', field: 'count', width: 80, description: "Multiplier for statistics.", editor: 'numeric', lockSettings: true }
    ]
  );

  selectedSpreadsheetThemeName = signal<'light' | 'dark' | 'cosmic-dark' | 'gold-dust'>('dark');

  spreadsheetTheme = computed<SpreadsheetTheme>(() => {
    switch (this.selectedSpreadsheetThemeName()) {
      case 'light': return longLight;
      case 'dark': return longDark;
      case 'cosmic-dark': return cosmicDark;
      case 'gold-dust': return goldDust;
      default: return longDark;
    }
  });

  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      this.selectedSpreadsheetThemeName.set('dark');
    }

    effect(() => {
      const themeName = this.selectedSpreadsheetThemeName();
      if (themeName === 'dark' || themeName === 'cosmic-dark' || themeName === 'gold-dust') {
        this.renderer.addClass(this.document.documentElement, 'dark');
      } else {
        this.renderer.removeClass(this.document.documentElement, 'dark');
      }
    });
  }

  ngOnInit() {
    this.loadDocs();
  }

  async loadDocs() {
    // if (typeof marked === 'undefined') {
    //   console.error('Marked library not loaded.');
    //   return;
    // }

    const docFiles = {
      introduction: 'docs/introduction.md',
      features: 'docs/features.md',
      setup: 'docs/setup.md',
      dataModels: 'docs/data-models.md',
      theming: 'docs/theming.md',
    };

    const parsedDocs = await Promise.all(
      Object.entries(docFiles).map(async ([key, path]) => {
        const markdown = await fetch(path).then(res => res.text());
        return [key, marked.parse(markdown)];
      })
    );

    this.docs.set(Object.fromEntries(parsedDocs));
  }

  onThemeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as 'light' | 'dark' | 'cosmic-dark' | 'gold-dust';
    this.selectedSpreadsheetThemeName.set(value);
  }

  onDataChanged(data: Cell[][]) {
    console.log('Spreadsheet data changed:', data);
  }

  onColumnConfigChanged(config: ColumnConfig[]) {
    console.log('Spreadsheet column config changed:', config);
  }

  private generateInitialData(rows: number, cols: number): Cell[][] {
    const data: Cell[][] = [];

    const sampleNames = [
      'Aelar Swiftwind', 'Brenna Ironhand', 'Caelan Nightshade', 'Darian Sunfire', 'Elara Moonglade',
      'Finnian Stoutheart', 'Gwendolyn Silverbow', 'Hadrian Stormcaller', 'Isolde Whisperwind', 'Joric Stonefist',
      'Kaelen Shadowhand', 'Lyra Starfall', 'Morwen Darkwater', 'Niall Riverbend', 'Orin Blackwood',
      'Perrin Greenleaf', 'Quintus Valerius', 'Rhiannon Frostbloom', 'Seraphina Brightwood', 'Taran Oakenshield',
      'Grommash Hellscream', 'Hestia Moonshadow', 'Ingrid Frostbite', 'Jasper Thunderheart', 'Kira Sunbeam',
      'Liam Frostbite', 'Morgan Thunderheart', 'Natalie Sunbeam', 'Oliver Frostbite', 'Piper Thunderheart',
      'Quinn Sunbeam', 'Rebekah Frostbite', 'Sebastian Thunderheart', 'Talia Sunbeam', 'Uriah Frostbite',
      'Valentina Thunderheart', 'Wyatt Sunbeam', 'Xander Frostbite', 'Yara Thunderheart', 'Zachary Sunbeam',
    ];

    for (let i = 0; i < rows; i++) {
      const row: Cell[] = [];
      const classOption = this.classOptions[i % this.classOptions.length];
      const allegianceOption = this.allegianceOptions[i % this.allegianceOptions.length];

      row.push({ value: sampleNames[i] ?? `Character ${i + 1}` });
      row.push({ value: classOption.value });
      row.push({ value: Math.floor(Math.random() * 10) + 1 });
      row.push({ value: (Math.floor(Math.random() * 80) + 50) });
      row.push({ value: allegianceOption.value });
      row.push({ value: i % 3 === 0 });
      row.push({ value: Math.floor(Math.random() * 3) + 1 });

      data.push(row);
    }
    return data;
  }
}