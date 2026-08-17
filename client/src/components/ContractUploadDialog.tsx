import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Sparkles, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Contract = {
  id: number;
  name: string;
  insuranceCompany: string | null;
  parentContractId: number | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete: () => void;
};

export function ContractUploadDialog({ open, onOpenChange, onUploadComplete }: Props) {
  const [uploading, setUploading] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<"new" | "existing">("new");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [contractType, setContractType] = useState<"extension" | "pricelist" | "productgroup" | "regional">("productgroup");
  const [productGroups, setProductGroups] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{ total: number; completed: number; failed: string[] }>({ total: 0, completed: 0, failed: [] });
  const [suggestion, setSuggestion] = useState<{
    suggestedParentId: number | null;
    suggestedParentName: string | null;
    confidence: "high" | "medium" | "low";
    reasoning: string;
    suggestedContractType: "extension" | "pricelist" | "productgroup" | "regional" | null;
    suggestedProductGroups: string | null;
  } | null>(null);
  const [replacementSuggestion, setReplacementSuggestion] = useState<{
    shouldReplace: boolean;
    oldContractId: number;
    oldContractName: string;
    confidence: "high" | "medium" | "low";
    reasoning: string;
  } | null>(null);
  const [autoArchive, setAutoArchive] = useState(false);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mainContractsQuery = trpc.contracts.getMainContracts.useQuery(undefined, {
    enabled: open,
  });

  const uploadMutation = trpc.contracts.upload.useMutation();
  const archiveMutation = trpc.contracts.archiveContract.useMutation();

  const utils = trpc.useUtils();

  // Get suggestion when first file is selected (for bulk upload, use first file as reference)
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setSuggestion(null);
      return;
    }

    const getSuggestion = async () => {
      setLoadingSuggestion(true);
      try {
        const result = await utils.contracts.suggestParent.fetch({
          fileName: selectedFiles[0].name,
          insuranceCompany: null, // Could extract from filename or metadata
        });
        
        setSuggestion(result);
        
        // Auto-apply suggestion if high confidence
        if (result.confidence === "high" && result.suggestedParentId) {
          setAssignmentMode("existing");
          setSelectedParentId(result.suggestedParentId.toString());
          if (result.suggestedContractType) {
            setContractType(result.suggestedContractType);
          }
          if (result.suggestedProductGroups) {
            setProductGroups(result.suggestedProductGroups);
          }
        }

        // Get replacement suggestion (for versioning)
        try {
          const replacementResult = await utils.contracts.suggestReplacement.fetch({
            newContractName: selectedFiles[0].name.replace('.pdf', ''),
            newInsuranceCompany: null,
          });
          
          if (replacementResult.shouldReplace && replacementResult.replacementContractId) {
            // Get contract name from similar contracts query
            const similarContracts = await utils.contracts.detectSimilar.fetch({
              name: selectedFiles[0].name.replace('.pdf', ''),
              insuranceCompany: null,
            });
            const oldContract = similarContracts.find(c => c.id === replacementResult.replacementContractId);
            
            setReplacementSuggestion({
              shouldReplace: true,
              oldContractId: replacementResult.replacementContractId,
              oldContractName: oldContract?.name || 'Unbekannt',
              confidence: replacementResult.confidence,
              reasoning: replacementResult.reason,
            });
            // Auto-enable archiving if high confidence
            setAutoArchive(replacementResult.confidence === "high");
          }
        } catch (error) {
          console.error("Failed to get replacement suggestion:", error);
        }
      } catch (error) {
        console.error("Failed to get suggestion:", error);
      } finally {
        setLoadingSuggestion(false);
      }
    };

    getSuggestion();
  }, [selectedFiles, utils]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate all files are PDFs
    const invalidFiles = files.filter(f => !f.name.toLowerCase().endsWith(".pdf"));
    if (invalidFiles.length > 0) {
      toast.error(`Bitte nur PDF-Dateien hochladen (${invalidFiles.length} ungültige Datei(en))`);
      return;
    }

    setSelectedFiles(files);
    setUploadProgress({ total: 0, completed: 0, failed: [] });
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Bitte Datei(en) auswählen");
      return;
    }

    if (assignmentMode === "existing" && !selectedParentId) {
      toast.error("Bitte Hauptvertrag auswählen");
      return;
    }

    setUploading(true);
    setUploadProgress({ total: selectedFiles.length, completed: 0, failed: [] });

    const failed: string[] = [];
    let completed = 0;
    let newContractId: number | null = null;

    for (const file of selectedFiles) {
      try {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        const result = await uploadMutation.mutateAsync({
          fileName: file.name,
          fileData: base64,
          mimeType: "application/pdf",
          parentContractId: assignmentMode === "existing" ? parseInt(selectedParentId) : null,
          contractType: assignmentMode === "existing" ? contractType : "main",
          productGroups: contractType === "productgroup" ? productGroups || null : null,
        });

        // Store first uploaded contract ID for archiving
        if (completed === 0) {
          newContractId = result.id;
        }

        completed++;
        setUploadProgress({ total: selectedFiles.length, completed, failed });
      } catch (error: any) {
        failed.push(file.name);
        setUploadProgress({ total: selectedFiles.length, completed, failed });
      }
    }

    // Archive old version if enabled
    if (autoArchive && replacementSuggestion && newContractId) {
      try {
        await archiveMutation.mutateAsync({
          contractId: replacementSuggestion.oldContractId,
          replacedByContractId: newContractId,
        });
        toast.success(`Alte Version "${replacementSuggestion.oldContractName}" archiviert`);
      } catch (error) {
        console.error("Failed to archive old version:", error);
        toast.warning("Upload erfolgreich, aber Archivierung fehlgeschlagen");
      }
    }

    setUploading(false);

    if (failed.length === 0) {
      toast.success(`${selectedFiles.length} Vertrag/Verträge erfolgreich hochgeladen`);
    } else if (completed > 0) {
      toast.warning(`${completed} erfolgreich, ${failed.length} fehlgeschlagen`);
    } else {
      toast.error(`Alle Uploads fehlgeschlagen`);
    }

    onUploadComplete();
    handleClose();
  };

  const handleClose = () => {
    setSelectedFiles([]);
    setSuggestion(null);
    setAssignmentMode("new");
    setSelectedParentId("");
    setContractType("productgroup");
    setProductGroups("");
    setUploadProgress({ total: 0, completed: 0, failed: [] });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onOpenChange(false);
  };

  const confidenceColors = {
    high: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    low: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vertrag hochladen</DialogTitle>
          <DialogDescription>
            Laden Sie einen PDF-Vertrag hoch. Die KI schlägt automatisch eine Zuordnung vor.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* File Selection */}
          <div className="space-y-2">
            <Label htmlFor="file">PDF-Datei</Label>
            <div className="flex gap-2">
              <Input
                id="file"
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
              />
              {loadingSuggestion && (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              )}
            </div>
            {selectedFiles.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Ausgewählt: {selectedFiles.length} Datei(en)
                {selectedFiles.length <= 3 && (
                  <span className="block mt-1">
                    {selectedFiles.map(f => f.name).join(", ")}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* AI Suggestion */}
          {suggestion && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-medium">KI-Vorschlag</span>
                <Badge className={`${confidenceColors[suggestion.confidence]} border-0 text-xs`}>
                  {suggestion.confidence === "high" ? "Hohe Sicherheit" : 
                   suggestion.confidence === "medium" ? "Mittlere Sicherheit" : 
                   "Niedrige Sicherheit"}
                </Badge>
              </div>
              
              {suggestion.suggestedParentId ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Empfehlung:</strong> Als Sub-Vertrag zu "{suggestion.suggestedParentName}" zuordnen
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.reasoning}
                  </p>
                  {suggestion.suggestedContractType && (
                    <p className="text-sm">
                      <strong>Typ:</strong> {
                        suggestion.suggestedContractType === "extension" ? "Erweiterung" :
                        suggestion.suggestedContractType === "pricelist" ? "Preisliste" :
                        suggestion.suggestedContractType === "productgroup" ? "Produktgruppe" :
                        "Regional"
                      }
                      {suggestion.suggestedProductGroups && ` (PG ${suggestion.suggestedProductGroups})`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    {suggestion.reasoning}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Replacement Suggestion (Versioning) */}
          {replacementSuggestion && (
            <div className="p-4 border border-orange-300 rounded-lg bg-orange-50 dark:bg-orange-950/20 space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <span className="font-medium text-orange-900 dark:text-orange-100">Ersetzt bestehenden Vertrag?</span>
                <Badge className={`${confidenceColors[replacementSuggestion.confidence]} border-0 text-xs`}>
                  {replacementSuggestion.confidence === "high" ? "Hohe Sicherheit" : 
                   replacementSuggestion.confidence === "medium" ? "Mittlere Sicherheit" : 
                   "Niedrige Sicherheit"}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm text-orange-900 dark:text-orange-100">
                  <strong>Ersetzt:</strong> "{replacementSuggestion.oldContractName}"
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  {replacementSuggestion.reasoning}
                </p>
                
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="auto-archive"
                    checked={autoArchive}
                    onChange={(e) => setAutoArchive(e.target.checked)}
                    className="h-4 w-4 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                  />
                  <Label htmlFor="auto-archive" className="font-normal cursor-pointer text-orange-900 dark:text-orange-100">
                    Alte Version automatisch archivieren
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* Assignment Mode */}
          <div className="space-y-3">
            <Label>Vertragstyp</Label>
            <RadioGroup value={assignmentMode} onValueChange={(v) => setAssignmentMode(v as "new" | "existing")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="new" id="new" />
                <Label htmlFor="new" className="font-normal cursor-pointer">
                  Neuer Hauptvertrag
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="existing" id="existing" />
                <Label htmlFor="existing" className="font-normal cursor-pointer">
                  Zu bestehendem Vertrag zuordnen
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Parent Selection */}
          {assignmentMode === "existing" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="parent">Hauptvertrag</Label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger id="parent">
                    <SelectValue placeholder="Hauptvertrag auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mainContractsQuery.data?.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id.toString()}>
                        {contract.name} {contract.insuranceCompany && `(${contract.insuranceCompany})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Art der Zuordnung</Label>
                <RadioGroup value={contractType} onValueChange={(v) => setContractType(v as any)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="extension" id="extension" />
                    <Label htmlFor="extension" className="font-normal cursor-pointer">
                      Erweiterung/Nachtrag
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pricelist" id="pricelist" />
                    <Label htmlFor="pricelist" className="font-normal cursor-pointer">
                      Preisliste
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="productgroup" id="productgroup" />
                    <Label htmlFor="productgroup" className="font-normal cursor-pointer">
                      Produktgruppe
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="regional" id="regional" />
                    <Label htmlFor="regional" className="font-normal cursor-pointer">
                      Regionale Variante
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {contractType === "productgroup" && (
                <div className="space-y-2">
                  <Label htmlFor="productGroups">Produktgruppen (optional)</Label>
                  <Input
                    id="productGroups"
                    placeholder='z.B. "4" oder "7,8"'
                    value={productGroups}
                    onChange={(e) => setProductGroups(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Mehrere Produktgruppen mit Komma trennen
                  </p>
                </div>
              )}
            </>
          )}

          {/* Upload Progress */}
          {uploading && uploadProgress.total > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fortschritt:</span>
                <span className="font-medium">
                  {uploadProgress.completed} / {uploadProgress.total}
                </span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-600 transition-all duration-300"
                  style={{ width: `${(uploadProgress.completed / uploadProgress.total) * 100}%` }}
                />
              </div>
              {uploadProgress.failed.length > 0 && (
                <div className="text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="inline h-4 w-4 mr-1" />
                  Fehlgeschlagen: {uploadProgress.failed.join(", ")}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={uploading}>
              Abbrechen
            </Button>
            <Button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Hochladen
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
