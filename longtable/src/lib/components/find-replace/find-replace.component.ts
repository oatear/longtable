import { ChangeDetectionStrategy, Component, input, output, signal, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'long-find-replace',
  templateUrl: './find-replace.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FindReplaceComponent {
  isVisible = input.required<boolean>();
  container = input<HTMLElement | null>(null);
  
  close = output<void>();
  // In a full implementation, this component would emit events
  // for find, replace, etc., and the parent would handle the logic.
  // For now, we'll keep it simple as a UI shell.

  private panel = viewChild<ElementRef<HTMLDivElement>>('panel');

  findQuery = signal('');
  replaceQuery = signal('');
  findOptions = signal({ matchCase: false, matchEntireCell: false });
  findResultsCount = signal(0);
  currentFindIndex = signal(-1);

  // Dragging state
  isDragging = signal(false);
  position = signal({ x: 0, y: 0 });
  private dragStart = signal<{ panelX: number, panelY: number, mouseX: number, mouseY: number} | null>(null);

  onDragStart(event: MouseEvent): void {
    event.preventDefault();
    
    const panelEl = this.panel()?.nativeElement;
    const containerEl = this.container();
    if (!panelEl || !containerEl) return; // Cannot drag if elements aren't available

    this.isDragging.set(true);

    const panelRect = panelEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const currentPos = this.position();

    this.dragStart.set({
        panelX: currentPos.x,
        panelY: currentPos.y,
        mouseX: event.clientX,
        mouseY: event.clientY,
    });
    
    const onMouseMove = (moveEvent: MouseEvent) => {
      const start = this.dragStart();
      if (!start) return;
      
      const deltaX = moveEvent.clientX - start.mouseX;
      const deltaY = moveEvent.clientY - start.mouseY;

      // The panel's desired absolute position
      const newPanelLeft = panelRect.left + deltaX;
      const newPanelTop = panelRect.top + deltaY;
      
      // Boundaries
      const minLeft = containerRect.left;
      const maxLeft = containerRect.right - panelRect.width;
      const minTop = containerRect.top;
      const maxTop = containerRect.bottom - panelRect.height;
      
      // Clamped absolute position
      const finalPanelLeft = Math.max(minLeft, Math.min(newPanelLeft, maxLeft));
      const finalPanelTop = Math.max(minTop, Math.min(newPanelTop, maxTop));
      
      // Calculate the final delta from the panel's starting rect position
      const finalDeltaX = finalPanelLeft - panelRect.left;
      const finalDeltaY = finalPanelTop - panelRect.top;

      // Apply this final delta to the transform value that was present at the start of the drag
      this.position.set({ x: start.panelX + finalDeltaX, y: start.panelY + finalDeltaY });
    };

    const onMouseUp = () => {
      this.isDragging.set(false);
      this.dragStart.set(null);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }
}