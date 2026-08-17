import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, RotateCcw, Archive, CheckCircle, Loader2, GitCompare } from "lucide-react";
import { toast } from "sonner";
import { VersionDiffViewer } from "./VersionDiffViewer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  contractName: string;
  onVersionRestored?: () => void;
};

export function VersionHistoryDialog({
  open,
  onOpenChange,
  contractId,
  contractName,
  onVersionRestored,
}: Props) {
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [diffViewerOpen, setDiffViewerOpen] = useState(false);
  const [selectedVersionForDiff, setSelectedVersionForDiff] = useState<{
    oldId: number;
    oldName: string;
    newId: number;
    newName: string;
  } | null>(null);

  const versionsQuery = trpc.contracts.getVersions.useQuery(
    { contractId },
    { enabled: open }
  );

  const restoreMutation = trpc.contracts.restoreContract.useMutation({
    onSuccess: () => {
      toast.success("Version wiederhergestellt");
      versionsQuery.refetch();
      onVersionRestored?.();
      setRestoringId(null);
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
      setRestoringId(null);
    },
  });

  const handleRestore = (versionId: number) => {
    if (confirm("Diese Version wiederherstellen? Die aktuelle Version wird archiviert.")) {
      setRestoringId(versionId);
      restoreMutation.mutate({ contractId: versionId });
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorie
          </DialogTitle>
          <DialogDescription>
            Alle Versionen von "{contractName}"
          </DialogDescription>
        </DialogHeader>

        {versionsQuery.isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : versionsQuery.data && versionsQuery.data.length > 0 ? (
          <div className="space-y-3">
            {versionsQuery.data.map((version) => (
              <div
                key={version.id}
                className={`
                  border rounded-lg p-4
                  ${version.isArchived ? "bg-muted/30" : "bg-background border-green-500"}
                `}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{version.name}</h4>
                      {version.versionLabel && (
                        <Badge variant="outline" className="text-xs">
                          {version.versionLabel}
                        </Badge>
                      )}
                      {version.isArchived ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Archive className="h-3 w-3" />
                          Archiviert
                        </Badge>
                      ) : (
                        <Badge variant="default" className="text-xs gap-1 bg-green-600">
                          <CheckCircle className="h-3 w-3" />
                          Aktiv
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <p>Hochgeladen: {new Date(version.createdAt).toLocaleDateString("de-DE")}</p>
                      {version.isArchived && version.archivedAt && (
                        <p>Archiviert: {new Date(version.archivedAt).toLocaleDateString("de-DE")}</p>
                      )}
                      {version.insuranceCompany && (
                        <p>Krankenkasse: {version.insuranceCompany}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {/* Compare button - show for all versions except current */}
                    {version.id !== contractId && versionsQuery.data && versionsQuery.data.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const currentVersion = versionsQuery.data.find(v => v.id === contractId);
                          if (currentVersion) {
                            setSelectedVersionForDiff({
                              oldId: version.id,
                              oldName: version.name,
                              newId: currentVersion.id,
                              newName: currentVersion.name,
                            });
                            setDiffViewerOpen(true);
                          }
                        }}
                        className="gap-2"
                      >
                        <GitCompare className="h-4 w-4" />
                        Vergleichen
                      </Button>
                    )}
                    
                    {version.isArchived && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(version.id)}
                        disabled={restoringId === version.id}
                        className="gap-2"
                      >
                        {restoringId === version.id ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Wiederherstellen...
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4" />
                            Wiederherstellen
                        </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Keine Versionen gefunden</p>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Version Diff Viewer */}
    {selectedVersionForDiff && (
      <VersionDiffViewer
        open={diffViewerOpen}
        onOpenChange={setDiffViewerOpen}
        oldContractId={selectedVersionForDiff.oldId}
        oldContractName={selectedVersionForDiff.oldName}
        newContractId={selectedVersionForDiff.newId}
        newContractName={selectedVersionForDiff.newName}
      />
    )}
    </>
  );
}
