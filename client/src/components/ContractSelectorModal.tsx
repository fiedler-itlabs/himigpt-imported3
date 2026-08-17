import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";
import type { Contract } from "../../../drizzle/schema";

type ContractSelectorModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contracts: Contract[];
  initialSelection?: number[]; // Pre-selected contract IDs for editing
  onConfirm: (contractIds: number[] | null) => void; // null = all contracts
};

export function ContractSelectorModal({
  open,
  onOpenChange,
  contracts,
  initialSelection,
  onConfirm,
}: ContractSelectorModalProps) {
  const [mode, setMode] = useState<"all" | "specific">(initialSelection && initialSelection.length > 0 ? "specific" : "all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(initialSelection || []));
  const [searchQuery, setSearchQuery] = useState("");

  // Reset state when modal opens with new initialSelection
  useEffect(() => {
    if (open) {
      if (initialSelection && initialSelection.length > 0) {
        setMode("specific");
        setSelectedIds(new Set(initialSelection));
      } else {
        setMode("all");
        setSelectedIds(new Set());
      }
      setSearchQuery("");
    }
  }, [open, initialSelection]);

  // Filter contracts by search query
  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;
    const query = searchQuery.toLowerCase();
    return contracts.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.insuranceCompany?.toLowerCase().includes(query) ||
        c.productArea?.toLowerCase().includes(query)
    );
  }, [contracts, searchQuery]);

  // Group contracts by insurance company
  const groupedContracts = useMemo(() => {
    const groups = new Map<string, Contract[]>();
    for (const contract of filteredContracts) {
      const key = contract.insuranceCompany || "Unbekannt";
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(contract);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredContracts]);

  const handleToggle = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedIds(new Set(filteredContracts.map((c) => c.id)));
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleConfirm = () => {
    if (mode === "all") {
      onConfirm(null);
    } else {
      onConfirm(Array.from(selectedIds));
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat-Kontext wählen</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Mode selection */}
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as "all" | "specific")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="all" id="mode-all" />
              <Label htmlFor="mode-all" className="font-normal cursor-pointer">
                Alle Verträge durchsuchen ({contracts.length})
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="specific" id="mode-specific" />
              <Label htmlFor="mode-specific" className="font-normal cursor-pointer">
                Bestimmte Verträge auswählen
              </Label>
            </div>
          </RadioGroup>

          {/* Contract selector (only shown when mode is "specific") */}
          {mode === "specific" && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Verträge suchen..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Selected counter and bulk actions */}
              <div className="flex items-center justify-between">
                <Badge variant="secondary">
                  {selectedIds.size} {selectedIds.size === 1 ? "Vertrag" : "Verträge"} ausgewählt
                </Badge>
                <div className="space-x-2">
                  <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                    Alle auswählen
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleDeselectAll}>
                    Alle abwählen
                  </Button>
                </div>
              </div>

              {/* Grouped contract list */}
              <Accordion type="multiple" className="w-full">
                {groupedContracts.map(([insuranceCompany, groupContracts]) => (
                  <AccordionItem key={insuranceCompany} value={insuranceCompany}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{insuranceCompany}</span>
                        <Badge variant="outline">{groupContracts.length}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-4">
                        {groupContracts.map((contract) => (
                          <div key={contract.id} className="flex items-start space-x-2">
                            <Checkbox
                              id={`contract-${contract.id}`}
                              checked={selectedIds.has(contract.id)}
                              onCheckedChange={() => handleToggle(contract.id)}
                            />
                            <Label
                              htmlFor={`contract-${contract.id}`}
                              className="font-normal cursor-pointer flex-1"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="truncate">{contract.name}</div>
                                  {contract.productArea && (
                                    <div className="text-xs text-muted-foreground truncate">
                                      {contract.productArea}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Label>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>

              {filteredContracts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Keine Verträge gefunden
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={mode === "specific" && selectedIds.size === 0}
          >
            Chat starten
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
