# DynamicTable - Developer Guide

## What Changed

Previously every page had its own hardcoded table with **duplicate code** for:
- DataTable setup, columns, custom styles
- Pagination UI (First / Prev / Next / Last buttons)
- Loading spinner, empty state, error state
- Row selection + bulk action bar

Now all of that is handled by **one reusable component** (`DynamicTable`) and **one hook** (`useTableState`).

### Files

```
src/components/DynamicTable/
  DynamicTable.tsx   ← The reusable table component
  useTableState.ts   ← Hook for pagination, selection, loading state
  types.ts           ← TypeScript interfaces
  index.ts           ← Barrel exports
```

---

## How to Create a New Table Page

### Step 1 - Import

```tsx
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
```

### Step 2 - Define Your Columns

Columns are an array of `TableColumn<YourType>`. Each column needs a `name` and either a `selector` or a `cell` renderer.

```tsx
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

const columns: TableColumn<User>[] = [
  {
    name: "Name",
    selector: (row) => row.name,
    sortable: true,
    grow: 2,
    cell: (row) => (
      <span className="font-medium text-xs">{row.name}</span>
    ),
  },
  {
    name: "Email",
    selector: (row) => row.email,
    cell: (row) => (
      <span className="text-xs text-slate-600">{row.email}</span>
    ),
  },
  {
    name: "Role",
    selector: (row) => row.role,
    width: "100px",
    cell: (row) => (
      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800">
        {row.role}
      </span>
    ),
  },
  {
    name: "Actions",
    cell: (row) => (
      <div className="flex gap-1">
        <button onClick={() => handleEdit(row)}>Edit</button>
        <button onClick={() => handleDelete(row.id)}>Delete</button>
      </div>
    ),
    ignoreRowClick: true,
    width: "120px",
    center: true,
  },
];
```

### Step 3 - Setup Table State

```tsx
const ITEMS_PER_PAGE = 20;

const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });
```

This gives you:

| Property                       | What it does                             |
| ------------------------------ | ---------------------------------------- |
| `table.pagination`             | `{ currentPage, totalPages, totalCount }` |
| `table.isLoading`              | Loading state                            |
| `table.setIsLoading(bool)`     | Set loading                              |
| `table.selectedRows`           | Array of selected row objects            |
| `table.setSelectedRows(rows)`  | Update selection                         |
| `table.toggleCleared`          | Toggles to clear DataTable checkboxes    |
| `table.clearSelection()`       | Clear all selected rows                  |
| `table.searchQuery`            | Current search text                      |
| `table.setSearchQuery(text)`   | Update search (resets to page 1)         |
| `table.updatePaginationFromResponse(count, next, prev, page)` | Update pagination from API response |

### Step 4 - Fetch Data & Update Pagination

```tsx
const fetchData = async (page: number = 1) => {
  table.setIsLoading(true);
  try {
    const data = await getItems(`/api/items/?page=${page}`).unwrap();
    setItems(data.results);
    table.updatePaginationFromResponse(data.count, data.next, data.previous, page);
  } catch (error) {
    console.error(error);
  } finally {
    table.setIsLoading(false);
  }
};
```

### Step 5 - Render DynamicTable

```tsx
<DynamicTable
  data={items}
  columns={columns}
  pagination={table.pagination}
  rowsPerPage={ITEMS_PER_PAGE}
  isLoading={table.isLoading}
  onPageChange={(page) => fetchData(page)}
  itemLabel="users"
  loadingMessage="Loading users..."
  noDataMessage="No users found"
  isFilterApplied={hasActiveFilters}
  onClearFilters={clearFilters}
/>
```

That's it. Pagination, loading, empty state, styles - all handled.

---

## Adding Row Selection + Bulk Actions

```tsx
<DynamicTable
  data={items}
  columns={columns}
  pagination={table.pagination}
  rowsPerPage={ITEMS_PER_PAGE}
  isLoading={table.isLoading}
  onPageChange={(page) => fetchData(page)}
  itemLabel="users"
  selectable                                              // enables checkboxes
  onSelectionChange={(rows) => table.setSelectedRows(rows)} // track selected
  toggleCleared={table.toggleCleared}                      // reset checkboxes
  bulkActionBar={
    table.selectedRows.length > 0 ? (
      <div className="px-4 py-2 border-b bg-blue-50 flex justify-between items-center">
        <span className="text-xs text-blue-700">
          {table.selectedRows.length} selected
        </span>
        <button onClick={handleBulkDelete} className="text-xs bg-red-600 text-white px-2 py-1 rounded">
          Delete Selected
        </button>
      </div>
    ) : undefined
  }
/>
```

---

## Adding Row Click

```tsx
<DynamicTable
  ...
  onRowClick={(row) => navigate(`/admin/user/${row.id}`)}
/>
```

---

## Full Minimal Example

A complete page with search, pagination, delete, and bulk actions:

```tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { DynamicTable, useTableState, TableColumn } from "@/components/DynamicTable";
import { useLazyGetItemsQuery, useDeleteItemMutation } from "@/store";
import { Trash2 } from "lucide-react";

interface Item {
  id: number;
  title: string;
  status: string;
}

const ITEMS_PER_PAGE = 20;

const ItemsPage = () => {
  const table = useTableState({ rowsPerPage: ITEMS_PER_PAGE });
  const [items, setItems] = useState<Item[]>([]);
  const [getItems] = useLazyGetItemsQuery();
  const [deleteItem] = useDeleteItemMutation();

  const fetchItems = useCallback(async (page: number = 1) => {
    table.setIsLoading(true);
    try {
      const data = await getItems(`/api/items/?page=${page}`).unwrap();
      setItems(data.results);
      table.updatePaginationFromResponse(data.count, data.next, data.previous, page);
    } finally {
      table.setIsLoading(false);
    }
  }, [getItems]);

  useEffect(() => { fetchItems(1); }, []);

  const columns: TableColumn<Item>[] = [
    { name: "Title", selector: (row) => row.title, sortable: true, grow: 2 },
    { name: "Status", selector: (row) => row.status, width: "100px" },
    {
      name: "Actions",
      cell: (row) => (
        <button onClick={() => deleteItem(row.id).unwrap().then(() => fetchItems(table.pagination.currentPage))}>
          <Trash2 size={14} />
        </button>
      ),
      width: "80px",
      center: true,
      ignoreRowClick: true,
    },
  ];

  return (
    <DynamicTable
      data={items}
      columns={columns}
      pagination={table.pagination}
      rowsPerPage={ITEMS_PER_PAGE}
      isLoading={table.isLoading}
      onPageChange={(page) => fetchItems(page)}
      itemLabel="items"
    />
  );
};
```

---

## Column Options Reference

| Property        | Type                          | Required | Description                              |
| --------------- | ----------------------------- | -------- | ---------------------------------------- |
| `name`          | `string \| ReactNode`         | Yes      | Column header text                       |
| `selector`      | `string \| (row) => any`      | No       | Field key or accessor function           |
| `cell`          | `(row, index?) => ReactNode`  | No       | Custom cell renderer                     |
| `sortable`      | `boolean`                     | No       | Enable column sorting                    |
| `width`         | `string`                      | No       | Fixed width e.g. `"120px"`               |
| `minWidth`      | `string`                      | No       | Minimum width                            |
| `maxWidth`      | `string`                      | No       | Maximum width                            |
| `grow`          | `number`                      | No       | Flex grow factor                         |
| `wrap`          | `boolean`                     | No       | Allow text wrapping                      |
| `center`        | `boolean`                     | No       | Center align                             |
| `right`         | `boolean`                     | No       | Right align                              |
| `omit`          | `boolean`                     | No       | Hide column                              |
| `ignoreRowClick`| `boolean`                     | No       | Don't trigger `onRowClick` for this cell |

## DynamicTable Props Reference

| Prop              | Type                    | Default          | Description                              |
| ----------------- | ----------------------- | ---------------- | ---------------------------------------- |
| `data`            | `T[]`                   | `[]`             | Row data array                           |
| `columns`         | `TableColumn<T>[]`      | `[]`             | Column definitions                       |
| `pagination`      | `PaginationState`       | -                | From `useTableState().pagination`        |
| `rowsPerPage`     | `number`                | `20`             | Items per page                           |
| `isLoading`       | `boolean`               | `false`          | Show loading spinner                     |
| `error`           | `string \| null`        | `null`           | Show error state                         |
| `onPageChange`    | `(page: number) => void`| -                | Called when user clicks pagination        |
| `showPagination`  | `boolean`               | `true`           | Show/hide pagination controls            |
| `selectable`      | `boolean`               | `false`          | Enable row checkboxes                    |
| `onSelectionChange`| `(rows: T[]) => void`  | -                | Called when selection changes             |
| `toggleCleared`   | `boolean`               | `false`          | Reset selection checkboxes               |
| `onRowClick`      | `(row: T) => void`      | -                | Called when a row is clicked              |
| `itemLabel`       | `string`                | `"items"`        | Label in "Showing X of Y {itemLabel}"    |
| `loadingMessage`  | `string`                | `"Loading data..."`| Spinner text                           |
| `noDataMessage`   | `string`                | `"No data found"`| Empty state heading                      |
| `noDataSubMessage`| `string`                | -                | Empty state description                  |
| `isFilterApplied` | `boolean`               | `false`          | Shows "Clear Filters" in empty state     |
| `onClearFilters`  | `() => void`            | -                | Called when "Clear Filters" clicked       |
| `bulkActionBar`   | `ReactNode`             | -                | JSX shown above table when rows selected |

---

## Rules

1. **Never import `DataTable` directly** - always use `DynamicTable`
2. **Never write custom pagination UI** - `DynamicTable` handles it
3. **Never write custom loading/empty states** - pass `loadingMessage` and `noDataMessage` props
4. **Never copy-paste `customStyles`** - consistent styles are built into `DynamicTable`
5. **Use `useTableState` hook** for pagination, selection, and loading state
6. **Define columns as `TableColumn<T>[]`** for type safety
