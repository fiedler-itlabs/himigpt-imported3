import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingDown, TrendingUp, Minus, FileSpreadsheet, FileText, Download, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";

export type ComparisonData = {
  insuranceCompany: string;
  contractName: string;
  price?: string;
  conditions?: string[];
  pageNumber: number;
};

type ComparisonTableProps = {
  data: ComparisonData[];
  positionNumber?: string;
};

export function ComparisonTable({ data, positionNumber }: ComparisonTableProps) {
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const exportMutation = trpc.export.comparisonTable.useMutation({
    onSuccess: (result) => {
      // Download the file
      const link = document.createElement('a');
      link.href = result.url;
      link.download = result.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setExportingFormat(null);
    },
    onError: (error) => {
      console.error('Export failed:', error);
      alert('Export fehlgeschlagen. Bitte versuchen Sie es erneut.');
      setExportingFormat(null);
    },
  });

  const handleExport = (format: 'xlsx' | 'pdf') => {
    setExportingFormat(format);
    exportMutation.mutate({
      data,
      positionNumber,
      format,
    });
  };

  if (!data || data.length === 0) {
    return null;
  }

  // Find best price (lowest)
  const prices = data
    .filter(d => d.price)
    .map(d => ({
      company: d.insuranceCompany,
      priceStr: d.price!,
      priceNum: parseFloat(d.price!.replace(/[^\d,]/g, '').replace(',', '.'))
    }))
    .filter(p => !isNaN(p.priceNum));

  const bestPrice = prices.length > 0 ? Math.min(...prices.map(p => p.priceNum)) : null;
  const worstPrice = prices.length > 0 ? Math.max(...prices.map(p => p.priceNum)) : null;

  return (
    <Card className="my-4 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <span>Vertragsvergleich</span>
            {positionNumber && (
              <Badge variant="outline" className="font-mono">
                {positionNumber}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('xlsx')}
              disabled={exportingFormat !== null}
              className="gap-2"
            >
              {exportingFormat === 'xlsx' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('pdf')}
              disabled={exportingFormat !== null}
              className="gap-2"
            >
              {exportingFormat === 'pdf' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, idx) => {
            const priceNum = item.price
              ? parseFloat(item.price.replace(/[^\d,]/g, '').replace(',', '.'))
              : null;

            const isBestPrice = priceNum !== null && bestPrice !== null && priceNum === bestPrice;
            const isWorstPrice = priceNum !== null && worstPrice !== null && priceNum === worstPrice && bestPrice !== worstPrice;

            return (
              <div
                key={idx}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  isBestPrice
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : isWorstPrice
                    ? 'border-red-500 bg-red-50 dark:bg-red-950/20'
                    : 'border-border bg-card'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-base flex items-center gap-2">
                      {item.insuranceCompany}
                      {isBestPrice && (
                        <Badge variant="default" className="bg-green-600 text-white">
                          <TrendingDown className="w-3 h-3 mr-1" />
                          Günstigster Preis
                        </Badge>
                      )}
                      {isWorstPrice && (
                        <Badge variant="destructive">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          Teuerster Preis
                        </Badge>
                      )}
                    </h4>
                    <p className="text-sm text-muted-foreground">{item.contractName}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Seite {item.pageNumber}
                  </Badge>
                </div>

                {item.price ? (
                  <div className="mb-2">
                    <span className="text-2xl font-bold text-primary">{item.price}</span>
                  </div>
                ) : (
                  <div className="mb-2">
                    <span className="text-sm text-muted-foreground italic flex items-center gap-1">
                      <Minus className="w-4 h-4" />
                      Keine Preisinformation verfügbar
                    </span>
                  </div>
                )}

                {item.conditions && item.conditions.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">
                      Konditionen:
                    </p>
                    <ul className="text-sm space-y-1">
                      {item.conditions.map((condition, cidx) => (
                        <li key={cidx} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          <span>{condition}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.length > 1 && bestPrice && worstPrice && bestPrice !== worstPrice && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Preisdifferenz:</strong>{' '}
              {((worstPrice - bestPrice) / bestPrice * 100).toFixed(1)}% (
              {(worstPrice - bestPrice).toFixed(2)} €)
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
