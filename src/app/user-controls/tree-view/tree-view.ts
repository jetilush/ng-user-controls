import { NgTemplateOutlet } from '@angular/common';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';

export interface TreeViewNode {
  id: string;
  label: string;
  children?: readonly TreeViewNode[];
  disabled?: boolean;
  expanded?: boolean;
}

export interface TreeViewCheckState {
  checkedIds: readonly string[];
  indeterminateIds: readonly string[];
}

let treeViewInstanceCounter = 0;

@Component({
  selector: 'uc-tree-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropList, CdkDrag, NgTemplateOutlet],
  templateUrl: './tree-view.html',
  styleUrl: './tree-view.scss',
  host: {
    class: 'uc-tree-view-host'
  }
})
export class TreeViewComponent {
  readonly label = input('Tree view');
  readonly emptyText = input('No nodes to show.');
  readonly checkable = input(true);
  readonly draggable = input(true);
  readonly nodes = input.required<readonly TreeViewNode[]>();

  readonly nodeSelected = output<TreeViewNode>();
  readonly nodesReordered = output<readonly TreeViewNode[]>();
  readonly checkedStateChanged = output<TreeViewCheckState>();
  readonly expandedChanged = output<readonly string[]>();

  private readonly instanceId = `tree-view-${++treeViewInstanceCounter}`;
  readonly rootDropListId = `${this.instanceId}-drop-root`;

  private readonly treeData = signal<TreeViewNode[]>([]);
  private readonly expandedIds = signal<Set<string>>(new Set());
  private readonly checkedIds = signal<Set<string>>(new Set());
  private readonly indeterminateIds = signal<Set<string>>(new Set());
  private readonly selectedId = signal<string | null>(null);

  readonly dropListIds = signal<string[]>([]);

  readonly renderedNodes = computed(() => this.treeData());

  constructor() {
    // Only track nodes() — all other signal reads use untracked() to avoid
    // infinite re-run cycles (reading and writing the same signals in one effect).
    effect(() => {
      const incoming = this.cloneNodes(this.nodes());
      const nodeIds = this.collectAllNodeIds(incoming);

      const expandedFromInput = this.collectExpandedFromInput(incoming);
      const currentExpanded = untracked(() => this.expandedIds());
      const currentChecked = untracked(() => this.checkedIds());
      const currentIndeterminate = untracked(() => this.indeterminateIds());

      const nextExpanded = this.mergeWithExisting(currentExpanded, expandedFromInput, nodeIds);
      const nextChecked = this.intersectSet(currentChecked, nodeIds);
      const nextIndeterminate = this.intersectSet(currentIndeterminate, nodeIds);

      this.treeData.set(incoming);
      this.expandedIds.set(nextExpanded);
      this.checkedIds.set(nextChecked);
      this.indeterminateIds.set(nextIndeterminate);
      // Pass computed values directly so we don't re-read signals (tracked reads)
      this.refreshDropListIds(incoming);
      this.checkedStateChanged.emit({
        checkedIds: [...nextChecked],
        indeterminateIds: [...nextIndeterminate]
      });
      this.expandedChanged.emit([...nextExpanded]);
    });
  }

  dropListId(nodeId: string): string {
    return `${this.instanceId}-drop-${nodeId}`;
  }

  hasChildren(node: TreeViewNode): boolean {
    return (node.children?.length ?? 0) > 0;
  }

  isExpanded(node: TreeViewNode): boolean {
    return this.expandedIds().has(node.id);
  }

  toggleExpanded(node: TreeViewNode): void {
    if (!this.hasChildren(node)) {
      return;
    }

    const next = new Set(this.expandedIds());
    if (next.has(node.id)) {
      next.delete(node.id);
    } else {
      next.add(node.id);
    }

    this.expandedIds.set(next);
    this.emitExpandedState();
  }

  expandAll(): void {
    const ids = this.collectExpandableNodeIds(this.treeData());
    this.expandedIds.set(new Set(ids));
    this.emitExpandedState();
  }

  collapseAll(): void {
    this.expandedIds.set(new Set());
    this.emitExpandedState();
  }

