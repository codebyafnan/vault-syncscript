import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, LogOut, BookOpen, FileText, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Vault {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
  role: string;
  source_count: number;
  annotation_count: number;
}

export default function Dashboard() {
  const { user, signOut, profile } = useAuth();
  const navigate = useNavigate();
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [loading, setLoading] = useState(true);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultDesc, setNewVaultDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetchVaults();

    const channel = supabase
      .channel('vault-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vaults' }, () => fetchVaults())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchVaults = async () => {
    if (!profile) return;
    const { data: memberships } = await supabase
      .from('vault_memberships')
      .select('vault_id, role')
      .eq('user_id', profile.id);

    if (!memberships || memberships.length === 0) {
      setVaults([]);
      setLoading(false);
      return;
    }

    const vaultIds = memberships.map(m => m.vault_id);
    const roleMap = Object.fromEntries(memberships.map(m => [m.vault_id, m.role]));

    const { data: vaultData } = await supabase
      .from('vaults')
      .select('*')
      .in('id', vaultIds);

    if (vaultData) {
      const enriched = await Promise.all(vaultData.map(async (v) => {
        const { count: sourceCount } = await supabase.from('sources').select('*', { count: 'exact', head: true }).eq('vault_id', v.id);
        const { data: sources } = await supabase.from('sources').select('id').eq('vault_id', v.id);
        let annotationCount = 0;
        if (sources && sources.length > 0) {
          const { count } = await supabase.from('annotations').select('*', { count: 'exact', head: true }).in('source_id', sources.map(s => s.id));
          annotationCount = count || 0;
        }
        return { ...v, role: roleMap[v.id], source_count: sourceCount || 0, annotation_count: annotationCount };
      }));
      setVaults(enriched);
    }
    setLoading(false);
  };

  const createVault = async () => {
    if (!newVaultName.trim() || !profile) return;
    setCreating(true);
    const { data: vault, error } = await supabase
      .from('vaults')
      .insert({ name: newVaultName, description: newVaultDesc || null, owner_id: profile.id })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
    } else if (vault) {
      await supabase.from('vault_memberships').insert({
        vault_id: vault.id,
        user_id: profile.id,
        role: 'owner',
        invited_by: profile.id,
      });
      toast.success('Vault created!');
      setNewVaultName('');
      setNewVaultDesc('');
      setDialogOpen(false);
      fetchVaults();
    }
    setCreating(false);
  };

  const roleColor = (role: string) => {
    if (role === 'owner') return 'bg-primary/20 text-primary border-primary/30';
    if (role === 'contributor') return 'bg-green-500/20 text-green-400 border-green-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border">
        <h1 className="text-2xl cursor-pointer" onClick={() => navigate('/')} style={{ fontFamily: 'Instrument Serif, serif' }}>
          <span className="text-primary font-bold">Sync</span><span className="text-foreground/70">Script</span>
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{profile?.display_name || user?.email}</span>
          <Button variant="ghost" size="icon" onClick={() => { signOut(); navigate('/'); }}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl text-foreground">Knowledge Vaults</h2>
            <p className="text-muted-foreground mt-1">Your collaborative research spaces</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Vault</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Knowledge Vault</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)} placeholder="e.g. Climate Research 2026" />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input value={newVaultDesc} onChange={(e) => setNewVaultDesc(e.target.value)} placeholder="Brief description..." />
                </div>
                <Button onClick={createVault} disabled={creating || !newVaultName.trim()} className="w-full">
                  {creating ? 'Creating...' : 'Create Vault'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Loading vaults...</div>
        ) : vaults.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl text-foreground mb-2">No vaults yet</h3>
            <p className="text-muted-foreground mb-6">Create your first Knowledge Vault to start organizing research.</p>
            <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" /> Create Vault</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {vaults.map((vault) => (
              <Card
                key={vault.id}
                className="cursor-pointer hover:border-primary/40 transition-all hover:shadow-lg hover:shadow-primary/5"
                onClick={() => navigate(`/vault/${vault.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{vault.name}</CardTitle>
                    <Badge variant="outline" className={roleColor(vault.role)}>
                      {vault.role}
                    </Badge>
                  </div>
                  {vault.description && (
                    <p className="text-sm text-muted-foreground mt-1">{vault.description}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" /> {vault.source_count} sources
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" /> {vault.annotation_count} annotations
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
