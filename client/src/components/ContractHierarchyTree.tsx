import { useState } from "react";
import { DndContext, DragEndEvent, closestCenter, useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  History,
} from "lucide-react";

type Contract = {
  id: number;
  name: string;
  insuranceCompany: string | null;
  productArea: string | null;
  validFrom: Date | null;
  contactPerson: string | null;
  totalPages: number | null;
  status: "pending" | "processing" | "ready" | "error";
  createdAt: Date;
  pdfUrl: string | null;
  parentContractId: number | null;
  contractType: "main" | "extension" | "pricelist" | "productgroup" | "regional";
  productGroups: string | null;
  displayOrder: number;
  customData?: Record<number, string | null>;
};

type CustomColumn = {
  id: number;
  name: string;
  description: string;
  dataType: "text" | "number" | "date";
};

type ContractNode = {
  contract: Contract;
  children: ContractNode[];
};

type Props = {
  contracts: Contract[];
  customColumns: CustomColumn[];
  selectedContractsForComparison: number[];
  onToggleSelection: (contractId: number) => void;
  onOpenPdf: (pdfUrl: string, page: number) => void;
  onGenerateSummary: (contract: { id: number; name: string }) => void;
  onReprocess: (contractId: number) => void;
  onDelete: (contractId: number) => void;
  onSummaryClick: (summaryId: number) => void;
  onUpdateParent: (contractId: number, newParentId: number | null) => void;
  onShowVersionHistory: (contractId: number, contractName: string) => void;
  reprocessing: boolean;
  deleting: boolean;
};

const StatusBadge = ({ status }: { status: Contract["status"] }) => {
  const variants = {
    pending: { icon: Clock, label: "Wartend", variant: "secondary" as const },
    processing: { icon: Loader2, label: "Verarbeitung", variant: "default" as const },
    ready: { icon: CheckCircle, label: "Bereit", variant: "default" as const },
    error: { icon: XCircle, label: "Fehler", variant: "destructive" as const },
  };

  const { icon: Icon, label, variant } = variants[status];

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {label}
    </Badge>
  );
};

const ContractTypeBadge = ({ type, productGroups }: { type: Contract["contractType"]; productGroups: string | null }) => {
  const labels = {
    main: "Hauptvertrag",
    extension: "Erweiterung",
    pricelist: "Preisliste",
    productgroup: productGroups ? `PG ${productGroups}` : "Produktgruppe",
    regional: "Regional",
  };

  const colors = {
    main: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    extension: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    pricelist: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    productgroup: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    regional: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  };

  return (
    <Badge className={`${colors[type]} border-0 text-xs`}>
      {labels[type]}
    </Badge>
  );
};

function buildTree(contracts: Contract[]): ContractNode[] {
  // Separate main contracts and children
  const mainContracts = contracts.filter(c => c.parentContractId === null);
  const childContracts = contracts.filter(c => c.parentContractId !== null);

  // Build tree structure
  const nodes: ContractNode[] = mainContracts.map(contract => ({
    contract,
    children: childContracts
      .filter(c => c.parentContractId === contract.id)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.getTime() - b.createdAt.getTime())
      .map(child => ({ contract: child, children: [] })),
  }));

  // Sort main contracts by insurance company and name
  nodes.sort((a, b) => {
    const companyA = a.contract.insuranceCompany || "";
    const companyB = b.contract.insuranceCompany || "";
    if (companyA !== companyB) return companyA.localeCompare(companyB);
    return a.contract.name.localeCompare(b.contract.name);
  });

  return nodes;
}

