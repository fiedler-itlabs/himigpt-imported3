import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { History, Trash2, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ComparisonHistoryProps {
  onViewComparison: (comparison: {
    query: string;
    summary: string;
    contractNames: string[];
    contractIds: number[];
  }) => void;
}

export function ComparisonHistory({ onViewComparison }: ComparisonHistoryProps) {
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: history, isLoading, refetch } = trpc.comparison.getHistory.useQuery();
  const deleteMutation = trpc.comparison.delete.useMutation();
  const contractsQuery = trpc.contracts.list.useQuery();

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await deleteMutation.mutateAsync({ id: deleteId });
      toast.success("Vergleich gelöscht");
      refetch();
    } catch (error) {
      toast.error("Löschen fehlgeschlagen");
    } finally {
      setDeleteId(null);
    }
  };

  const handleView = (item: NonNullable<typeof history>[0]) => {
    // Get contract names from IDs
    const contractIds = item.contractIds as number[];
    const contractNames = contractIds
      .map((id) => {
        const contract = contractsQuery.data?.find((c) => c.id === id);
        return contract?.name || `Vertrag ${id}`;
      });

    onViewComparison({
      query: item.query,
      summary: item.result,
      contractNames,
      contractIds,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Keine gespeicherten Vergleiche</p>
        <p className="text-sm mt-1">
          Speichern Sie Vergleiche, um sie später wiederzuverwenden
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item) => {
        const contractIds = item.contractIds as number[];
        return (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{item.name}</CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    {new Date(item.createdAt).toLocaleDateString('de-DE', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleView(item)}
                    title="Vergleich anzeigen"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(item.id)}
                    title="Vergleich löschen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="text-sm text-muted-foreground mb-2">
                <span className="font-medium">Frage:</span> {item.query}
              </div>
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Verträge:</span> {contractIds.length} ausgewählt
              </div>
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vergleich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Vorgang kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
