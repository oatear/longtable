## Data Models

The spreadsheet component is driven by two primary data structures: `Cell` and `ColumnConfig`.

### The `Cell` Interface

The `Cell` object defines the content and behavior of a single cell in the grid. The `data` input for the spreadsheet should be a 2D array of these objects (`Cell[][]`).

```typescript
interface Cell {
  value: string | number | boolean;
  readOnly?: boolean;
}
```

- **`value`**: The raw data for the cell.
- **`readOnly`**: If `true`, the cell cannot be edited. This overrides the column-level setting.

### The `ColumnConfig` Interface

The `ColumnConfig` object defines metadata for an entire column, corresponding by index to the `data` array.

```typescript
interface ColumnConfig {
  name: string;
  field: string;
  readOnly?: boolean;
  width?: number | 'auto';
  description?: string;
  editor?: 'text' | 'dropdown' | 'checkbox' | 'numeric';
  options?: (string | DropdownOption)[];
  lockSettings?: boolean;
}

interface DropdownOption {
  value: string;
  color: string; // Hex color string, e.g., '#bae6fd'
}
```

- **`name`**: **Required**. The text displayed in the column header.
- **`field`**: **Required**. A unique, kebab-case identifier for the column.
- **`readOnly`**: If `true`, all cells in this column are read-only.
- **`width`**: The width of the column in pixels.
- **`description`**: An optional description for the column, visible on hover.
- **`editor`**: Specifies the type of editor to use for all cells in the column. Defaults to `'text'`.
- **`options`**: An array of options for the `'dropdown'` editor. Can be simple strings or `DropdownOption` objects for colored labels.
- **`lockSettings`**: If `true`, the column settings (name, description, type, options) cannot be edited via the column settings dialog. The column width can still be changed.