function ContractRow({
  node,
  depth = 0,
  customColumns,
  selectedContractsForComparison,
  onToggleSelection,
  onOpenPdf,
  onGenerateSummary,
  onReprocess,
  onDelete,
  onShowVersionHistory,
  reprocessing,
  deleting,
}: {
  node: ContractNode;
  depth?: number;
  customColumns: CustomColumn[];
  selectedContractsForComparison: number[];
  onToggleSelection: (contractId: number) => void;
  onOpenPdf: (pdfUrl: string, page: number) => void;
  onGenerateSummary: (contract: { id: number; name: string }) => void;
  onReprocess: (contractId: number) => void;
  onDelete: (contractId: number) => void;
  onShowVersionHistory: (contractId: number, contractName: string) => void;
  reprocessing: boolean;
  deleting: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const { contract, children } = node;
  const hasChildren = children.length > 0;
  const isMainContract = contract.parentContractId === null;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `contract-${contract.id}`,
    data: { contractId: contract.id },
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${contract.id}`,
    disabled: !isMainContract, // Only main contracts can be drop targets
    data: { contractId: contract.id },
  });

  return (
    <>
      <TableRow 
        ref={(node) => {
          setDragRef(node);
          if (isMainContract) setDropRef(node);
        }}
        className={`
          ${depth > 0 ? "bg-muted/30" : ""}
          ${isDragging ? "opacity-50" : ""}
          ${isOver && isMainContract ? "bg-blue-50 dark:bg-blue-950" : ""}
          transition-colors
        `}
      >
        <TableCell className="w-8">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded inline-block"
          >
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </TableCell>
        <TableCell>
          <input
            type="checkbox"
            checked={selectedContractsForComparison.includes(contract.id)}
            onChange={() => onToggleSelection(contract.id)}
            className="cursor-pointer"
          />
        </TableCell>
        <TableCell className="font-medium">
          <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
            {hasChildren && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-0 hover:bg-accent rounded"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {isMainContract ? (
              <Folder className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            ) : (
              <FileText className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="max-w-[200px] truncate">{contract.name}</span>
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            {contract.insuranceCompany || "-"}
            {!isMainContract && (
              <ContractTypeBadge type={contract.contractType} productGroups={contract.productGroups} />
            )}
            {hasChildren && (
              <Badge variant="outline" className="text-xs">
                {children.length} Sub
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="max-w-[150px] truncate">
          {contract.productArea || "-"}
        </TableCell>
        <TableCell>
          {contract.validFrom
            ? new Date(contract.validFrom).toLocaleDateString("de-DE")
            : "-"}
        </TableCell>
        <TableCell className="max-w-[120px] truncate" title={contract.contactPerson || undefined}>
          {contract.contactPerson || "-"}
        </TableCell>
        <TableCell>{contract.totalPages || "-"}</TableCell>
        <TableCell>
          <StatusBadge status={contract.status} />
        </TableCell>
        <TableCell>
          {new Date(contract.createdAt).toLocaleDateString("de-DE")}
        </TableCell>
        {customColumns.map((column) => (
          <TableCell key={column.id}>
            {contract.customData?.[column.id] || "-"}
          </TableCell>
        ))}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {contract.status === "ready" && contract.pdfUrl && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenPdf(contract.pdfUrl!, 1)}
                  title="PDF anzeigen"
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onGenerateSummary({ id: contract.id, name: contract.name })}
                  title="Zusammenfassung generieren"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onShowVersionHistory(contract.id, contract.name)}
                  title="Versionshistorie"
                >
                  <History className="h-4 w-4" />
                </Button>
              </>
            )}
            {contract.status === "error" && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onReprocess(contract.id)}
                disabled={reprocessing}
                title="Erneut verarbeiten"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(contract.id)}
              disabled={deleting}
              title={hasChildren ? `Löscht auch ${children.length} Sub-Verträge` : "Löschen"}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {expanded && children.map((child) => (
        <ContractRow
          key={child.contract.id}
          node={child}
          depth={depth + 1}
          customColumns={customColumns}
          selectedContractsForComparison={selectedContractsForComparison}
          onToggleSelection={onToggleSelection}
          onOpenPdf={onOpenPdf}
          onGenerateSummary={onGenerateSummary}
          onReprocess={onReprocess}
          onDelete={onDelete}
          onShowVersionHistory={onShowVersionHistory}
          reprocessing={reprocessing}
          deleting={deleting}
        />
      ))}
    </>
  );
}

export function ContractHierarchyTree(props: Props) {
  const tree = buildTree(props.contracts);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const draggedId = parseInt((active.id as string).replace("contract-", ""));
    const targetId = parseInt((over.id as string).replace("drop-", ""));

    const draggedContract = props.contracts.find(c => c.id === draggedId);
    const targetContract = props.contracts.find(c => c.id === targetId);

    if (!draggedContract || !targetContract) return;

    // Prevent invalid drops
    if (targetContract.parentContractId !== null) {
      // Can't drop on a child contract
      return;
    }

    if (draggedContract.parentContractId === targetId) {
      // Already assigned to this parent
      return;
    }

    // Update parent
    props.onUpdateParent(draggedId, targetId);
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]"></TableHead>
          <TableHead className="w-[50px]">
            <input
              type="checkbox"
              className="cursor-pointer"
              onChange={(e) => {
                if (e.target.checked) {
                  props.contracts.forEach(c => {
                    if (!props.selectedContractsForComparison.includes(c.id)) {
                      props.onToggleSelection(c.id);
                    }
                  });
                } else {
                  props.contracts.forEach(c => props.onToggleSelection(c.id));
                }
              }}
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Krankenkasse</TableHead>
          <TableHead>Produktbereich</TableHead>
          <TableHead>Gültig ab</TableHead>
          <TableHead>Ansprechpartner</TableHead>
          <TableHead>Seiten</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Hochgeladen</TableHead>
          {props.customColumns.map((column) => (
            <TableHead key={column.id}>{column.name}</TableHead>
          ))}
          <TableHead className="text-right">Aktionen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tree.map((node) => (
          <ContractRow
            key={node.contract.id}
            node={node}
            customColumns={props.customColumns}
            selectedContractsForComparison={props.selectedContractsForComparison}
            onToggleSelection={props.onToggleSelection}
            onOpenPdf={props.onOpenPdf}
            onGenerateSummary={props.onGenerateSummary}
            onReprocess={props.onReprocess}
            onDelete={props.onDelete}
            onShowVersionHistory={props.onShowVersionHistory}
            reprocessing={props.reprocessing}
            deleting={props.deleting}
          />
        ))}
      </TableBody>
    </Table>
    </DndContext>
  );
}
