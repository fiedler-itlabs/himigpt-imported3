import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { TableRow, TableCell } from "@/components/ui/table";
import { ReactNode } from "react";

type Props = {
  contractId: number;
  isParent: boolean;
  canBeDropTarget: boolean;
  children: ReactNode;
  onDrop?: (draggedId: number, targetId: number) => void;
};

export function DraggableContractRow({
  contractId,
  isParent,
  canBeDropTarget,
  children,
}: Props) {
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `contract-${contractId}`,
    data: { contractId },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${contractId}`,
    disabled: !canBeDropTarget,
    data: { contractId },
  });

  return (
    <TableRow
      ref={(node) => {
        setDragRef(node);
        if (canBeDropTarget) setDropRef(node);
      }}
      className={`
        ${isDragging ? "opacity-50" : ""}
        ${isOver && canBeDropTarget ? "bg-blue-50 dark:bg-blue-950" : ""}
        transition-colors
      `}
    >
      <TableCell className="w-8">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
        >
          <GripVertical className="h-4 w-4 text-gray-400" />
        </div>
      </TableCell>
      {children}
    </TableRow>
  );
}
