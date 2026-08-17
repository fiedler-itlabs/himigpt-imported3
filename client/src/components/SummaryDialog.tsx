import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, FileText, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface SummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  contractName: string;
  onSummaryGenerated?: () => void;
}

export function SummaryDialog({
  open,
  onOpenChange,
  contractId,
  contractName,
  onSummaryGenerated,
}: SummaryDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");

  const templatesQuery = trpc.summaries.templates.useQuery();
  const generateMutation = trpc.summaries.generate.useMutation();
  const createTemplateMutation = trpc.summaries.createTemplate.useMutation();

  const templates = templatesQuery.data || [];

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error("Bitte wählen Sie eine Vorlage aus");
      return;
    }

    try {
      await generateMutation.mutateAsync({
        contractId,
        templateId: parseInt(selectedTemplateId),
      });
      toast.success("Zusammenfassung erfolgreich generiert!");
      onSummaryGenerated?.();
      onOpenChange(false);
    } catch (error) {
      toast.error("Fehler beim Generieren der Zusammenfassung");
      console.error(error);
    }
  };

  const handleCreateCustomTemplate = async () => {
    if (!customTitle || !customPrompt) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    try {
      const template = await createTemplateMutation.mutateAsync({
        title: customTitle,
        prompt: customPrompt,
      });
      toast.success("Individuelle Vorlage erstellt!");
      setSelectedTemplateId(template.id.toString());
      setShowCustomForm(false);
      setCustomTitle("");
      setCustomPrompt("");
      templatesQuery.refetch();
    } catch (error) {
      toast.error("Fehler beim Erstellen der Vorlage");
      console.error(error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Zusammenfassung generieren</DialogTitle>
          <DialogDescription>
            Wählen Sie eine Vorlage für die Zusammenfassung von "{contractName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Template Selection */}
          {!showCustomForm && (
            <>
              <div className="space-y-4">
                <Label>Vorlage auswählen</Label>
                {templatesQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Vorlagen werden geladen...</span>
                  </div>
                ) : (
                  <RadioGroup value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    {templates.map((template) => (
                      <div key={template.id} className="flex items-start space-x-3 space-y-0">
                        <RadioGroupItem value={template.id.toString()} id={`template-${template.id}`} />
                        <Label
                          htmlFor={`template-${template.id}`}
                          className="font-normal cursor-pointer flex-1"
                        >
                          <div className="font-medium">{template.title}</div>
                          <div className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {template.prompt.slice(0, 150)}...
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleGenerate}
                  disabled={!selectedTemplateId || generateMutation.isPending}
                  className="flex-1"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird generiert...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Zusammenfassung generieren
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Individuelle Vorlage
                </Button>
              </div>
            </>
          )}

          {/* Custom Template Form */}
          {showCustomForm && (
            <>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="custom-title">Titel der Vorlage</Label>
                  <Input
                    id="custom-title"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="z.B. Zusammenfassung für Einkauf"
                  />
                </div>
                <div>
                  <Label htmlFor="custom-prompt">
                    Anforderungen (Was soll in der Zusammenfassung enthalten sein?)
                  </Label>
                  <Textarea
                    id="custom-prompt"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Extrahiere folgende Informationen aus dem Vertrag:&#10;1. Krankenkasse&#10;2. Preise (alle als Tabelle)&#10;3. ..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Tipp: Listen Sie alle gewünschten Informationen auf. Die KI wird versuchen, alle Daten vollständig zu extrahieren.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateCustomTemplate}
                  disabled={createTemplateMutation.isPending}
                  className="flex-1"
                >
                  {createTemplateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Wird erstellt...
                    </>
                  ) : (
                    "Vorlage erstellen und verwenden"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCustomForm(false)}
                >
                  Zurück
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
