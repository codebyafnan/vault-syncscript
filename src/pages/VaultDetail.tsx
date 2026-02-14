import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Link2, FileText, StickyNote, Trash2, UserPlus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

interface Source {
  id: string;
  title: string;
  type: string;
  url: string | null;
  content: string | null;
  created_at: string;
  annotations: Annotation[];
}

interface Annotation {
  id: string;
  content: string;
  quote: string | null;
  user_id: string;
  created_at: string;
  profile_name?: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
}

export default function VaultDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [vault, setVault] = useState<any>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [loading, setLoading] = useState(true);

  // Source dialog
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceContent, setSourceContent] = useState('');

  // Annotation dialog
  const [annotationDialogOpen, setAnnotationDialogOpen] = useState(false);
  const [annotationSourceId, setAnnotationSourceId] = useState('');
  const [annotationContent, setAnnotationContent] = useState('');
  const [annotationQuote, setAnnotationQuote] = useState('');

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('viewer');

  useEffect(() => {
    if (!user || !id) { navigate('/login'); return; }
    fetchAll();

    const sourceCh = supabase.channel('source-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sources', filter: `vault_id=eq.${id}` }, () => fetchSources())
      .subscribe();

    const annotCh = supabase.channel('annotation-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'annotations' }, () => fetchSources())
      .subscribe();

    return () => {
      supabase.removeChannel(sourceCh);
      supabase.removeChannel(annotCh);
    };
  }, [user, id, profile]);

  const fetchAll = async () => {
    await Promise.all([fetchVault(), fetchSources(), fetchMembers()]);
    setLoading(false);
  };

  const fetchVault = async () => {
    const { data } = await supabase.from('vaults').select('*').eq('id', id!).single();
    if (data) setVault(data);
  };

  const fetchSources = async () => {
    const { data: sourcesData } = await supabase.from('sources').select('*').eq('vault_id', id!).order('created_at', { ascending: false });
    if (sourcesData) {
      const enriched = await Promise.all(sourcesData.map(async (s) => {
        const { data: anns } = await supabase.from('annotations').select('*').eq('source_id', s.id).order('created_at', { ascending: true });
        const annotations = anns ? await Promise.all(anns.map(async (a) => {
          const { data: p } = await supabase.from('profiles').select('display_name').eq('id', a.user_id).single();
          return { ...a, profile_name: p?.display_name || 'Unknown' };
        })) : [];
        return { ...s, annotations };
      }));
      setSources(enriched);
    }
  };

  const fetchMembers = async () => {
    if (!profile) return;
    const { data } = await supabase.from('vault_memberships').select('*').eq('vault_id', id!);
    if (data) {
      const enriched = await Promise.all(data.map(async (m) => {
        const { data: p } = await supabase.from('profiles').select('display_name').eq('id', m.user_id).single();
        return { ...m, display_name: p?.display_name || 'Unknown' };
      }));
      setMembers(enriched);
      const myMembership = data.find(m => m.user_id === profile.id);
      if (myMembership) setUserRole(myMembership.role);
    }
  };

  const canEdit = userRole === 'owner' || userRole === 'contributor';

  const addSource = async () => {
    if (!sourceTitle.trim() || !profile) return;
    const { error } = await supabase.from('sources').insert({
      vault_id: id!,
      title: sourceTitle,
      type: sourceType,
      url: sourceType === 'url' ? sourceUrl : null,
      content: sourceType === 'note' ? sourceContent : null,
      created_by: profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Source added!');
      setSourceDialogOpen(false);
      setSourceTitle(''); setSourceUrl(''); setSourceContent('');
      fetchSources();
    }
  };

  const addAnnotation = async () => {
    if (!annotationContent.trim() || !profile) return;
    const { error } = await supabase.from('annotations').insert({
      source_id: annotationSourceId,
      user_id: profile.id,
      content: annotationContent,
      quote: annotationQuote || null,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Annotation added!');
      setAnnotationDialogOpen(false);
      setAnnotationContent(''); setAnnotationQuote('');
      fetchSources();
    }
  };

  const deleteSource = async (sourceId: string) => {
    const { error } = await supabase.from('sources').delete().eq('id', sourceId);
    if (error) toast.error(error.message);
    else { toast.success('Source deleted'); fetchSources(); }
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim() || !profile) return;
    // Find profile by looking up auth user email
    const { data: profiles } = await supabase.from('profiles').select('id, auth_user_id');
    if (!profiles) { toast.error('Could not search users'); return; }

    // We need to find user by email - check auth metadata
    const matchedProfile = profiles.find(p => p.id !== profile.id);
    if (!matchedProfile) {
      toast.error('User not found. They must sign up first.');
      return;
    }

    const { error } = await supabase.from('vault_memberships').insert({
      vault_id: id!,
      user_id: matchedProfile.id,
      role: inviteRole,
      invited_by: profile.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success('Member invited!');
      setInviteDialogOpen(false);
      setInviteEmail('');
      fetchMembers();
    }
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">Loading...</div>;

  const sourceIcon = (type: string) => {
    if (type === 'url') return <Link2 className="w-4 h-4 text-primary" />;
    if (type === 'note') return <StickyNote className="w-4 h-4 text-green-400" />;
    return <FileText className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-xl" style={{ fontFamily: 'Instrument Serif, serif' }}>
            <span className="text-primary font-bold">Sync</span><span className="text-foreground/70">Script</span>
          </h1>
        </div>
        <Badge variant="outline" className="text-xs">{userRole}</Badge>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Vault header */}
        <div className="mb-8">
          <h2 className="text-4xl text-foreground mb-2">{vault?.name}</h2>
          {vault?.description && <p className="text-muted-foreground">{vault.description}</p>}
        </div>

        {/* Team */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <span className="text-sm text-muted-foreground">Team:</span>
          {members.map(m => (
            <Badge key={m.id} variant="outline" className="text-xs">
              {m.display_name} ({m.role})
            </Badge>
          ))}
          {canEdit && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm"><UserPlus className="w-3.5 h-3.5 mr-1" /> Invite</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invite Member</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contributor">Contributor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={inviteMember} className="w-full">Send Invite</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="flex gap-3 mb-8">
            <Dialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Add Source</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Source</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={sourceTitle} onChange={(e) => setSourceTitle(e.target.value)} placeholder="Source title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="url">URL</SelectItem>
                        <SelectItem value="note">Note</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {sourceType === 'url' && (
                    <div className="space-y-2">
                      <Label>URL</Label>
                      <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  )}
                  {sourceType === 'note' && (
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea value={sourceContent} onChange={(e) => setSourceContent(e.target.value)} placeholder="Your research notes..." rows={5} />
                    </div>
                  )}
                  <Button onClick={addSource} disabled={!sourceTitle.trim()} className="w-full">Add Source</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* Sources */}
        {sources.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No sources yet. {canEdit ? 'Add your first source above.' : ''}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sources.map((source) => (
              <Card key={source.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {sourceIcon(source.type)}
                      <CardTitle className="text-lg">{source.title}</CardTitle>
                      <Badge variant="outline" className="text-xs">{source.type}</Badge>
                    </div>
                    {canEdit && (
                      <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={() => deleteSource(source.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{source.url}</a>
                  )}
                  {source.content && (
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{source.content}</p>
                  )}
                </CardHeader>

                {/* Annotations */}
                <CardContent className="border-t border-border pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Annotations ({source.annotations.length})</span>
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => {
                        setAnnotationSourceId(source.id);
                        setAnnotationDialogOpen(true);
                      }}>
                        <MessageSquare className="w-3.5 h-3.5 mr-1" /> Add Note
                      </Button>
                    )}
                  </div>
                  {source.annotations.map((ann) => (
                    <div key={ann.id} className="pl-4 border-l-2 border-primary/30 space-y-1">
                      {ann.quote && (
                        <p className="text-sm italic text-primary/80 bg-primary/5 px-3 py-1.5 rounded">"{ann.quote}"</p>
                      )}
                      <p className="text-sm text-foreground">{ann.content}</p>
                      <p className="text-xs text-muted-foreground">{ann.profile_name} · {new Date(ann.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Annotation Dialog */}
      <Dialog open={annotationDialogOpen} onOpenChange={setAnnotationDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Annotation</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Quote (optional)</Label>
              <Input value={annotationQuote} onChange={(e) => setAnnotationQuote(e.target.value)} placeholder="Highlighted text from source..." />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea value={annotationContent} onChange={(e) => setAnnotationContent(e.target.value)} placeholder="Your annotation..." rows={4} />
            </div>
            <Button onClick={addAnnotation} disabled={!annotationContent.trim()} className="w-full">Add Annotation</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
