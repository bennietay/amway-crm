import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, collection, addDoc, query, where, onSnapshot, orderBy, getDocFromServer, deleteDoc } from 'firebase/firestore';
import { Lead, Activity } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { generateIcebreaker } from '../services/geminiService';
import { toast } from 'sonner';
import { 
  X, 
  Save, 
  Calendar, 
  MessageSquare, 
  Video, 
  Link as LinkIcon,
  Clock,
  User,
  Info,
  CheckCircle2,
  Plus,
  Edit2,
  RotateCcw,
  ExternalLink,
  Phone,
  Zap,
  Sparkles,
  RefreshCw,
  ChevronDown,
  Tag,
  Copy,
  Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface LeadDetailsProps {
  lead: Lead;
  onClose: () => void;
}

export default function LeadDetails({ lead, onClose }: LeadDetailsProps) {
  const [editedLead, setEditedLead] = useState<Lead>({ ...lead });
  const [isEditing, setIsEditing] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [icebreakerTone, setIcebreakerTone] = useState<'friendly' | 'professional' | 'curious'>('professional');
  const [isGeneratingIcebreaker, setIsGeneratingIcebreaker] = useState(false);
  const [isToneMenuOpen, setIsToneMenuOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'activities'),
      where('lead_id', '==', lead.id),
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
    });
    return () => unsubscribe();
  }, [lead.id]);

  useEffect(() => {
    setEditedLead({ ...lead });
  }, [lead]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'leads', lead.id), {
        ...editedLead,
        last_contacted: new Date().toISOString()
      });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedLead({ ...lead });
    setIsEditing(false);
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !auth.currentUser) return;
    try {
      await addDoc(collection(db, 'activities'), {
        lead_id: lead.id,
        owner_id: auth.currentUser.uid,
        type: 'Note',
        content: newNote,
        timestamp: new Date().toISOString()
      });
      setNewNote('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'activities');
    }
  };

  const handleScheduleFollowUp = async () => {
    const date = prompt("Enter follow-up date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
    const time = prompt("Enter follow-up time (HH:MM):", "10:00");
    if (date && time && auth.currentUser) {
      const scheduledTime = `${date}T${time}:00Z`;
      try {
        await updateDoc(doc(db, 'leads', lead.id), { status: 'Follow-up' });
        await addDoc(collection(db, 'activities'), {
          lead_id: lead.id,
          owner_id: auth.currentUser.uid,
          type: 'Meeting',
          content: `Scheduled follow-up for ${date} at ${time}`,
          timestamp: new Date().toISOString()
        });
        toast.success(`Follow-up scheduled for ${date} at ${time}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'leads/activities');
      }
    }
  };

  const handleGenerateIcebreaker = async () => {
    setIsGeneratingIcebreaker(true);
    try {
      const icebreaker = await generateIcebreaker(editedLead, icebreakerTone);
      setEditedLead(prev => ({ ...prev, icebreaker }));
      await updateDoc(doc(db, 'leads', lead.id), { icebreaker });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}/icebreaker`);
    } finally {
      setIsGeneratingIcebreaker(false);
    }
  };

  const handleCopyIcebreaker = async () => {
    if (!editedLead.icebreaker || !auth.currentUser) return;
    try {
      await navigator.clipboard.writeText(editedLead.icebreaker);
      await addDoc(collection(db, 'activities'), {
        lead_id: lead.id,
        owner_id: auth.currentUser.uid,
        type: 'Message',
        content: `Icebreaker copied/sent: ${editedLead.icebreaker}`,
        timestamp: new Date().toISOString()
      });
      toast.success('Icebreaker copied to clipboard and logged as activity.');
    } catch (error) {
      console.error('Failed to copy/log icebreaker:', error);
    }
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const updatedTags = [...(editedLead.tags || []), newTag.trim()];
    setEditedLead(prev => ({ ...prev, tags: updatedTags }));
    setNewTag('');
    if (!isEditing) {
      try {
        await updateDoc(doc(db, 'leads', lead.id), { tags: updatedTags });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}/tags`);
      }
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const updatedTags = (editedLead.tags || []).filter(t => t !== tagToRemove);
    setEditedLead(prev => ({ ...prev, tags: updatedTags }));
    if (!isEditing) {
      try {
        await updateDoc(doc(db, 'leads', lead.id), { tags: updatedTags });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `leads/${lead.id}/tags`);
      }
    }
  };

  const handleConvert = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      // 1. Update Lead Status
      await updateDoc(doc(db, 'leads', lead.id), { status: 'Onboarded' });
      
      // 2. Create Customer Record
      await addDoc(collection(db, 'customers'), {
        owner_id: auth.currentUser.uid,
        lead_id: lead.id,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        interest: lead.interest || 'Both',
        onboarded_at: new Date().toISOString(),
        notes: lead.notes || '',
        tags: lead.tags || []
      });

      // 3. Log Activity
      await addDoc(collection(db, 'activities'), {
        lead_id: lead.id,
        owner_id: auth.currentUser.uid,
        type: 'Note',
        content: 'Converted to Customer',
        timestamp: new Date().toISOString()
      });

      toast.success('Successfully converted to Customer!');
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leads/convert');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!auth.currentUser) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'leads', lead.id));
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${lead.id}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const VideoPlayer = ({ url }: { url: string }) => {
    const getYouTubeId = (url: string) => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      return (match && match[2].length === 11) ? match[2] : null;
    };

    const youtubeId = getYouTubeId(url);

    if (youtubeId) {
      return (
        <div className="aspect-video w-full rounded-2xl overflow-hidden bg-black border border-white/10 mt-4 shadow-2xl">
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
    }

    return (
      <a 
        href={url} 
        target="_blank" 
        rel="noreferrer"
        className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all group mt-4"
      >
        <ExternalLink className="w-5 h-5 text-neutral-500 group-hover:text-emerald-500" />
        <span className="text-sm text-neutral-400 truncate">{url}</span>
      </a>
    );
  };

  return (
    <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-neutral-900 border border-white/10 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center text-neutral-950 font-black text-xl">
              {editedLead.name[0]}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tighter">{editedLead.name}</h2>
              <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold">{editedLead.status}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEditing ? (
              <>
                <button 
                  onClick={handleCancel}
                  className="px-6 py-3 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </>
            ) : (
              <button 
                onClick={() => setIsEditing(true)}
                className="px-6 py-3 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4" />
                Edit Lead
              </button>
            )}
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-3 hover:bg-red-500/10 text-neutral-500 hover:text-red-500 rounded-2xl transition-all"
              title="Delete Lead"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-3 gap-12 custom-scrollbar">
          {/* Left Column: Basic Info & AI Assets */}
          <div className="lg:col-span-2 space-y-10">
            <section className="space-y-6">
              <div className="flex items-center gap-2 text-emerald-500">
                <User className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Lead Information</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Full Name</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editedLead.name}
                      onChange={(e) => setEditedLead({...editedLead, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                    />
                  ) : (
                    <p className="text-lg font-medium text-white px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">{editedLead.name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Source</label>
                  {isEditing ? (
                    <input 
                      type="text" 
                      value={editedLead.source}
                      onChange={(e) => setEditedLead({...editedLead, source: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                    />
                  ) : (
                    <p className="text-lg font-medium text-white px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">{editedLead.source}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Phone Number (WhatsApp)</label>
                  {isEditing ? (
                    <input 
                      type="tel" 
                      value={editedLead.phone || ''}
                      onChange={(e) => setEditedLead({...editedLead, phone: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                      placeholder="+1234567890"
                    />
                  ) : (
                    <p className="text-lg font-medium text-white px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">{editedLead.phone || 'Not provided'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Interest</label>
                  {isEditing ? (
                    <select 
                      value={editedLead.interest || 'Both'}
                      onChange={(e) => setEditedLead({...editedLead, interest: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                    >
                      <option value="Product">Product</option>
                      <option value="Business">Business</option>
                      <option value="Both">Both</option>
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-white px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">{editedLead.interest || 'Both'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</label>
                  {isEditing ? (
                    <select 
                      value={editedLead.status}
                      onChange={(e) => setEditedLead({...editedLead, status: e.target.value as any})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="Invited">Invited</option>
                      <option value="Presented">Presented</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Onboarded">Onboarded</option>
                    </select>
                  ) : (
                    <p className="text-lg font-medium text-white px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">{editedLead.status}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">LinkedIn Profile URL</label>
                  {isEditing ? (
                    <input 
                      type="url" 
                      value={editedLead.linkedin_url || ''}
                      onChange={(e) => setEditedLead({...editedLead, linkedin_url: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                      placeholder="https://linkedin.com/in/..."
                    />
                  ) : (
                    <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">
                      <span className="text-sm text-neutral-400 truncate max-w-[200px]">{editedLead.linkedin_url || 'Not set'}</span>
                      {editedLead.linkedin_url && (
                        <a href={editedLead.linkedin_url} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-400">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Bio / Background</label>
                {isEditing ? (
                  <textarea 
                    rows={3}
                    value={editedLead.bio || ''}
                    onChange={(e) => setEditedLead({...editedLead, bio: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 resize-none"
                    placeholder="Tell us about this lead..."
                  />
                ) : (
                  <p className="text-sm text-neutral-300 px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5 min-h-[80px]">{editedLead.bio || 'No bio provided.'}</p>
                )}
              </div>

              {/* Tags Section */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                  <Tag className="w-3 h-3" /> Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {(editedLead.tags || []).map(tag => (
                    <span 
                      key={tag} 
                      className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-xs font-bold flex items-center gap-2 group/tag"
                    >
                      {tag}
                      <button 
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-emerald-400 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                      placeholder="Add tag..."
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs outline-none focus:border-emerald-500/30 w-24"
                    />
                    <button 
                      onClick={handleAddTag}
                      className="p-1 hover:bg-white/5 rounded-lg text-neutral-500 hover:text-white transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">AI Icebreaker</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button 
                      onClick={() => setIsToneMenuOpen(!isToneMenuOpen)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all"
                    >
                      Tone: {icebreakerTone}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    <AnimatePresence>
                      {isToneMenuOpen && (
                        <motion.div 
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute right-0 mt-2 w-32 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl p-1 z-50"
                        >
                          {(['friendly', 'professional', 'curious'] as const).map(t => (
                            <button 
                              key={t}
                              onClick={() => {
                                setIcebreakerTone(t);
                                setIsToneMenuOpen(false);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                                icebreakerTone === t ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-white/5 hover:text-white"
                              )}
                            >
                              {t}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button 
                    onClick={handleGenerateIcebreaker}
                    disabled={isGeneratingIcebreaker}
                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {isGeneratingIcebreaker ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3 h-3" />
                    )}
                    {editedLead.icebreaker ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 relative group">
                {isGeneratingIcebreaker && (
                  <div className="absolute inset-0 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center rounded-3xl z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Crafting Icebreaker...</span>
                    </div>
                  </div>
                )}
                {editedLead.icebreaker ? (
                  <div className="space-y-4">
                    <p className="text-sm text-emerald-50/80 leading-relaxed italic">"{editedLead.icebreaker}"</p>
                    <button 
                      onClick={handleCopyIcebreaker}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-950 rounded-xl text-xs font-bold hover:bg-emerald-400 transition-all"
                    >
                      <Copy className="w-4 h-4" />
                      Copy & Log Activity
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 italic">No icebreaker generated yet. Click generate to create a personalized message.</p>
                )}
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center gap-2 text-emerald-500">
                <Video className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Training & Opp Materials</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" /> Opp Video (YouTube/TikTok)
                    </label>
                    {isEditing ? (
                      <input 
                        type="url" 
                        value={editedLead.opp_video_url || ''}
                        onChange={(e) => setEditedLead({...editedLead, opp_video_url: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                        placeholder="https://..."
                      />
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <span className="text-sm text-neutral-400 truncate max-w-[150px]">{editedLead.opp_video_url || 'Not set'}</span>
                        {editedLead.opp_video_url && (
                          <a href={editedLead.opp_video_url} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-400">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {editedLead.opp_video_url && !isEditing && <VideoPlayer url={editedLead.opp_video_url} />}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" /> Product Demo Video
                    </label>
                    {isEditing ? (
                      <input 
                        type="url" 
                        value={editedLead.product_demo_url || ''}
                        onChange={(e) => setEditedLead({...editedLead, product_demo_url: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                        placeholder="https://..."
                      />
                    ) : (
                      <div className="flex items-center justify-between px-4 py-3 bg-white/[0.02] rounded-xl border border-white/5">
                        <span className="text-sm text-neutral-400 truncate max-w-[150px]">{editedLead.product_demo_url || 'Not set'}</span>
                        {editedLead.product_demo_url && (
                          <a href={editedLead.product_demo_url} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-400">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                  {editedLead.product_demo_url && !isEditing && <VideoPlayer url={editedLead.product_demo_url} />}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-500">
                  <Clock className="w-4 h-4" />
                  <h3 className="text-xs font-bold uppercase tracking-widest">Activity Timeline</h3>
                </div>
                <button 
                  onClick={handleScheduleFollowUp}
                  className="text-[10px] font-bold text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full hover:bg-emerald-500/10 transition-all flex items-center gap-2"
                >
                  <Calendar className="w-3 h-3" />
                  Schedule Follow-up
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <textarea 
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 resize-none text-sm"
                    placeholder="Add a note or log an activity..."
                    rows={2}
                  />
                  <button 
                    onClick={handleAddNote}
                    className="px-6 bg-white/5 hover:bg-white/10 rounded-xl transition-all flex items-center justify-center"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4 mt-8">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center border border-white/10",
                          activity.type === 'Note' ? "bg-blue-500/10 text-blue-500" : 
                          activity.type === 'Meeting' ? "bg-purple-500/10 text-purple-500" :
                          activity.type === 'Message' ? "bg-amber-500/10 text-amber-500" :
                          "bg-emerald-500/10 text-emerald-500"
                        )}>
                          {activity.type === 'Note' ? <MessageSquare className="w-4 h-4" /> : 
                           activity.type === 'Meeting' ? <Calendar className="w-4 h-4" /> :
                           activity.type === 'Message' ? <Zap className="w-4 h-4" /> :
                           <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="w-px flex-1 bg-white/5 my-2 group-last:hidden" />
                      </div>
                      <div className="flex-1 pb-6">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">{activity.type}</span>
                          <span className="text-[10px] font-mono text-neutral-600">{new Date(activity.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-neutral-300">{activity.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Quick Stats & Notes */}
          <div className="space-y-8">
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`mailto:${editedLead.email}`}
                  className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all group"
                >
                  <MessageSquare className="w-6 h-6 text-neutral-500 group-hover:text-emerald-500 mb-2" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Email</span>
                </a>
                <a 
                  href={`https://wa.me/${editedLead.phone?.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center justify-center p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all group"
                >
                  <Phone className="w-6 h-6 text-neutral-500 group-hover:text-emerald-500 mb-2" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">WhatsApp</span>
                </a>
              </div>
              
              {lead.status !== 'Onboarded' && (
                <button 
                  onClick={() => setShowConvertConfirm(true)}
                  disabled={isSaving}
                  className="w-full mt-4 py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  CONVERT TO CUSTOMER
                </button>
              )}
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Lead Health</h3>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-32 h-32 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="text-white/5"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      fill="transparent"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray={364.4}
                      strokeDashoffset={364.4 - (364.4 * lead.ai_score) / 100}
                      className="text-emerald-500 transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-black text-white">{lead.ai_score}%</span>
                    <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-widest">AI Match</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Score Breakdown</p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'Interest Level', score: 85 },
                      { label: 'Responsiveness', score: 92 },
                      { label: 'Profile Fit', score: 78 }
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between text-[10px]">
                        <span className="text-neutral-400">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${item.score}%` }} />
                          </div>
                          <span className="font-mono text-white">{item.score}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-neutral-500">Last Contact</span>
                  <span className="text-sm font-bold">{new Date(lead.last_contacted || '').toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2 text-emerald-500">
                <Info className="w-4 h-4" />
                <h3 className="text-xs font-bold uppercase tracking-widest">Internal Notes</h3>
              </div>
              <textarea 
                value={editedLead.notes || ''}
                onChange={(e) => setEditedLead({...editedLead, notes: e.target.value})}
                className="w-full bg-transparent border-none outline-none text-sm text-neutral-300 resize-none min-h-[200px]"
                placeholder="Private notes about this lead..."
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tighter">Delete Lead?</h3>
                <p className="text-neutral-400 text-sm">
                  Are you sure you want to delete <span className="text-white font-bold">{lead.name}</span>? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all flex items-center justify-center gap-2"
                >
                  {isDeleting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Conversion Confirmation Modal */}
      <AnimatePresence>
        {showConvertConfirm && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tighter">Convert to Customer?</h3>
                <p className="text-neutral-400 text-sm">
                  This will update <span className="text-white font-bold">{lead.name}'s</span> status to Onboarded and create a new customer record.
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowConvertConfirm(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleConvert}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                >
                  {isSaving ? <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
