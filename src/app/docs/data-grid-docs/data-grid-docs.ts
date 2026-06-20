import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { DataGridColumn, DataGridComponent, DataGridRow } from '../../user-controls/data-grid/data-grid';

@Component({
  selector: 'app-data-grid-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DataGridComponent],
  templateUrl: './data-grid-docs.html',
  styleUrl: './data-grid-docs.scss'
})
export class DataGridDocsComponent {
  private readonly initialColumns: readonly DataGridColumn[] = [
    { key: 'id', header: 'ID', sortable: true, width: '90px' },
    { key: 'name', header: 'Name', sortable: true },
    { key: 'role', header: 'Role', sortable: true },
    { key: 'team', header: 'Team', sortable: true },
    { key: 'country', header: 'Country', sortable: true },
    { key: 'score', header: 'Score', sortable: true, align: 'right', width: '110px' }
  ];

  private readonly initialRows: readonly DataGridRow[] = [
    { id: 'U-101', name: 'Ana Silva', role: 'Designer', team: 'Core UX', country: 'Portugal', score: 92 },
    { id: 'U-102', name: 'James Carter', role: 'Frontend Engineer', team: 'Web Platform', country: 'USA', score: 88 },
    { id: 'U-103', name: 'Mina Park', role: 'QA Analyst', team: 'Quality', country: 'Korea', score: 84 },
    { id: 'U-104', name: 'Owen Reid', role: 'Product Manager', team: 'Discovery', country: 'UK', score: 91 },
    { id: 'U-105', name: 'Sara Novak', role: 'DevOps Engineer', team: 'Infrastructure', country: 'Croatia', score: 86 },
    { id: 'U-106', name: 'Luca Bianchi', role: 'Fullstack Engineer', team: 'Growth', country: 'Italy', score: 89 },
    { id: 'U-107', name: 'Noah Khan', role: 'UX Researcher', team: 'Core UX', country: 'Canada', score: 87 },
    { id: 'U-108', name: 'Aiko Tanaka', role: 'Data Analyst', team: 'Insights', country: 'Japan', score: 90 },
    { id: 'U-109', name: 'Marta Costa', role: 'Support Lead', team: 'Operations', country: 'Brazil', score: 81 },
    { id: 'U-110', name: 'Diego Luna', role: 'Security Engineer', team: 'Platform', country: 'Spain', score: 93 },
    { id: 'U-111', name: 'Nina Fischer', role: 'Tech Writer', team: 'Developer Experience', country: 'Germany', score: 85 },
    { id: 'U-112', name: 'Ibrahim Noor', role: 'Backend Engineer', team: 'API', country: 'UAE', score: 90 }
  ];

  protected readonly selectedRow = signal<DataGridRow | null>(null);

  protected readonly columns = signal<readonly DataGridColumn[]>(this.initialColumns);

  protected readonly rows = signal<readonly DataGridRow[]>(this.initialRows);

  protected readonly usageCode = `<uc-data-grid
  [columns]="columns()"
  [rows]="rows()"
  rowIdKey="id"
  [enableColumnDragDrop]="true"
  [enableRowDragDrop]="true"
  [pageSize]="6"
  (rowSelected)="onRowSelected($event)"
  (columnsReordered)="onColumnsReordered($event)"
  (rowsReordered)="onRowsReordered($event)"
/>`;

  protected onRowSelected(row: DataGridRow): void {
    this.selectedRow.set(row);
  }

  protected onRowsReordered(rows: readonly DataGridRow[]): void {
    this.rows.set(rows);
  }

  protected onColumnsReordered(columns: readonly DataGridColumn[]): void {
    this.columns.set(columns);
  }

  protected resetLayout(): void {
    this.columns.set(this.initialColumns);
    this.rows.set(this.initialRows);
    this.selectedRow.set(null);
  }
}
