

# Sales Grid UX Improvements

## Issues Identified

1. **Body cell colors not applying** — The `bodyColorClass` is applied via Tailwind class names but gets overridden by other conditions (e.g., `answerColor` takes priority, and when no answer color exists, the `text-muted-foreground` class still applies). Some colors fail because the Tailwind classes aren't being generated (purged at build time since they're constructed dynamically).
2. **Formula bar Enter key deletes row** — When pressing Enter in the formula bar input, the keyboard handler fires `setEditingCell(cc)` which re-enters edit mode on the cell, then the global handler interprets Enter as navigation, moving the cursor down. The formula bar's `onKeyDown` does prevent default but the global handler may still interfere.
3. **Bold/Italic in wrong location** — Currently in column 3-dot menu, user wants them in the formula bar area.
4. **No row-level coloring** — User wants horizontal coloring per company group.

## Plan

### 1. Fix body cell colors — use inline styles instead of Tailwind classes
Replace dynamic Tailwind class approach with inline `style={{ backgroundColor }}` using actual hex values. This guarantees colors render regardless of Tailwind purging.

**Color palette (reduced to 6):**
- Default (no color), Blue, Red, Green, Orange, Purple, Teal

Define as hex values:
```
{ id: 'blue', header: '#2563eb', body: '#eff6ff' }
{ id: 'red', header: '#dc2626', body: '#fef2f2' }
{ id: 'green', header: '#16a34a', body: '#f0fdf4' }
{ id: 'orange', header: '#ea580c', body: '#fff7ed' }
{ id: 'purple', header: '#9333ea', body: '#faf5ff' }
{ id: 'teal', header: '#0d9488', body: '#f0fdfa' }
```

Apply via `style` prop on both `<th>` and `<td>` elements.

### 2. Add row-level coloring with 3-dot menu on first column
- Add a `rowStyles` state: `Record<string, { color?: string }>` persisted to localStorage (`sales-row-styles`).
- In the first `<td>` (the action column with copy icon), add a 3-dot `MoreVertical` icon that appears on hover.
- The dropdown shows the same 6 color swatches for applying a background tint to the entire row.
- Row color applies as a light background on all cells in that row (unless overridden by column color or answer color).

### 3. Move Bold/Italic to formula bar
- Remove Bold and Italic options from the column 3-dot dropdown menu.
- Add Bold (B) and Italic (I) toggle buttons in the formula bar, next to the field label.
- These still control column-level formatting (`columnStyles[field].bold/italic`).

### 4. Fix formula bar editing
- The formula bar input currently uses `value={rawVal}` as a controlled input with `onChange` calling `updateCell` on every keystroke — this works but Enter triggers the global keyboard handler.
- Fix: Add `e.stopPropagation()` in the formula bar's `onKeyDown` to prevent the global handler from intercepting Enter/Escape.
- Ensure the formula bar input doesn't blur on Enter (just commits and moves cursor down like a normal cell edit).

### 5. Clean up column 3-dot menu
After removing bold/italic, the menu will contain:
- Rename
- Hide
- Separator
- Color palette (6 swatches)

### Files Modified
- `src/pages/Sales.tsx` — All changes in this single file

### Suggested Features (post-implementation)
- Freeze first N columns (company/position) so they stay visible while scrolling horizontally
- Row grouping by company with collapsible sections
- Filter/sort by any column
- Row reordering via drag-and-drop
- Cell-level comments/notes