  onNodeClicked(node: TreeViewNode): void {
    if (node.disabled) {
      return;
    }

    this.selectedId.set(node.id);
    this.nodeSelected.emit(node);
  }

  isSelected(node: TreeViewNode): boolean {
    return this.selectedId() === node.id;
  }

  isChecked(node: TreeViewNode): boolean {
    return this.checkedIds().has(node.id);
  }

  isIndeterminate(node: TreeViewNode): boolean {
    return this.indeterminateIds().has(node.id);
  }

  onCheckChanged(node: TreeViewNode, checked: boolean): void {
    if (node.disabled) {
      return;
    }

    const nextChecked = new Set(this.checkedIds());
    const nextIndeterminate = new Set(this.indeterminateIds());
    const subtreeIds = this.collectSubtreeIds(node);

    if (checked) {
      for (const id of subtreeIds) {
        nextChecked.add(id);
        nextIndeterminate.delete(id);
      }
    } else {
      for (const id of subtreeIds) {
        nextChecked.delete(id);
        nextIndeterminate.delete(id);
      }
    }

    const path = this.findPathToNode(this.treeData(), node.id);
    if (path) {
      this.updateAncestors(path, nextChecked, nextIndeterminate);
    }

    this.checkedIds.set(nextChecked);
    this.indeterminateIds.set(nextIndeterminate);
    this.emitCheckedState();
  }

  onNodeDropped(event: CdkDragDrop<TreeViewNode[]>, targetParentId: string | null): void {
    if (!this.draggable()) {
      return;
    }

    const draggedNodeId = event.item.data;
    if (typeof draggedNodeId !== 'string') {
      return;
    }

    if (targetParentId === draggedNodeId) {
      return;
    }

    const currentNodes = this.cloneNodes(this.treeData());
    if (this.isDescendantOf(currentNodes, targetParentId, draggedNodeId)) {
      return;
    }

    const removed = this.removeNodeById(currentNodes, draggedNodeId);
    if (!removed) {
      return;
    }

    let insertIndex = event.currentIndex;
    if (removed.parentId === targetParentId && removed.index < event.currentIndex) {
      insertIndex -= 1;
    }

    this.insertNodeAt(currentNodes, targetParentId, removed.node, insertIndex);

    this.treeData.set(currentNodes);
    this.refreshDropListIds(currentNodes);
    this.nodesReordered.emit(this.cloneNodes(currentNodes));
  }

  private emitCheckedState(): void {
    this.checkedStateChanged.emit({
      checkedIds: [...this.checkedIds()],
      indeterminateIds: [...this.indeterminateIds()]
    });
  }

  private emitExpandedState(): void {
    this.expandedChanged.emit([...this.expandedIds()]);
  }


  private cloneNodes(nodes: readonly TreeViewNode[]): TreeViewNode[] {
    return nodes.map((node) => ({
      ...node,
      children: this.cloneNodes(node.children ?? [])
    }));
  }

  private collectAllNodeIds(nodes: readonly TreeViewNode[]): Set<string> {
    const ids = new Set<string>();
    const walk = (list: readonly TreeViewNode[]) => {
      for (const node of list) {
        ids.add(node.id);
        walk(node.children ?? []);
      }
    };

    walk(nodes);
    return ids;
  }

  private collectExpandedFromInput(nodes: readonly TreeViewNode[]): Set<string> {
    const expanded = new Set<string>();

    const walk = (list: readonly TreeViewNode[]) => {
      for (const node of list) {
        if (node.expanded) {
          expanded.add(node.id);
        }

        walk(node.children ?? []);
      }
    };

    walk(nodes);
    return expanded;
  }

  private mergeWithExisting(current: Set<string>, fallback: Set<string>, validIds: Set<string>): Set<string> {
    const intersection = this.intersectSet(current, validIds);
    if (intersection.size > 0 || current.size > 0) {
      return intersection;
    }

    return this.intersectSet(fallback, validIds);
  }

