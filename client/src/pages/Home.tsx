import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { MessageSquare, FileText, Shield, Zap, ArrowRight, CheckCircle, BarChart3, MessagesSquare, BookOpen, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation } from "wouter";
import { ContractSelectorModal } from "@/components/ContractSelectorModal";
import { trpc } from "@/lib/trpc";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [selectorOpen, setSelectorOpen] = useState(false);
  
  // Fetch contracts for selector
  const { data: contracts = [] } = trpc.contracts.list.useQuery();
  const { data: stats } = trpc.stats.dashboard.useQuery();
  const createChatMutation = trpc.chats.create.useMutation();

  // DEV MODE: Create mock user for testing
  const isDev = import.meta.env.DEV;
  const effectiveUser = user || (isDev ? { name: 'Dev User', email: 'dev@example.com', role: 'admin' as const, id: 0, openId: '', loginMethod: null, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Laden...</div>
      </div>
    );
  }

  // If user is logged in, redirect to chat
  if (effectiveUser) {
    return (
      <div className="min-h-screen gradient-bg">
        <header className="glass-header sticky top-0 z-50">
          <div className="container flex h-14 sm:h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo-text.svg" alt="HimiGPT" className="h-8" />
            </div>
            <nav className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/chat")} className="hidden sm:flex">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setLocation("/chat")} className="sm:hidden">
                <MessageSquare className="h-4 w-4" />
              </Button>
              {effectiveUser.role === "admin" && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/contracts")} className="hidden sm:flex">
                    <FileText className="h-4 w-4 mr-2" />
                    Verträge
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setLocation("/contracts")} className="sm:hidden">
                    <FileText className="h-4 w-4" />
                  </Button>
                </>
              )}
              <ThemeToggle />
              <div className="text-sm text-muted-foreground hidden md:block">
                {effectiveUser.name || effectiveUser.email}
              </div>
            </nav>
          </div>
        </header>

        <main className="container py-12">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            <h1 className="text-4xl font-bold tracking-tight">
              Willkommen zurück, {effectiveUser.name?.split(" ")[0] || "Nutzer"}!
            </h1>
            <p className="text-xl text-muted-foreground">
              Stellen Sie Fragen zu Ihren Krankenkassenverträgen oder verwalten Sie Ihre Dokumente.
            </p>
            
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                <StatsCard
                  icon={FileText}
                  label="Verträge"
                  value={stats.totalContracts}
                  subtext={`${stats.readyContracts} bereit`}
                />
                <StatsCard
                  icon={MessagesSquare}
                  label="Chats"
                  value={stats.totalChats}
                  subtext={`${stats.totalMessages} Nachrichten`}
                />
                <StatsCard
                  icon={BookOpen}
                  label="Seiten"
                  value={stats.totalPages}
                  subtext="Gesamt"
                />
                <StatsCard
                  icon={TrendingUp}
                  label="Letzte 7 Tage"
                  value={stats.recentChats}
                  subtext="Neue Chats"
                />
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Button size="lg" onClick={() => setSelectorOpen(true)} className="gap-2">
                <MessageSquare className="h-5 w-5" />
                Neuen Chat starten
                <ArrowRight className="h-4 w-4" />
              </Button>
              {effectiveUser.role === "admin" && (
                <Button size="lg" variant="outline" onClick={() => setLocation("/contracts")} className="gap-2">
                  <FileText className="h-5 w-5" />
                  Verträge verwalten
                </Button>
              )}
            </div>
          </div>
        </main>
        
        {/* Contract Selector Modal */}
        <ContractSelectorModal
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          contracts={contracts}
          onConfirm={async (contractIds) => {
            const chat = await createChatMutation.mutateAsync({
              contractIds: contractIds || undefined,
            });
            setLocation(`/chat/${chat.id}`);
          }}
        />
      </div>
    );
  }

  // Landing page for non-logged-in users
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo-text.svg" alt="HimiGPT" className="h-8" />
          </div>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            Anmelden
          </Button>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="container py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
              Revolutionieren Sie Ihr{" "}
              <span className="text-primary">Vertragsmanagement</span> mit KI
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              HimiGPT ermöglicht Ihnen präzisen und sekundenschnellen Zugriff auf alle 
              Informationen in Ihren Krankenkassenverträgen.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => window.location.href = getLoginUrl()} className="gap-2">
                Jetzt starten
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-20 border-t">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">
              Funktionen von HimiGPT
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={MessageSquare}
                title="KI-gestützter Chat"
                description="Stellen Sie natürlichsprachige Fragen zu Ihren Verträgen und erhalten Sie präzise Antworten in Sekundenschnelle."
              />
              <FeatureCard
                icon={FileText}
                title="Quellenangaben"
                description="Jede Antwort enthält klickbare Seitenzahlen, die Sie direkt zur relevanten Stelle im Vertrag führen."
              />
              <FeatureCard
                icon={Shield}
                title="Datensicherheit"
                description="Ihre Vertragsdaten werden streng vertraulich behandelt und nicht an Dritte weitergegeben."
              />
              <FeatureCard
                icon={Zap}
                title="Schnelle Verarbeitung"
                description="Laden Sie PDFs hoch und das System extrahiert automatisch alle relevanten Informationen."
              />
              <FeatureCard
                icon={CheckCircle}
                title="Hohe Genauigkeit"
                description="Modernste KI-Technologie sorgt für präzise Antworten mit Quellenangaben."
              />
              <FeatureCard
                icon={FileText}
                title="Vertragsverwaltung"
                description="Verwalten Sie alle Ihre Verträge an einem zentralen Ort mit übersichtlicher Tabellenansicht."
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container py-20 border-t">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-3xl font-bold">
              Bereit, Ihr Vertragsmanagement zu revolutionieren?
            </h2>
            <p className="text-muted-foreground">
              Melden Sie sich jetzt an und erleben Sie die Zukunft der Vertragsanalyse.
            </p>
            <Button size="lg" onClick={() => window.location.href = getLoginUrl()}>
              Kostenlos starten
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8">
        <div className="container text-center text-sm text-muted-foreground">
          © 2024 HimiGPT. Alle Rechte vorbehalten.
        </div>
      </footer>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  subtext: string;
}) {
  return (
    <div className="p-6 rounded-xl glass-card hover:shadow-xl transition-all duration-300">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className="text-3xl font-bold">{value.toLocaleString('de-DE')}</div>
      <div className="text-xs text-muted-foreground mt-1">{subtext}</div>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  title, 
  description 
}: { 
  icon: React.ComponentType<{ className?: string }>; 
  title: string; 
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border bg-card hover:shadow-md transition-shadow">
      <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
