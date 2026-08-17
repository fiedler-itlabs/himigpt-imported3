import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Plus,
  Send,
  Loader2,
  FileText,
  Trash2,
  ChevronLeft,
  ExternalLink,
  Sparkles,
  User,
  Menu,
  X,
  Home,
  ThumbsUp,
  ThumbsDown,
  Settings,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { ComparisonTable, type ComparisonData } from "@/components/ComparisonTable";
import { ResizablePDFViewer } from "@/components/ResizablePDFViewer";
import { ContractSelectorModal } from "@/components/ContractSelectorModal";
import { ThemeToggle } from "@/components/ThemeToggle";

type Source = {
  contractId: number;
  contractName: string;
  pageNumber: number;
  excerpt: string;
};

function FeedbackButtons({ messageId, currentFeedback }: { messageId: number; currentFeedback?: string | null }) {
  const [feedback, setFeedback] = useState<string | null>(currentFeedback || null);
  const submitFeedbackMutation = trpc.chats.submitFeedback.useMutation({
    onSuccess: (_, variables) => {
      setFeedback(variables.feedback);
    },
  });

  const handleFeedback = (type: "positive" | "negative") => {
    if (feedback === type) return; // Already submitted
    submitFeedbackMutation.mutate({ messageId, feedback: type });
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={() => handleFeedback("positive")}
        disabled={submitFeedbackMutation.isPending}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          feedback === "positive"
            ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
            : "hover:bg-accent text-muted-foreground hover:text-foreground"
        )}
        title="Hilfreiche Antwort"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <button
        onClick={() => handleFeedback("negative")}
        disabled={submitFeedbackMutation.isPending}
        className={cn(
          "p-1.5 rounded-md transition-colors",
          feedback === "negative"
            ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
            : "hover:bg-accent text-muted-foreground hover:text-foreground"
        )}
        title="Nicht hilfreiche Antwort"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Chat() {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const params = useParams<{ chatId?: string }>();
  const chatId = params.chatId ? parseInt(params.chatId) : null;

  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string>("");
  const [selectedPdfPage, setSelectedPdfPage] = useState<number>(1);
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const chatsQuery = trpc.chats.list.useQuery(undefined, { enabled: !!user });
  const contractsQuery = trpc.contracts.list.useQuery(undefined, { enabled: !!user });
  const messagesQuery = trpc.chats.getMessages.useQuery(
    { chatId: chatId! },
    { enabled: !!chatId && !!user }
  );


  // Mutations
  const createChatMutation = trpc.chats.create.useMutation({
    onSuccess: (chat) => {
      setLocation(`/chat/${chat.id}`);
      chatsQuery.refetch();
    },
  });

  const updateScopeMutation = trpc.chats.updateScope.useMutation({
    onSuccess: () => {
      chatsQuery.refetch();
      setScopeModalOpen(false);
    },
  });

  const sendMessageMutation = trpc.chats.sendMessage.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.chats.getMessages.cancel();
      
      // Snapshot previous value
      const previousMessages = utils.chats.getMessages.getData({ chatId: variables.chatId });
      
      // Optimistically update to show user message immediately
      utils.chats.getMessages.setData({ chatId: variables.chatId }, (old) => {
        if (!old) return old;
        return [
          ...old,
          {
            id: Date.now(), // Temporary ID
            chatId: variables.chatId,
            role: 'user' as const,
            content: variables.content,
            sources: null,
            comparisonData: null,
            feedback: null,
            createdAt: new Date(),
          },
        ];
      });
      
      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        utils.chats.getMessages.setData({ chatId: _variables.chatId }, context.previousMessages);
      }
    },
    onSuccess: () => {
      messagesQuery.refetch();
      chatsQuery.refetch();
    },
  });

  const deleteChatMutation = trpc.chats.delete.useMutation({
    onSuccess: () => {
      chatsQuery.refetch();
      if (chatId) {
        setLocation("/chat");
      }
    },
  });

  // Scroll to bottom when messages change or when sending
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data, sendMessageMutation.isPending]);
  
  // Also scroll immediately after optimistic update
  useEffect(() => {
    if (sendMessageMutation.variables) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [sendMessageMutation.variables]);

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || sendMessageMutation.isPending) return;

    let targetChatId = chatId;

    // Create new chat if none selected
    if (!targetChatId) {
      const newChat = await createChatMutation.mutateAsync();
      targetChatId = newChat.id;
    }

    const message = input.trim();
    setInput("");

    await sendMessageMutation.mutateAsync({
      chatId: targetChatId,
      content: message,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const utils = trpc.useUtils();
  const [fetchingPdfUrl, setFetchingPdfUrl] = useState(false);

  const openPdfViewer = async (contractId: number, page: number) => {
    try {
      setFetchingPdfUrl(true);
      const result = await utils.client.pdf.getUrl.query({ contractId });
      if (result?.url) {
        setSelectedPdfUrl(result.url);
        setSelectedPdfPage(page);
        setPdfViewerOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch PDF URL:', error);
    } finally {
      setFetchingPdfUrl(false);
    }
  };

  const closePdfViewer = () => {
    setPdfViewerOpen(false);
    setSelectedPdfUrl("");
    setSelectedPdfPage(1);
  };

  // Auth loading state
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
          <p className="text-muted-foreground">
            Um den Chat zu nutzen, müssen Sie angemeldet sein.
          </p>
          <Button onClick={() => (window.location.href = getLoginUrl())}>
            Anmelden
          </Button>
        </div>
      </div>
    );
  }

  const messages = messagesQuery.data ?? [];
  const chats = chatsQuery.data ?? [];

  return (
    <div className="h-screen flex bg-background relative">
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className={cn(
          "fixed top-4 left-4 z-40 lg:hidden",
          sidebarOpen && "hidden"
        )}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Overlay Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "border-r bg-sidebar flex flex-col transition-all duration-300",
          "lg:relative lg:translate-x-0",
          "fixed inset-y-0 left-0 z-50",
          sidebarOpen ? "w-72 translate-x-0" : "w-72 -translate-x-full lg:w-0 lg:overflow-hidden"
        )}
      >
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-text.svg" alt="HimiGPT" className="h-8 -ml-2" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-3">
          <Button
            className="w-full justify-start gap-2"
            onClick={() => setSelectorOpen(true)}
            disabled={createChatMutation.isPending}
          >
            <Plus className="h-4 w-4" />
            Neuer Chat
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {chatsQuery.isLoading ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : chats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Keine Chats vorhanden
              </p>
            ) : (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                    chatId === chat.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "hover:bg-sidebar-accent/50"
                  )}
                  onClick={() => setLocation(`/chat/${chat.id}`)}
                  title={chat.scopedContractIds ? `Durchsucht ${chat.scopedContractIds.length} Verträge` : "Durchsucht alle Verträge"}
                >
                  <span className="shrink-0">{chat.scopedContractIds ? "📋" : "💬"}</span>
                  <span className="truncate flex-1">{chat.title}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("Chat wirklich löschen?")) {
                        deleteChatMutation.mutate({ id: chat.id });
                      }
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => setLocation("/")}
          >
            <Home className="h-4 w-4" />
            Startseite
          </Button>
          {user.role === "admin" && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => setLocation("/contracts")}
            >
              <FileText className="h-4 w-4" />
              Verträge verwalten
            </Button>
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Header */}
        <header className="h-14 glass-header flex items-center px-4 gap-4">
          {!sidebarOpen && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-medium truncate">
              {chatId
                ? chats.find((c) => c.id === chatId)?.title ?? "Chat"
                : "Neuer Chat"}
            </h1>
            {chatId && (() => {
              const currentChat = chats.find((c) => c.id === chatId);
              const scopedIds = currentChat?.scopedContractIds;
              const hasMessages = messages.length > 0;
              if (scopedIds && scopedIds.length > 0) {
                const allContracts = contractsQuery.data || [];
                const scopedContracts = allContracts.filter((c) => scopedIds.includes(c.id));
                return (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>
                      📋 {scopedContracts.length} {scopedContracts.length === 1 ? "Vertrag" : "Verträge"}:
                      {" "}
                      {scopedContracts.slice(0, 2).map((c) => c.insuranceCompany || c.name).join(", ")}
                      {scopedContracts.length > 2 && ` +${scopedContracts.length - 2} weitere`}
                    </span>
                    {!hasMessages && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-xs"
                        onClick={() => setScopeModalOpen(true)}
                      >
                        <Settings className="h-3 w-3 mr-1" />
                        Ändern
                      </Button>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
          <ThemeToggle />
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto space-y-6">
            {!chatId && messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">
                  Willkommen bei HimiGPT
                </h2>
                <p className="text-muted-foreground max-w-md mb-8">
                  Stellen Sie Fragen zu Ihren Krankenkassenverträgen. Ich finde
                  die relevanten Informationen und zeige Ihnen die Quellen.
                </p>
                <div className="grid gap-3 max-w-md w-full">
                  <SuggestedPrompt
                    text="Was zahlt die AOK Bayern für eine mobile Pumpe?"
                    onClick={(text) => setInput(text)}
                  />
                  <SuggestedPrompt
                    text="Welche Verträge haben wir mit der IKK classic?"
                    onClick={(text) => setInput(text)}
                  />
                  <SuggestedPrompt
                    text="Was sind die Vergütungssätze für Treppensteighilfen?"
                    onClick={(text) => setInput(text)}
                  />
                </div>
              </div>
            ) : (
              messages
                .filter((m) => m.role !== "system")
                .map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-4",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {message.role === "assistant" && (
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-4 py-3",
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      {message.role === "assistant" ? (
                        <>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <Streamdown>{message.content}</Streamdown>
                          </div>
                          
                          {/* Comparison Table */}
                          {(message as any).isComparison && (message as any).comparisonData && (
                            <ComparisonTable 
                              data={(message as any).comparisonData as ComparisonData[]} 
                              positionNumber={(message as any).positionNumber}
                            />
                          )}
                        </>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}

                      {/* Sources */}
                      {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">
                            Quellen:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(message.sources as Source[]).map((source, idx) => (
                              <button
                                key={idx}
                                onClick={() =>
                                  openPdfViewer(source.contractId, source.pageNumber)
                                }
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background hover:bg-accent text-xs transition-colors"
                              >
                                <FileText className="h-3 w-3" />
                                <span className="truncate max-w-[150px]">
                                  {source.contractName}
                                </span>
                                <span className="text-primary font-medium">
                                  S. {source.pageNumber}
                                </span>
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {message.role === "assistant" && (
                        <FeedbackButtons messageId={message.id} currentFeedback={message.feedback} />
                      )}
                    </div>

                    {message.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))
            )}

            {sendMessageMutation.isPending && (
              <div className="flex gap-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="border-t p-4 bg-background sticky bottom-0 z-10">
          <div className="max-w-3xl mx-auto flex gap-3">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frage zu Ihren Verträgen..."
              className="min-h-[44px] max-h-32 resize-none"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || sendMessageMutation.isPending}
              size="icon"
              className="h-11 w-11 shrink-0"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* PDF Viewer Sidebar */}
      {pdfViewerOpen && selectedPdfUrl && (
        <ResizablePDFViewer
          pdfUrl={selectedPdfUrl}
          initialPage={selectedPdfPage}
          onClose={closePdfViewer}
        />
      )}

      {/* Contract Selector Modal */}
      <ContractSelectorModal
        open={selectorOpen}
        onOpenChange={setSelectorOpen}
        contracts={contractsQuery.data || []}
        onConfirm={async (contractIds) => {
          const chat = await createChatMutation.mutateAsync({
            contractIds: contractIds === null ? undefined : contractIds,
          });
          setLocation(`/chat/${chat.id}`);
        }}
      />

      {/* Scope Change Modal */}
      {chatId && (() => {
        const currentChat = chats.find((c) => c.id === chatId);
        return (
          <ContractSelectorModal
            open={scopeModalOpen}
            onOpenChange={setScopeModalOpen}
            contracts={contractsQuery.data || []}
            initialSelection={currentChat?.scopedContractIds || []}
            onConfirm={async (contractIds) => {
              await updateScopeMutation.mutateAsync({
                id: chatId,
                contractIds: contractIds === null ? null : contractIds,
              });
              setScopeModalOpen(false);
              chatsQuery.refetch();
            }}
          />
        );
      })()}
    </div>
  );
}

function SuggestedPrompt({
  text,
  onClick,
}: {
  text: string;
  onClick: (text: string) => void;
}) {
  return (
    <button
      onClick={() => onClick(text)}
      className="text-left px-4 py-3 rounded-xl border bg-card hover:bg-accent transition-colors text-sm"
    >
      {text}
    </button>
  );
}
