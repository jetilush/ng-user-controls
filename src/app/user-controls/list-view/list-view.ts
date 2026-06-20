import { CdkDragDrop, CdkDrag, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';

export interface ListViewItem {
  id: string;
  title: string;
  subtitle?: string;
  disabled?: boolean;
}

@Component({
  selector: 'uc-list-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag],
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
  readonly itemsReordered = output<readonly ListViewItem[]>();
  private readonly selectedId = signal<string | null>(null);
  private readonly viewItems = signal<readonly ListViewItem[]>([]);

  constructor() {
    effect(() => {
      this.viewItems.set(this.items());
    });
  }

  readonly selectedItem = computed(() => {
    const current = this.selectedId();
    if (current === null) {
      return null;
    }

    return this.viewItems().find((item) => item.id === current) ?? null;
  });

  renderedItems(): readonly ListViewItem[] {
    return this.viewItems();
  }

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

  reorderItems(event: CdkDragDrop<readonly ListViewItem[]>): void {
    const list = [...this.viewItems()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.viewItems.set(list);
    this.itemsReordered.emit(list);
  }
}