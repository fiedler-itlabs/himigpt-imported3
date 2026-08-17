import { Button } from "@/components/ui/button";
import { X, FileText, FileSpreadsheet, Save, Loader2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
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

interface ComparisonViewerProps {
  open: boolean;
  onClose: () => void;
  comparison: {
    query: string;
    summary: string;
    contractNames: string[];
    contractIds: number[];
  } | null;
}

export function ComparisonViewer({ open, onClose, comparison }: ComparisonViewerProps) {
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const exportExcelMutation = trpc.comparison.exportExcel.useMutation();
  const exportPdfMutation = trpc.comparison.exportPdf.useMutation();
  const saveMutation = trpc.comparison.save.useMutation();

  if (!open || !comparison) return null;

  const handleExportExcel = async () => {
    setExporting('excel');
    try {
      const { url } = await exportExcelMutation.mutateAsync({
        query: comparison.query,
        contractIds: comparison.contractIds,
        result: comparison.summary,
      });

      // Download file
      const a = document.createElement('a');
      a.href = url;
      a.download = `vergleich-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('Excel-Export erfolgreich!');
    } catch (error) {
      toast.error('Excel-Export fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const handleExportPdf = async () => {
    setExporting('pdf');
    try {
      const { url } = await exportPdfMutation.mutateAsync({
        query: comparison.query,
        contractIds: comparison.contractIds,
        result: comparison.summary,
      });

      // Download file
      const a = document.createElement('a');
      a.href = url;
      a.download = `vergleich-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('PDF-Export erfolgreich!');
    } catch (error) {
      toast.error('PDF-Export fehlgeschlagen');
    } finally {
      setExporting(null);
    }
  };

  const handleSave = async () => {
    if (!saveName.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setSaving(true);
    try {
      await saveMutation.mutateAsync({
        name: saveName,
        query: comparison.query,
        contractIds: comparison.contractIds,
        result: comparison.summary,
      });

      toast.success('Vergleich gespeichert!');
      setSaveDialogOpen(false);
      setSaveName('');
    } catch (error) {
      toast.error('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[700px] bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="font-semibold">Vertragsvergleich</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting !== null}
          >
            {exporting === 'excel' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            <span className="ml-2">Excel</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exporting !== null}
          >
            {exporting === 'pdf' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            <span className="ml-2">PDF</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSaveDialogOpen(true)}
          >
            <Save className="h-4 w-4" />
            <span className="ml-2">Speichern</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Query */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
          <div className="text-sm font-medium text-muted-foreground mb-1">Vergleichsfrage:</div>
          <div className="font-medium">{comparison.query}</div>
        </div>

        {/* Contracts */}
        <div className="mb-6">
          <div className="text-sm font-medium text-muted-foreground mb-2">
            Verglichene Verträge ({comparison.contractNames.length}):
          </div>
          <div className="space-y-1">
            {comparison.contractNames.map((name, idx) => (
              <div key={idx} className="text-sm flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-medium">
                  {idx + 1}
                </span>
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Comparison Result */}
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-2xl font-bold mb-4 mt-6 pb-2 border-b">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-xl font-semibold mb-3 mt-5 text-primary">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-medium mb-2 mt-4">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="mb-3 leading-relaxed text-foreground/90">{children}</p>
              ),
              ul: ({ children }) => (
                <ul className="space-y-2 mb-4 ml-4">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2 mb-4 ml-4">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="leading-relaxed">{children}</li>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full divide-y divide-border">{children}</table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-muted">{children}</thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-border">{children}</tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-muted/50 transition-colors">{children}</tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-2 text-left text-sm font-semibold">{children}</th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-2 text-sm">{children}</td>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary pl-4 py-2 my-4 bg-muted/30 italic">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
              ),
            }}
          >
            {comparison.summary}
          </Markdown>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vergleich speichern</DialogTitle>
            <DialogDescription>
              Geben Sie einen Namen für diesen Vergleich ein, um ihn später wiederzufinden.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="z.B. IKK vs Spektrum K Gültigkeitsdaten"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
