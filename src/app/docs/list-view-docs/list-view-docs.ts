import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ListViewComponent, ListViewItem } from '../../user-controls/list-view/list-view';

@Component({
  selector: 'app-list-view-docs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListViewComponent],
  templateUrl: './list-view-docs.html',
  styleUrl: './list-view-docs.scss'
})
export class ListViewDocsComponent {
  protected readonly selected = signal<ListViewItem | null>(null);

  protected readonly users = signal<readonly ListViewItem[]>([
    {
      id: '1',
      title: 'Ana Silva',
      subtitle: 'Product Designer'
    },
    {
      id: '2',
      title: 'James Carter',
      subtitle: 'Frontend Engineer'
    },
    {
      id: '3',
      title: 'Mina Park',
      subtitle: 'QA Analyst'
    },
    {
      id: '4',
      title: 'System Account',
      subtitle: 'Reserved entry',
      disabled: true
    }
  ]);

  protected readonly usageCode = `<uc-list-view
  label="Team members"
  emptyText="No team members found."
  [items]="users()"
  (itemSelected)="onItemSelected($event)"
  (itemsReordered)="onItemsReordered($event)"
/>`;

  protected onItemSelected(item: ListViewItem): void {
    this.selected.set(item);
  }

  protected onItemsReordered(items: readonly ListViewItem[]): void {
    this.users.set(items);
  }
}
