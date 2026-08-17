import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, FileDown, Loader2, FileText } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface SummarySidebarProps {
  open: boolean;
  onClose: () => void;
  summaryId: number;
}

export function SummarySidebar({ open, onClose, summaryId }: SummarySidebarProps) {
  const [exportingWord, setExportingWord] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const summaryQuery = trpc.summaries.get.useQuery(
    { id: summaryId },
    { enabled: open && summaryId > 0 }
  );

  const summary = summaryQuery.data;

  const exportWordMutation = trpc.summaries.exportWord.useMutation();

  const handleExportWord = async () => {
    if (!summary) return;
    setExportingWord(true);
    try {
      const result = await exportWordMutation.mutateAsync({ id: summaryId });
      const blob = new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Word-Dokument erfolgreich heruntergeladen");
    } catch (error) {
      toast.error("Fehler beim Exportieren");
      console.error(error);
    } finally {
      setExportingWord(false);
    }
  };

  const exportPdfMutation = trpc.summaries.exportPdf.useMutation();

  const handleExportPdf = async () => {
    if (!summary) return;
    setExportingPdf(true);
    try {
      const result = await exportPdfMutation.mutateAsync({ id: summaryId });
      const blob = new Blob([Uint8Array.from(atob(result.data), c => c.charCodeAt(0))], {
        type: 'application/pdf'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF erfolgreich heruntergeladen");
    } catch (error) {
      toast.error("PDF-Export noch nicht verfügbar - bitte Word verwenden");
      console.error(error);
    } finally {
      setExportingPdf(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h2 className="font-semibold">Zusammenfassung</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportWord}
            disabled={exportingWord || !summary}
          >
            {exportingWord ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                Word
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={exportingPdf || !summary}
          >
            {exportingPdf ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                PDF
              </>
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {summaryQuery.isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Zusammenfassung wird geladen...</p>
            </div>
          </div>
        ) : summary ? (
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
              {summary.content}
            </Markdown>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Zusammenfassung nicht gefunden</p>
          </div>
        )}
      </div>
    </div>
  );
}
