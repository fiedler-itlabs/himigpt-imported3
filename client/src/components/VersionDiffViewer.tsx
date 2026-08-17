import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Loader2, Plus, Minus, Edit3, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldContractId: number;
  oldContractName: string;
  newContractId: number;
  newContractName: string;
};

export function VersionDiffViewer({
  open,
  onOpenChange,
  oldContractId,
  oldContractName,
  newContractId,
  newContractName,
}: Props) {
  const diffQuery = trpc.contracts.getDiff.useQuery(
    { oldContractId, newContractId },
    { enabled: open }
  );

  const getChangeIcon = (type: "added" | "removed" | "modified") => {
    switch (type) {
      case "added":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "removed":
        return <Minus className="h-4 w-4 text-red-600" />;
      case "modified":
        return <Edit3 className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getChangeBadge = (type: "added" | "removed" | "modified") => {
    switch (type) {
      case "added":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">Neu</Badge>;
      case "removed":
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0">Entfernt</Badge>;
      case "modified":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-0">Geändert</Badge>;
    }
  };

  const getCategoryBadge = (category: "price" | "position" | "condition" | "other") => {
    const colors = {
      price: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      position: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
      condition: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      other: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    };
    const labels = {
      price: "Preis",
      position: "Position",
      condition: "Kondition",
      other: "Sonstiges",
    };
    return <Badge variant="outline" className={`${colors[category]} border-0 text-xs`}>{labels[category]}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Versionsvergleich
          </DialogTitle>
          <DialogDescription>
            Unterschiede zwischen "{oldContractName}" und "{newContractName}"
          </DialogDescription>
        </DialogHeader>

        {diffQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : diffQuery.error ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Fehler beim Laden des Vergleichs: {diffQuery.error.message}
            </AlertDescription>
          </Alert>
        ) : diffQuery.data ? (
          <div className="space-y-6">
            {/* Summary */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <h3 className="font-medium mb-2">Zusammenfassung</h3>
              <p className="text-sm text-muted-foreground">{diffQuery.data.summary}</p>
            </div>

            {/* Changes */}
            <div className="space-y-3">
              <h3 className="font-medium">Änderungen ({diffQuery.data.changes.length})</h3>
              
              {diffQuery.data.changes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Keine signifikanten Änderungen gefunden
                </p>
              ) : (
                diffQuery.data.changes.map((change, index) => (
                  <div
                    key={index}
                    className={`
                      p-4 border rounded-lg
                      ${change.type === "added" ? "border-green-200 bg-green-50 dark:bg-green-950/20" : ""}
                      ${change.type === "removed" ? "border-red-200 bg-red-50 dark:bg-red-950/20" : ""}
                      ${change.type === "modified" ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20" : ""}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">{getChangeIcon(change.type)}</div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {getChangeBadge(change.type)}
                          {getCategoryBadge(change.category)}
                          {change.positionNumber && (
                            <Badge variant="outline" className="text-xs">
                              {change.positionNumber}
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm font-medium">{change.description}</p>
                        
                        {(change.oldValue || change.newValue) && (
                          <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                            {change.oldValue && (
                              <div>
                                <span className="text-muted-foreground">Alt:</span>
                                <span className="ml-2 font-mono">{change.oldValue}</span>
                              </div>
                            )}
                            {change.newValue && (
                              <div>
                                <span className="text-muted-foreground">Neu:</span>
                                <span className="ml-2 font-mono">{change.newValue}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
