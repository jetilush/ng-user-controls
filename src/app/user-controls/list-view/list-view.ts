import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface ListViewItem {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

@Component({
  selector: 'uc-list-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './list-view.html',
  styleUrl: './list-view.scss',
  host: {
    class: 'uc-list-view-host'
  }
})
export class ListViewComponent {
  readonly label = input('List items');
  readonly emptyText = input('No items to show.');
  readonly items = input.required<readonly ListViewItem[]>();

  readonly itemSelected = output<ListViewItem>();
  private readonly selectedId = signal<string | null>(null);

  readonly selectedItem = computed(() => {
    const current = this.selectedId();
    if (current === null) {
      return null;
    }

    return this.items().find((item) => item.id === current) ?? null;
  });

  isSelected(item: ListViewItem): boolean {
    return this.selectedId() === item.id;
  }

  selectItem(item: ListViewItem): void {
    if (item.disabled) {
      return;
    }

    this.selectedId.set(item.id);
    this.itemSelected.emit(item);
  }
}