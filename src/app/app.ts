import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ListViewComponent, ListViewItem } from './user-controls/list-view/list-view';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListViewComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
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

  protected onItemSelected(item: ListViewItem): void {
    this.selected.set(item);
  }

  protected onItemsReordered(items: readonly ListViewItem[]): void {
    this.users.set(items);
  }
}
