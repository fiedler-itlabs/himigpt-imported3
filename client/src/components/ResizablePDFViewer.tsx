import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type ResizablePDFViewerProps = {
  pdfUrl: string;
  initialPage?: number;
  onClose: () => void;
};

export function ResizablePDFViewer({ pdfUrl, initialPage = 1, onClose }: ResizablePDFViewerProps) {
  const [width, setWidth] = useState<number>(() => {
    const saved = localStorage.getItem("pdfViewerWidth");
    return saved ? parseInt(saved, 10) : 600;
  });
  const [isResizing, setIsResizing] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Save width to localStorage
  useEffect(() => {
    localStorage.setItem("pdfViewerWidth", width.toString());
  }, [width]);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setWidth(Math.max(400, Math.min(newWidth, window.innerWidth - 200)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Build PDF URL with initial page parameter
  const pdfUrlWithParams = `${pdfUrl}#page=${initialPage}`;

  return (
    <div
      className="fixed top-0 right-0 h-screen bg-background border-l shadow-lg flex flex-col z-50"
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/50 transition-colors"
        onMouseDown={() => setIsResizing(true)}
      />

      {/* Header */}
      <div className="flex items-center justify-end p-4 border-b bg-muted/50">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* PDF Content */}
      <div className="flex-1 overflow-hidden bg-muted/20">
        <iframe
          ref={iframeRef}
          src={pdfUrlWithParams}
          className="w-full h-full border-0"
          title="PDF Viewer"
        />
      </div>
    </div>
  );
}
