import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  Upload,
  FileText,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
  MessageSquare,
  Home,
  Plus,
  FileSpreadsheet,
  GitCompare,
  History,
} from "lucide-react";
import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ResizablePDFViewer } from "@/components/ResizablePDFViewer";
import { SummaryDialog } from "@/components/SummaryDialog";
import { SummarySidebar } from "@/components/SummarySidebar";
import { ComparisonDialog } from "@/components/ComparisonDialog";
import { ComparisonViewer } from "@/components/ComparisonViewer";
import { ComparisonHistory } from "@/components/ComparisonHistory";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ContractHierarchyTree } from "@/components/ContractHierarchyTree";
import { ContractUploadDialog } from "@/components/ContractUploadDialog";
import { VersionHistoryDialog } from "@/components/VersionHistoryDialog";

export default function Contracts() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnDescription, setNewColumnDescription] = useState("");
  const [newColumnDataType, setNewColumnDataType] = useState<"text" | "number" | "date">("text");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string>("");
  const [selectedPdfPage, setSelectedPdfPage] = useState<number>(1);
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [selectedContractForSummary, setSelectedContractForSummary] = useState<{ id: number; name: string } | null>(null);
  const [summarySidebarOpen, setSummarySidebarOpen] = useState(false);
  const [selectedSummaryId, setSelectedSummaryId] = useState<number>(0);
  const [selectedContractsForComparison, setSelectedContractsForComparison] = useState<number[]>([]);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [comparisonViewerOpen, setComparisonViewerOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<{
    query: string;
    summary: string;
    contractNames: string[];
    contractIds: number[];
  } | null>(null);
  const [hierarchyFilter, setHierarchyFilter] = useState<"all" | "main" | "sub">("all");
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedContractForVersions, setSelectedContractForVersions] = useState<{ id: number; name: string } | null>(null);

  const openPdfViewer = (pdfUrl: string, page: number = 1) => {
    setSelectedPdfUrl(pdfUrl);
    setSelectedPdfPage(page);
    setPdfViewerOpen(true);
  };

  const closePdfViewer = () => {
    setPdfViewerOpen(false);
    setSelectedPdfUrl("");
    setSelectedPdfPage(1);
  };

  const contractsQuery = trpc.contracts.list.useQuery(undefined, {
    enabled: !!user,
  });

  const customColumnsQuery = trpc.customColumns.list.useQuery(undefined, {
    enabled: !!user,
  });

  const uploadMutation = trpc.contracts.upload.useMutation({
    onSuccess: () => {
      toast.success("Vertrag erfolgreich hochgeladen");
      setUploadDialogOpen(false);
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler beim Hochladen: ${error.message}`);
    },
  });

  const deleteMutation = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      toast.success("Vertrag gelöscht");
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler beim Löschen: ${error.message}`);
    },
  });

  const updateParentMutation = trpc.contracts.updateParent.useMutation({
    onSuccess: () => {
      toast.success("Vertragszuordnung geändert");
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const reprocessMutation = trpc.contracts.reprocess.useMutation({
    onSuccess: () => {
      toast.success("Verarbeitung gestartet");
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const createColumnMutation = trpc.customColumns.create.useMutation({
    onSuccess: () => {
      toast.success("Spalte erfolgreich hinzugefügt");
      setAddColumnDialogOpen(false);
      setNewColumnName("");
      setNewColumnDescription("");
      setNewColumnDataType("text");
      customColumnsQuery.refetch();
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteColumnMutation = trpc.customColumns.delete.useMutation({
    onSuccess: () => {
      toast.success("Spalte gelöscht");
      customColumnsQuery.refetch();
      contractsQuery.refetch();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const handleAddColumn = () => {
    if (!newColumnName.trim() || !newColumnDescription.trim()) {
      toast.error("Bitte Name und Beschreibung eingeben");
      return;
    }

    createColumnMutation.mutate({
      name: newColumnName,
      description: newColumnDescription,
      dataType: newColumnDataType,
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Filter only PDF files
    const pdfFiles = files.filter(file => file.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      toast.error("Bitte nur PDF-Dateien hochladen");
      return;
    }

    if (pdfFiles.length < files.length) {
      toast.warning(`${files.length - pdfFiles.length} Nicht-PDF-Dateien wurden übersprungen`);
    }

    setUploading(true);
    const results = await Promise.allSettled(
      pdfFiles.map(async (file) => {
        try {
          const buffer = await file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );

          await uploadMutation.mutateAsync({
            fileName: file.name,
            fileData: base64,
            mimeType: "application/pdf",
          });
          return { success: true, fileName: file.name };
        } catch (error) {
          console.error(`Upload error for ${file.name}:`, error);
          return { success: false, fileName: file.name, error };
        }
      })
    );

    setUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Show summary toast
    const successful = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    
    if (failed === 0) {
      toast.success(`${successful} Vertrag${successful > 1 ? "e" : ""} erfolgreich hochgeladen`);
    } else {
      toast.error(`${successful} erfolgreich, ${failed} fehlgeschlagen`);
    }
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-semibold">Bitte melden Sie sich an</h1>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  // Not admin
  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-semibold">Zugriff verweigert</h1>
          <p className="text-muted-foreground">
            Sie benötigen Admin-Rechte für diese Seite.
          </p>
          <Button onClick={() => setLocation("/chat")}>Zum Chat</Button>
        </div>
      </div>
    );
  }

  const allContracts = contractsQuery.data ?? [];
  
  // Apply hierarchy filter
  const contracts = allContracts.filter(contract => {
    if (hierarchyFilter === "all") return true;
    if (hierarchyFilter === "main") return contract.parentContractId === null;
    if (hierarchyFilter === "sub") return contract.parentContractId !== null;
    return true;
  });
  
  const filteredCount = contracts.length;
  const totalCount = allContracts.length;

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="glass-header sticky top-0 z-50">
        <div className="container flex h-14 sm:h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <img src="/logo-text.svg" alt="HimiGPT" className="h-8" />
            </div>
          </div>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/")} className="sm:hidden">
              <Home className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="hidden sm:flex">
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setLocation("/chat")} className="sm:hidden">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/chat")} className="hidden sm:flex">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="container py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Vertragsverwaltung</h1>
            <p className="text-muted-foreground mt-1">
              Verwalten Sie Ihre Krankenkassenverträge
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {/* Hierarchy Filter */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={hierarchyFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setHierarchyFilter("all")}
                className="h-8 px-3"
              >
                Alle
              </Button>
              <Button
                variant={hierarchyFilter === "main" ? "default" : "ghost"}
                size="sm"
                onClick={() => setHierarchyFilter("main")}
                className="h-8 px-3"
              >
                Hauptverträge
              </Button>
              <Button
                variant={hierarchyFilter === "sub" ? "default" : "ghost"}
                size="sm"
                onClick={() => setHierarchyFilter("sub")}
                className="h-8 px-3"
              >
                Sub-Verträge
              </Button>
            </div>

            <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Spalte hinzufügen
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Benutzerdefinierte Spalte hinzufügen</DialogTitle>
                  <DialogDescription>
                    Definieren Sie eine neue Spalte, die automatisch aus allen Verträgen extrahiert wird.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label htmlFor="columnName">Spaltenname</Label>
                    <Input
                      id="columnName"
                      placeholder="z.B. Rabattsatz"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="columnDescription">Beschreibung für KI</Label>
                    <Input
                      id="columnDescription"
                      placeholder="z.B. Extrahiere den Rabattsatz in Prozent"
                      value={newColumnDescription}
                      onChange={(e) => setNewColumnDescription(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="columnDataType">Datentyp</Label>
                    <select
                      id="columnDataType"
                      className="w-full rounded-md border border-input bg-background px-3 py-2"
                      value={newColumnDataType}
                      onChange={(e) => setNewColumnDataType(e.target.value as "text" | "number" | "date")}
                    >
                      <option value="text">Text</option>
                      <option value="number">Zahl</option>
                      <option value="date">Datum</option>
                    </select>
                  </div>
                  <Button
                    onClick={handleAddColumn}
                    disabled={createColumnMutation.isPending}
                    className="w-full"
                  >
                    {createColumnMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Spalte hinzufügen
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              variant="outline"
              onClick={() => setComparisonDialogOpen(true)}
              disabled={selectedContractsForComparison.length < 2}
            >
              <GitCompare className="h-4 w-4" />
              Vergleichen ({selectedContractsForComparison.length})
            </Button>
            <Button
              variant="outline"
              onClick={() => setHistoryDialogOpen(true)}
            >
              <History className="h-4 w-4" />
              Verlauf
            </Button>

            <Button className="gap-2" onClick={() => setUploadDialogOpen(true)}>
              <Upload className="h-4 w-4" />
              Vertrag hochladen
            </Button>

            <ContractUploadDialog
              open={uploadDialogOpen}
              onOpenChange={setUploadDialogOpen}
              onUploadComplete={() => {
                contractsQuery.refetch();
              }}
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Alle Verträge</CardTitle>
            <CardDescription>
              {hierarchyFilter === "all" 
                ? `${totalCount} Vertrag${totalCount !== 1 ? "e" : ""} im System`
                : `${filteredCount} von ${totalCount} Vertrag${totalCount !== 1 ? "en" : ""}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contractsQuery.isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : contracts.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  Keine Verträge vorhanden
                </h3>
                <p className="text-muted-foreground mb-4">
                  Laden Sie Ihren ersten Vertrag hoch, um zu beginnen.
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Upload className="h-4 w-4 mr-2" />
                  Vertrag hochladen
                </Button>
              </div>
            ) : (
              <div className="table-responsive">
              <ContractHierarchyTree
                contracts={contracts}
                customColumns={customColumnsQuery.data || []}
                selectedContractsForComparison={selectedContractsForComparison}
                onToggleSelection={(contractId) => {
                  if (selectedContractsForComparison.includes(contractId)) {
                    setSelectedContractsForComparison(selectedContractsForComparison.filter(id => id !== contractId));
                  } else {
                    setSelectedContractsForComparison([...selectedContractsForComparison, contractId]);
                  }
                }}
                onOpenPdf={openPdfViewer}
                onGenerateSummary={(contract) => {
                  setSelectedContractForSummary(contract);
                  setSummaryDialogOpen(true);
                }}
                onReprocess={(contractId) => reprocessMutation.mutate({ id: contractId })}
                onDelete={(contractId) => {
                  if (confirm("Vertrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.")) {
                    deleteMutation.mutate({ id: contractId });
                  }
                }}
                onSummaryClick={(summaryId) => {
                  setSelectedSummaryId(summaryId);
                  setSummarySidebarOpen(true);
                }}
                onUpdateParent={(contractId, newParentId) => {
                  updateParentMutation.mutate({ contractId, newParentId });
                }}
                onShowVersionHistory={(contractId, contractName) => {
                  setSelectedContractForVersions({ id: contractId, name: contractName });
                  setVersionHistoryOpen(true);
                }}
                reprocessing={reprocessMutation.isPending}
                deleting={deleteMutation.isPending}
              />
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Version History Dialog */}
      {selectedContractForVersions && (
        <VersionHistoryDialog
          open={versionHistoryOpen}
          onOpenChange={setVersionHistoryOpen}
          contractId={selectedContractForVersions.id}
          contractName={selectedContractForVersions.name}
          onVersionRestored={() => {
            contractsQuery.refetch();
          }}
        />
      )}

      {/* PDF Viewer Sidebar */}
      {pdfViewerOpen && selectedPdfUrl && (
        <ResizablePDFViewer
          pdfUrl={selectedPdfUrl}
          initialPage={selectedPdfPage}
          onClose={closePdfViewer}
        />
      )}

      {/* Summary Dialog */}
      {selectedContractForSummary && (
        <SummaryDialog
          open={summaryDialogOpen}
          onOpenChange={setSummaryDialogOpen}
          contractId={selectedContractForSummary.id}
          contractName={selectedContractForSummary.name}
          onSummaryGenerated={() => {
            contractsQuery.refetch();
          }}
        />
      )}

      {/* Summary Sidebar */}
      <SummarySidebar
        open={summarySidebarOpen}
        onClose={() => setSummarySidebarOpen(false)}
        summaryId={selectedSummaryId}
      />

      <ComparisonDialog
        open={comparisonDialogOpen}
        onClose={() => setComparisonDialogOpen(false)}
        selectedContracts={selectedContractsForComparison.map(id => {
          const contract = contracts.find(c => c.id === id);
          return { id, name: contract?.name || "Unknown" };
        })}
        onComparisonGenerated={(result) => {
          setComparisonResult(result);
          setComparisonViewerOpen(true);
        }}
      />

      <ComparisonViewer
        open={comparisonViewerOpen}
        onClose={() => setComparisonViewerOpen(false)}
        comparison={comparisonResult}
      />

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Vergleichs-Verlauf
            </DialogTitle>
            <DialogDescription>
              Ihre gespeicherten Vergleiche
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh] pr-2">
            <ComparisonHistory
              onViewComparison={(comparison) => {
                setComparisonResult(comparison);
                setComparisonViewerOpen(true);
                setHistoryDialogOpen(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ready":
      return (
        <Badge variant="default" className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
          <CheckCircle className="h-3 w-3 mr-1" />
          Bereit
        </Badge>
      );
    case "processing":
      return (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Verarbeitung
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="outline">
          <Clock className="h-3 w-3 mr-1" />
          Wartend
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive">
          <XCircle className="h-3 w-3 mr-1" />
          Fehler
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}


function SummaryBadges({ contractId, onSummaryClick }: { contractId: number; onSummaryClick: (summaryId: number) => void }) {
  const summariesQuery = trpc.summaries.byContractWithTemplates.useQuery(
    { contractId },
    { enabled: contractId > 0 }
  );

  const summaries = summariesQuery.data || [];

  if (summaries.length === 0) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const getTemplateColor = (type: string) => {
    switch (type) {
      case "backOffice":
        return "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20";
      case "sales":
        return "bg-green-500/10 text-green-600 hover:bg-green-500/20";
      case "management":
        return "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20";
      case "all":
        return "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20";
      default:
        return "bg-gray-500/10 text-gray-600 hover:bg-gray-500/20";
    }
  };

  const getTemplateShortName = (type: string) => {
    switch (type) {
      case "backOffice":
        return "Innendienst";
      case "sales":
        return "Außendienst";
      case "management":
        return "GF";
      case "all":
        return "Alle";
      default:
        return "Custom";
    }
  };

  return (
    <div className="flex flex-wrap gap-1">
      {summaries.map((summary) => (
        <Badge
          key={summary.id}
          variant="outline"
          className={`cursor-pointer ${getTemplateColor(summary.template.type)}`}
          onClick={() => onSummaryClick(summary.id)}
          title={summary.template.title}
        >
          {getTemplateShortName(summary.template.type)}
        </Badge>
      ))}
    </div>
  );
}
