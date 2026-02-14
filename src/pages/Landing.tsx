import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Zap, Search, FileText, Share2 } from 'lucide-react';

const features = [
  { icon: BookOpen, title: 'Knowledge Vaults', desc: 'Organize research into collaborative vaults with role-based access.' },
  { icon: Search, title: 'Smart Sources', desc: 'Add URLs, PDFs, and notes — all searchable and annotatable.' },
  { icon: Users, title: 'Real-time Collaboration', desc: 'Work together with owners, contributors, and viewers.' },
  { icon: FileText, title: 'Inline Annotations', desc: 'Highlight quotes and add contextual notes to any source.' },
  { icon: Share2, title: 'Source Sharing', desc: 'Share vaults and sources with your research team instantly.' },
  { icon: Zap, title: 'Live Sync', desc: 'Real-time updates across all collaborators via live subscriptions.' },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border/50">
        <h1 className="text-2xl tracking-tight">
          <span className="text-primary font-bold" style={{ fontFamily: 'Instrument Serif, serif' }}>Sync</span>
          <span className="text-foreground/70" style={{ fontFamily: 'Instrument Serif, serif' }}>Script</span>
        </h1>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => navigate('/login')}>Sign In</Button>
          <Button onClick={() => navigate('/signup')}>Get Started</Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-32 max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm mb-8 border border-primary/20">
          <Zap className="w-3.5 h-3.5" />
          Collaborative Research Engine
        </div>
        <h1 className="text-5xl md:text-7xl leading-tight mb-6 text-foreground">
          Research Together,<br />
          <span className="text-primary italic">Cite Better</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mb-10 leading-relaxed">
          SyncScript is a collaborative research & citation engine. Create Knowledge Vaults, 
          add sources, annotate findings, and work with your team in real-time.
        </p>
        <div className="flex gap-4">
          <Button size="lg" className="text-base px-8" onClick={() => navigate('/signup')}>
            Start Research →
          </Button>
          <Button size="lg" variant="outline" className="text-base px-8" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-24 max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl text-center mb-16 text-foreground">
          Everything you need to <span className="text-primary italic">research collaboratively</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="p-6 rounded-lg bg-card border border-border hover:border-primary/30 transition-colors">
              <f.icon className="w-8 h-8 text-primary mb-4" />
              <h3 className="text-xl mb-2 text-foreground" style={{ fontFamily: 'Instrument Serif, serif' }}>{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <div className="max-w-2xl mx-auto p-12 rounded-2xl bg-card border border-border">
          <h2 className="text-3xl mb-4 text-foreground">Ready to collaborate?</h2>
          <p className="text-muted-foreground mb-8">Join SyncScript and start building your research library today.</p>
          <Button size="lg" className="text-base px-10" onClick={() => navigate('/signup')}>
            Create Free Account
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 SyncScript. Built for researchers, by researchers.</p>
        <a 
          href="https://github.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline mt-2 inline-block"
        >
          View on GitHub →
        </a>
      </footer>
    </div>
  );
}
