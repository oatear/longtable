<div align="center">
<img src="docs/src/assets/longtable-logo.png" width="128" alt="Oatear Longtable Logo">

# Oatear Longtable

### A feature-rich spreadsheet component built for Angular

[**Live Demo / Documentation**](https://oatear.github.io/longtable/)

Longtable is a feature-rich, standalone spreadsheet component built for modern, zoneless Angular applications. It provides a powerful and familiar spreadsheet experience with a simple and declarative API.

This library was designed to be highly interactive and performant, leveraging Angular signals for state management.

[![][license]][license-url] 
[![][stars]][gh-url]
[![][release]][releases-url]
[![][downloads]][releases-url]
[![][last-commit]][gh-url]
[![][website]][pages-url]
[![][discord]][discord-url]

</div>

---

## Features

- **Rich Data Editing**: Double-click or type to edit cells.
- **Data Types**: Support for text, numeric, checkbox, and dropdown cells.
- **Multi-Select**: Click and drag to select ranges of cells.
- **Copy & Paste**: Seamlessly copy/paste data to and from external applications like Excel or Google Sheets.
- **Drag-to-Fill**: Easily fill data down or across a range.
- **Column Operations**: Resize, reorder, and configure columns.
- **Row Operations**: Insert and delete single or multiple rows.
- **Undo/Redo**: Full history tracking for data changes.
- **Sorting & Filtering**: Built-in UI for sorting and filtering columns.
- **Context Menu**: Intuitive right-click menu for common actions.
- **Data Analysis**: An integrated statistics modal for data distribution and correlation analysis.
- **Theming**: Includes light and dark mode support.

## Installation

Since this library is not yet published to the npm registry, you must build it locally and install it as a file dependency.

### Method 1: Install via Tarball (Recommended)
This method "packages" the library with your project, ensuring stability.

1.  **Clone and Build**:
    ```bash
    git clone https://github.com/oatear/longtable.git
    cd longtable
    npm install
    npm run build:lib
    ```

2.  **Create Package**:
    ```bash
    cd dist/longtable
    npm pack
    ```
    This creates a file like `oatear-longtable-1.0.0.tgz`.

3.  **Install in Your Project**:
    Move the `.tgz` file to your project (e.g., into a `libs/` folder) and install it:
    ```bash
    npm install ./libs/oatear-longtable-1.0.0.tgz
    ```

### Method 2: Install via Local Path
Useful if you want to keep the library source separate on your machine.
```bash
npm install /path/to/longtable/dist/longtable
```

### Method 3: npm link (Active Development)
Use this if you are actively modifying the library and want changes to reflect immediately in your app.

1.  **Link Library**:
    ```bash
    cd dist/longtable
    npm link
    ```

2.  **Link in App**:
    ```bash
    cd my-app
    npm link oatear-longtable
    ```

## Setup
 
 After installing the library, you need to configure your project to support the library's styling and icons.
 
 ### 1. Install Dependencies
 
 Ensure you have Tailwind CSS and PrimeIcons installed:
 
 ```bash
 npm install tailwindcss primeicons
 ```
 
 ### 2. Configure Tailwind CSS
 
 Update your `tailwind.config.js` to include the library's files in the `content` array. This ensures that the Tailwind utility classes used by the library are generated.
 
 ```javascript
 /** @type {import('tailwindcss').Config} */
 module.exports = {
   content: [
     "./src/**/*.{html,ts}",
     "./node_modules/oatear-longtable/**/*.{html,ts,mjs}" // Add this line
   ],
   theme: {
     extend: {},
   },
   plugins: [],
 }
 ```
 
 ### 3. Import Styles
 
 You have two options for importing styles:
 
 **Option A: Use Prebuilt Styles (Recommended)**
 
 Import the prebuilt CSS file which includes all necessary Tailwind utilities and PrimeIcons. This is the easiest way to get started.
 
 ```css
 @import 'oatear-longtable/prebuilt-styles.css';
 ```
 
 **Option B: Manual Configuration**
 
 If you prefer to integrate the library's styles into your own Tailwind build (e.g., for customization), use the following setup:
 
 1.  **Configure Tailwind**: Update `tailwind.config.js` to include the library's files:
     ```javascript
     module.exports = {
       content: [
         "./src/**/*.{html,ts}",
         "./node_modules/oatear-longtable/**/*.{html,ts,mjs}"
       ],
       // ...
     }
     ```
 
 2.  **Import Directives**: In your global styles file:
     ```css
     @import 'primeicons/primeicons.css';
     @tailwind base;
     @tailwind components;
     @tailwind utilities;
     ```
 
 ## Basic Usage

To use the Longtable spreadsheet, you need to provide two main inputs: `data` and `columnConfig`, both as Angular `WritableSignal`s. You can also listen for changes using the `onDataChange` and `onColumnChange` outputs.

### `app.component.ts`

```typescript
import { Component, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SpreadsheetComponent, Cell, ColumnConfig } from './longtable';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, SpreadsheetComponent],
  template: `
    <main class="p-4">
      <h1 class="text-2xl font-bold mb-4">My Longtable Spreadsheet</h1>
      <long-spreadsheet 
        [data]="initialData" 
        [columnConfig]="columnConfig"
        (onDataChange)="onDataChanged($event)"
        (onColumnChange)="onColumnConfigChanged($event)">
      </long-spreadsheet>
    </main>
  `,
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

  onDataChanged(data: Cell[][]) {
    console.log('Spreadsheet data has changed:', data);
  }

  onColumnConfigChanged(config: ColumnConfig[]) {
    console.log('Column configuration has changed:', config);
  }
}
```

## API

### Inputs

| Input          | Type                                | Description                                                                                                                              |
| -------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `data`         | `WritableSignal<Cell[][]>`         | **Required**. The 2D array of `Cell` objects that represents the spreadsheet grid's data rows.                                             |
| `columnConfig` | `WritableSignal<ColumnConfig[]>` | **Required**. An array of configuration objects, one for each column, controlling properties like headers, width, and cell editors. |
| `height`       | `string \| number`               | Optional. Sets the height of the spreadsheet container. Supports `'auto'` (height of content), `'100%'`/`'full'` (fill parent), or specific pixel values (number or string like `'500px'`). Defaults to `'60vh'`. |

### Outputs

| Output           | Payload Type        | Description                                                          |
| ---------------- | ------------------- | -------------------------------------------------------------------- |
| `onDataChange`   | `Cell[][]`          | Emits the entire data grid whenever a change to the data occurs.     |
| `onColumnChange` | `ColumnConfig[]`    | Emits the entire column configuration whenever it is changed. |

## Data Models

### `Cell` Interface

The `Cell` object defines the content and behavior of a single cell.

```typescript
interface Cell {
  value: string | number | boolean;
  readOnly?: boolean;
}
```

### `ColumnConfig` Interface

The `ColumnConfig` object defines metadata for an entire column.

```typescript
interface ColumnConfig {
  name: string;
  field: string;
  readOnly?: boolean;
  width?: number | 'auto';
  description?: string;
  editor?: 'text' | 'dropdown' | 'checkbox' | 'numeric';
  options?: (string | DropdownOption)[];
}

interface DropdownOption {
  value: string;
  color: string; // Hex color string
}
```

## Development

This project involves two main parts:
- `longtable`: The Angular library.
- `docs`: The demonstration and documentation application.

### Library

To build the library:
```bash
npm run build:lib
```
Artifacts will be generated in `dist/longtable`.

### Documentation / Demo

To run the documentation site locally:
```bash
npm run start
```
This serves the application at `http://localhost:4200/`.

To build the documentation site:
```bash
npm run build:demo
```
Artifacts will be generated in `dist/docs`.

<!-- BADGE & IMAGE DEFINITIONS -->
[last-commit]: https://img.shields.io/github/last-commit/oatear/longtable
[license]: https://badgen.net/github/license/oatear/longtable?cache=600
[stars]: https://img.shields.io/github/stars/oatear/longtable
[release]: https://img.shields.io/github/v/release/oatear/longtable
[discord]: https://img.shields.io/discord/1129380421642240133?logo=discord&label=discord&color=%23515fe4&link=https%3A%2F%2Fdiscord.gg%2FS66xw9Wc9V
[downloads]: https://img.shields.io/github/downloads/oatear/longtable/total
[website]: https://img.shields.io/website?down_color=red&down_message=offline&up_color=green&up_message=online&url=https%3A%2F%2Foatear.github.io%2Flongtable

<!-- URL DEFINITIONS -->
[gh-url]: https://github.com/oatear/longtable
[releases-url]: https://github.com/oatear/longtable/releases
[license-url]: LICENSE.md
[pages-url]: https://oatear.github.io/longtable
[discord-url]: https://discord.gg/S66xw9Wc9V
[kofi-url]: https://ko-fi.com/oatear