import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

export type DataGridCellValue = string | number | boolean | null | undefined;

export interface DataGridColumn {
  key: string;
  header: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export type DataGridRow = Record<string, DataGridCellValue>;

type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'uc-data-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag],
  templateUrl: './data-grid.html',
  styleUrl: './data-grid.scss'
})
export class DataGridComponent {
  readonly columns = input.required<readonly DataGridColumn[]>();
  readonly rows = input.required<readonly DataGridRow[]>();
  readonly rowIdKey = input('id');
  readonly pageSize = input(8);
  readonly emptyText = input('No rows to display.');
  readonly selectable = input(true);
  readonly enableRowDragDrop = input(false);
  readonly enableColumnDragDrop = input(false);

  readonly rowSelected = output<DataGridRow>();
  readonly rowsReordered = output<readonly DataGridRow[]>();
  readonly columnsReordered = output<readonly DataGridColumn[]>();

  private readonly currentPage = signal(1);
  private readonly selectedRowId = signal<string | null>(null);
  private readonly sortState = signal<{ key: string; direction: SortDirection } | null>(null);
  private readonly dataRows = signal<readonly DataGridRow[]>([]);
  private readonly dataColumns = signal<readonly DataGridColumn[]>([]);

  readonly totalRows = computed(() => this.dataRows().length);
  readonly totalPages = computed(() => {
    const size = Math.max(1, this.pageSize());
    return Math.max(1, Math.ceil(this.totalRows() / size));
  });

  readonly canReorderRows = computed(() => this.enableRowDragDrop() && this.sortState() === null);

  readonly displayedColumns = computed(() => this.dataColumns());

  readonly sortedRows = computed(() => {
    const activeSort = this.sortState();
    const source = [...this.dataRows()];

    if (!activeSort) {
      return source;
    }

    const modifier = activeSort.direction === 'asc' ? 1 : -1;

    return source.sort((a, b) => {
      const aValue = this.normalizeValue(a[activeSort.key]);
      const bValue = this.normalizeValue(b[activeSort.key]);

      if (aValue === bValue) {
        return 0;
      }

      return aValue > bValue ? modifier : -modifier;
    });
  });

  readonly visibleRows = computed(() => {
    const page = this.currentPage();
    const size = Math.max(1, this.pageSize());
    const start = (page - 1) * size;
    const end = start + size;

    return this.sortedRows().slice(start, end);
  });

  readonly visibleRange = computed(() => {
    const total = this.totalRows();
    if (total === 0) {
      return { from: 0, to: 0 };
    }

    const size = Math.max(1, this.pageSize());
    const from = (this.currentPage() - 1) * size + 1;
    const to = Math.min(from + size - 1, total);
    return { from, to };
  });

  constructor() {
    effect(() => {
      this.dataRows.set(this.rows());
    });

    effect(() => {
      this.dataColumns.set(this.columns());
    });

    effect(() => {
      this.pageSize();

      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    });
  }

  trackByColumn(_index: number, column: DataGridColumn): string {
    return column.key;
  }

  trackByRow(_index: number, row: DataGridRow): string {
    return this.getRowId(row);
  }

  isSorted(column: DataGridColumn): boolean {
    return this.sortState()?.key === column.key;
  }

  getSortDirection(column: DataGridColumn): SortDirection | null {
    return this.sortState()?.key === column.key ? this.sortState()?.direction ?? null : null;
  }

  toggleSort(column: DataGridColumn): void {
    if (!column.sortable) {
      return;
    }

    const current = this.sortState();
    if (!current || current.key !== column.key) {
      this.sortState.set({ key: column.key, direction: 'asc' });
      this.currentPage.set(1);
      return;
    }

    if (current.direction === 'asc') {
      this.sortState.set({ key: column.key, direction: 'desc' });
      return;
    }

    this.sortState.set(null);
  }

  selectRow(row: DataGridRow): void {
    if (!this.selectable()) {
      return;
    }

    this.selectedRowId.set(this.getRowId(row));
    this.rowSelected.emit(row);
  }

  isRowSelected(row: DataGridRow): boolean {
    return this.selectedRowId() === this.getRowId(row);
  }

  prevPage(): void {
    this.currentPage.update((current) => Math.max(1, current - 1));
  }

  nextPage(): void {
    this.currentPage.update((current) => Math.min(this.totalPages(), current + 1));
  }

  reorderVisibleRows(event: CdkDragDrop<DataGridRow[]>): void {
    if (!this.canReorderRows()) {
      return;
    }

    const pageStart = (this.currentPage() - 1) * Math.max(1, this.pageSize());
    const from = pageStart + event.previousIndex;
    const to = pageStart + event.currentIndex;

    const reordered = [...this.dataRows()];
    moveItemInArray(reordered, from, to);

    this.dataRows.set(reordered);
    this.rowsReordered.emit(reordered);
  }

  reorderColumns(event: CdkDragDrop<DataGridColumn[]>): void {
    if (!this.enableColumnDragDrop()) {
      return;
    }

    const reordered = [...this.dataColumns()];
    moveItemInArray(reordered, event.previousIndex, event.currentIndex);
    this.dataColumns.set(reordered);
    this.columnsReordered.emit(reordered);
  }

  currentPageIndex(): number {
    return this.currentPage();
  }

  private normalizeValue(value: DataGridCellValue): string | number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    return String(value ?? '').toLowerCase();
  }

  private getRowId(row: DataGridRow): string {
    const id = row[this.rowIdKey()];
    return String(id ?? '');
  }
}
