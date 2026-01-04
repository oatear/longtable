## Theming

The spreadsheet component can be styled by passing a `SpreadsheetTheme` object to the `[theme]` input. The library exports three pre-built themes: `longLight`, `longDark`, and `cosmicDark`.

### Using a Theme

1.  **Import a theme** from `src/longtable/theme`.
2.  **Bind it to the component**:

```typescript
// app.component.ts
import { longDark } from './longtable/theme';

@Component({ /* ... */ })
export class AppComponent {
  darkTheme = longDark;
  // ...
}
```

```html
<!-- app.component.html -->
<long-spreadsheet [theme]="darkTheme"></long-spreadsheet>
```

### Theme Structure

A theme is an object that defines a set of CSS variables used by the component. You can create your own theme by providing an object that matches the `SpreadsheetTheme` interface.

```typescript
export interface SpreadsheetTheme {
  name: string;
  colorScheme?: 'light' | 'dark';
  colors: {
    bgPrimary: string;
    bgHeader: string;
    textPrimary: string;
    borderGrid: string;
    // ... and many more color properties
  };
  scrollbar?: { /* ... */ };
  fontFamily?: { /* ... */ };
  fontSizes?: { /* ... */ };
}
```
For a complete list of theme properties, see the `SpreadsheetTheme` interface definition in `src/longtable/models/spreadsheet.model.ts`.