  private intersectSet(input: Set<string>, allowed: Set<string>): Set<string> {
    const result = new Set<string>();

    for (const id of input) {
      if (allowed.has(id)) {
        result.add(id);
      }
    }

    return result;
  }

  private collectExpandableNodeIds(nodes: readonly TreeViewNode[]): string[] {
    const ids: string[] = [];

    const walk = (list: readonly TreeViewNode[]) => {
      for (const node of list) {
        if ((node.children?.length ?? 0) > 0) {
          ids.push(node.id);
        }

        walk(node.children ?? []);
      }
    };

    walk(nodes);
    return ids;
  }

  private collectSubtreeIds(node: TreeViewNode): string[] {
    const ids: string[] = [node.id];

    for (const child of node.children ?? []) {
      ids.push(...this.collectSubtreeIds(child));
    }

    return ids;
  }

  private findPathToNode(nodes: readonly TreeViewNode[], targetId: string): TreeViewNode[] | null {
    for (const node of nodes) {
      if (node.id === targetId) {
        return [node];
      }

      const childPath = this.findPathToNode(node.children ?? [], targetId);
      if (childPath) {
        return [node, ...childPath];
      }
    }

    return null;
  }

  private updateAncestors(path: TreeViewNode[], checked: Set<string>, indeterminate: Set<string>): void {
    for (let index = path.length - 2; index >= 0; index -= 1) {
      const ancestor = path[index];
      const children = ancestor.children ?? [];
      const childIds = children.map((child) => child.id);

      const allChecked = childIds.every((id) => checked.has(id));
      const noneChecked = childIds.every((id) => !checked.has(id) && !indeterminate.has(id));

      if (allChecked) {
        checked.add(ancestor.id);
        indeterminate.delete(ancestor.id);
      } else if (noneChecked) {
        checked.delete(ancestor.id);
        indeterminate.delete(ancestor.id);
      } else {
        checked.delete(ancestor.id);
        indeterminate.add(ancestor.id);
      }
    }
  }

  private isDescendantOf(nodes: readonly TreeViewNode[], maybeDescendantId: string | null, sourceId: string): boolean {
    if (maybeDescendantId === null) {
      return false;
    }

    const sourceNode = this.findNodeById(nodes, sourceId);
    if (!sourceNode) {
      return false;
    }

    return this.findNodeById(sourceNode.children ?? [], maybeDescendantId) !== null;
  }

  private findNodeById(nodes: readonly TreeViewNode[], id: string): TreeViewNode | null {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }

      const nested = this.findNodeById(node.children ?? [], id);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  private removeNodeById(
    nodes: TreeViewNode[],
    id: string,
    parentId: string | null = null
  ): { node: TreeViewNode; index: number; parentId: string | null } | null {
    const index = nodes.findIndex((node) => node.id === id);
    if (index >= 0) {
      const [removed] = nodes.splice(index, 1);
      return {
        node: removed,
        index,
        parentId
      };
    }

    for (const node of nodes) {
      const children = [...(node.children ?? [])];
      const removed = this.removeNodeById(children, id, node.id);
      if (removed) {
        node.children = children;
        return removed;
      }
    }

    return null;
  }

  private insertNodeAt(nodes: TreeViewNode[], parentId: string | null, node: TreeViewNode, index: number): void {
    if (parentId === null) {
      const safeIndex = Math.max(0, Math.min(index, nodes.length));
      nodes.splice(safeIndex, 0, node);
      return;
    }

    const parent = this.findNodeById(nodes, parentId);
    if (!parent) {
      nodes.push(node);
      return;
    }

    const children = [...(parent.children ?? [])];
    const safeIndex = Math.max(0, Math.min(index, children.length));
    children.splice(safeIndex, 0, node);
    parent.children = children;
  }

  private refreshDropListIds(nodes: readonly TreeViewNode[]): void {
    const ids = [this.rootDropListId];

    const walk = (list: readonly TreeViewNode[]) => {
      for (const node of list) {
        ids.push(this.dropListId(node.id));
        walk(node.children ?? []);
      }
    };

    walk(nodes);
    this.dropListIds.set(ids);
  }
}
