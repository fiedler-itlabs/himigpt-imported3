import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, GitCompare } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ComparisonDialogProps {
  open: boolean;
  onClose: () => void;
  selectedContracts: Array<{ id: number; name: string }>;
  onComparisonGenerated: (result: {
    query: string;
    summary: string;
    contractNames: string[];
    contractIds: number[];
  }) => void;
}

export function ComparisonDialog({
  open,
  onClose,
  selectedContracts,
  onComparisonGenerated,
}: ComparisonDialogProps) {
  const [query, setQuery] = useState("");

  const compareMutation = trpc.comparison.compare.useMutation();

  const handleCompare = async () => {
    if (!query.trim()) {
      toast.error("Bitte geben Sie eine Vergleichsfrage ein");
      return;
    }

    if (selectedContracts.length < 2) {
      toast.error("Bitte wählen Sie mindestens 2 Verträge aus");
      return;
    }

    try {
      const result = await compareMutation.mutateAsync({
        contractIds: selectedContracts.map(c => c.id),
        query: query.trim(),
      });

      onComparisonGenerated({
        query: result.query,
        summary: result.summary,
        contractNames: selectedContracts.map(c => c.name),
        contractIds: selectedContracts.map(c => c.id),
      });

      toast.success("Vergleich erfolgreich erstellt");
      onClose();
      setQuery("");
    } catch (error) {
      toast.error("Fehler beim Erstellen des Vergleichs");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Verträge vergleichen
          </DialogTitle>
          <DialogDescription>
            Vergleichen Sie {selectedContracts.length} ausgewählte Verträge basierend auf einer
            spezifischen Frage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Selected contracts */}
          <div className="space-y-2">
            <Label>Ausgewählte Verträge ({selectedContracts.length})</Label>
            <div className="rounded-md border p-3 space-y-1 max-h-[150px] overflow-y-auto">
              {selectedContracts.map((contract) => (
                <div key={contract.id} className="text-sm text-muted-foreground">
                  • {contract.name}
                </div>
              ))}
            </div>
          </div>

          {/* Query input */}
          <div className="space-y-2">
            <Label htmlFor="query">Vergleichsfrage</Label>
            <Input
              id="query"
              placeholder="z.B. Vergleiche die Preise für Position 19.40.01.7"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !compareMutation.isPending) {
                  handleCompare();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Beispiele: "Vergleiche Genehmigungsfreigrenzen", "Welche Rabatte gibt es?", "Vergleiche
              alle Preise für Produktgruppe 03"
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={compareMutation.isPending}>
            Abbrechen
          </Button>
          <Button onClick={handleCompare} disabled={compareMutation.isPending || !query.trim()}>
            {compareMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Wird verglichen...
              </>
            ) : (
              <>
                <GitCompare className="h-4 w-4 mr-2" />
                Vergleichen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
