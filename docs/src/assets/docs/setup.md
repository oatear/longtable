## Setup & Usage

As this is a local library within the project, no separate installation is needed. Simply import the necessary components and models from the `src/longtable` directory.

### 1. Import the Component

In your component file, import `SpreadsheetComponent` and the required data models.

```typescript
import { SpreadsheetComponent, Cell, ColumnConfig } from './longtable';
```

### 2. Add to Template

To use the Longtable spreadsheet, you need to provide two main inputs: `data` and `columnConfig`, both as Angular `WritableSignal`s.

```html
<long-spreadsheet 
  [data]="initialData" 
  [columnConfig]="columnConfig">
</long-spreadsheet>
```

### 3. Provide Data

Here is a minimal example of how to set up the data signals in your component's TypeScript file.

```typescript
import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpreadsheetComponent, Cell, ColumnConfig } from './longtable';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SpreadsheetComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {

  // The core data for the spreadsheet grid. Does not include headers.
  initialData: WritableSignal<Cell[][]> = signal([
    [{ value: 'Jane Doe' }, { value: 'Developer' }, { value: true }],
    [{ value: 'John Smith' }, { value: 'Designer' }, { value: false }],
  ]);

  // Configuration for each column, including header names.
  columnConfig: WritableSignal<ColumnConfig[]> = signal([
    { name: 'Name', field: 'name', width: 200 },
    { name: 'Role', field: 'role', width: 150 },
    { name: 'Active', field: 'active', width: 80, editor: 'checkbox' },
  ]);
}
```

### 4. Handling Outputs

The spreadsheet component emits events when its internal data or column configuration changes. You can listen for these events to react to user actions.

-   `onDataChange`: Emits the entire `Cell[][]` array whenever the data is modified.
-   `onColumnChange`: Emits the entire `ColumnConfig[]` array whenever a column's properties (like width, name, or type) are changed.

Here is how you can listen to these events:

**Template (`app.component.html`)**

```html
<long-spreadsheet 
  [data]="initialData" 
  [columnConfig]="columnConfig"
  (onDataChange)="onDataChanged($event)"
  (onColumnChange)="onColumnConfigChanged($event)">
</long-spreadsheet>
```

**Component Class (`app.component.ts`)**

```typescript
export class AppComponent {
  // ... existing signals and properties

  onDataChanged(data: Cell[][]) {
    // This method is called whenever data in the spreadsheet changes.
    // You could, for example, save the new data to a backend service.
    console.log('Spreadsheet data has been updated:', data);
  }

  onColumnConfigChanged(config: ColumnConfig[]) {
    // This method is called when a column is resized, renamed, etc.
    // You could save the user's layout preferences.
    console.log('Column configuration has been updated:', config);
  }
}
```