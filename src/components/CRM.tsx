import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { Lead } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Mail, 
  Phone, 
  Linkedin,
  MessageSquare,
  Zap,
  TrendingUp,
  Maximize2,
  Download,
  GripVertical,
  Check,
  Trash2,
  Tag,
  ChevronDown,
  LayoutGrid,
  List as ListIcon,
  X
} from 'lucide-react';
import { 
  DndContext, 
  DragOverlay, 
  closestCorners, 
  KeyboardSensor, 
  PointerSensor, 
  useSensor, 
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects
} from '@dnd-kit/core';
import { 
  arrayMove, 
  SortableContext, 
  sortableKeyboardCoordinates, 
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateIcebreaker, scoreLead } from '../services/geminiService';
import LeadDetails from './LeadDetails';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const STAGES = ['Prospect', 'Invited', 'Presented', 'Follow-up', 'Onboarded'] as const;

function SortableLeadCard({ lead, onSelect, onGenerateIcebreaker, generatingAI }: { 
  lead: Lead, 
  onSelect: (lead: Lead) => void, 
  onGenerateIcebreaker: (lead: Lead) => void,
  generatingAI: string | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-neutral-900 border border-white/5 rounded-2xl p-4 space-y-4 group hover:border-emerald-500/30 transition-all"
    >
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-white/5 rounded-lg">
            <GripVertical className="w-4 h-4 text-neutral-600" />
          </div>
          <div onClick={() => onSelect(lead)} className="cursor-pointer">
            <h4 className="font-bold text-white group-hover:text-emerald-400 transition-colors">{lead.name}</h4>
            <p className="text-xs text-neutral-500">{lead.source}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.ai_score > 0 && (
            <div className="px-2 py-1 bg-emerald-500/10 rounded-lg text-[10px] font-bold text-emerald-500">
              {lead.ai_score}% FIT
            </div>
          )}
          <button onClick={() => onSelect(lead)} className="p-1 hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
            <Maximize2 className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {lead.tags && lead.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lead.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-white/5 text-[8px] font-bold text-neutral-400 rounded-md border border-white/5">
              {tag}
            </span>
          ))}
          {lead.tags.length > 3 && (
            <span className="text-[8px] font-bold text-neutral-600">+{lead.tags.length - 3} more</span>
          )}
        </div>
      )}

        <div className="flex items-center gap-2">
          {lead.linkedin_url && (
            <a href={lead.linkedin_url} target="_blank" rel="noreferrer" className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all">
              <Linkedin className="w-3.5 h-3.5" />
            </a>
          )}
          {lead.phone && (
            <a 
              href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} 
              target="_blank" 
              rel="noreferrer" 
              className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-emerald-500 transition-all"
            >
              <Phone className="w-3.5 h-3.5" />
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-all">
              <Mail className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
          {lead.status}
        </span>
        <span className="text-[10px] text-neutral-600 font-mono">
          {new Date(lead.last_contacted || '').toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

export default function CRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({ name: '', email: '', phone: '', linkedin_url: '', source: 'Manual' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'ai_score' | 'last_contacted'>('last_contacted');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [filters, setFilters] = useState({
    status: [] as string[],
    source: [] as string[],
    interest: [] as string[]
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | 'bulk' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'leads'), where('owner_id', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead));
      setLeads(leadsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!newLead.name.trim()) newErrors.name = 'Name is required';
    if (newLead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLead.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (newLead.linkedin_url && !newLead.linkedin_url.startsWith('http')) {
      newErrors.linkedin_url = 'URL must start with http:// or https://';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const score = await scoreLead(newLead); // Simplified scoring
      await addDoc(collection(db, 'leads'), {
        ...newLead,
        owner_id: auth.currentUser.uid,
        status: 'Prospect',
        ai_score: score,
        last_contacted: new Date().toISOString(),
        created_at: new Date().toISOString()
      });

      // Log activity
      await addDoc(collection(db, 'activities'), {
        owner_id: auth.currentUser.uid,
        type: 'New Lead',
        content: `Added new lead: ${newLead.name}`,
        timestamp: new Date().toISOString()
      });

      setIsAddingLead(false);
      setErrors({});
      setNewLead({ name: '', email: '', phone: '', linkedin_url: '', source: 'Manual' });
      toast.success('Lead added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'leads');
      toast.error('Failed to add lead');
    }
  };

  const handleGenerateIcebreaker = async (lead: Lead) => {
    setGeneratingAI(lead.id);
    try {
      const icebreaker = await generateIcebreaker(lead);
      await addDoc(collection(db, 'activities'), {
        lead_id: lead.id,
        owner_id: auth.currentUser!.uid,
        type: 'Note',
        content: `AI Icebreaker generated for ${lead.name}`,
        timestamp: new Date().toISOString()
      });
      setSelectedLead(lead);
      toast.success('AI Icebreaker generated!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `leads/${lead.id}/icebreaker`);
      toast.error('Failed to generate icebreaker');
    } finally {
      setGeneratingAI(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeLead = leads.find(l => l.id === active.id);
    const overId = over.id as string;

    // If dragging over a stage column
    if (STAGES.includes(overId as any)) {
      if (activeLead && activeLead.status !== overId) {
        setLeads(prev => prev.map(l => 
          l.id === active.id ? { ...l, status: overId as any } : l
        ));
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeLead = leads.find(l => l.id === active.id);
    const overId = over.id as string;

    let newStatus = activeLead?.status;

    if (STAGES.includes(overId as any)) {
      newStatus = overId as any;
    } else {
      const overLead = leads.find(l => l.id === overId);
      if (overLead) {
        newStatus = overLead.status;
      }
    }

    if (activeLead && newStatus && activeLead.status !== newStatus) {
      try {
        await updateDoc(doc(db, 'leads', activeLead.id), { 
          status: newStatus,
          last_contacted: new Date().toISOString()
        });

        // Log activity
        await addDoc(collection(db, 'activities'), {
          lead_id: activeLead.id,
          owner_id: auth.currentUser!.uid,
          type: 'Milestone',
          content: `${activeLead.name} moved to ${newStatus}`,
          timestamp: new Date().toISOString()
        });

        toast.success(`Moved ${activeLead.name} to ${newStatus}`);
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `leads/${activeLead.id}`);
        toast.error('Failed to update stage');
      }
    }
  };

  const filteredLeads = leads.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         l.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filters.status.length === 0 || filters.status.includes(l.status);
    const matchesSource = filters.source.length === 0 || filters.source.includes(l.source);
    const matchesInterest = filters.interest.length === 0 || filters.interest.includes(l.interest || 'Both');
    
    return matchesSearch && matchesStatus && matchesSource && matchesInterest;
  }).sort((a, b) => {
    const factor = sortOrder === 'asc' ? 1 : -1;
    if (sortBy === 'ai_score') return (b.ai_score - a.ai_score) * factor;
    if (sortBy === 'name') return a.name.localeCompare(b.name) * factor;
    return (new Date(b.last_contacted || '').getTime() - new Date(a.last_contacted || '').getTime()) * factor;
  });

  const toggleLeadSelection = (id: string) => {
    const next = new Set(selectedLeads);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLeads(next);
  };

  const handleBulkDelete = async () => {
    setShowDeleteConfirm('bulk');
  };

  const confirmDelete = async () => {
    if (!showDeleteConfirm) return;
    
    try {
      if (showDeleteConfirm === 'bulk') {
        await Promise.all(Array.from(selectedLeads).map(id => deleteDoc(doc(db, 'leads', id))));
        setSelectedLeads(new Set());
        toast.success('Leads deleted successfully');
      } else {
        await deleteDoc(doc(db, 'leads', showDeleteConfirm));
        toast.success('Lead deleted successfully');
      }
      setShowDeleteConfirm(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'leads/delete');
      toast.error('Failed to delete leads');
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    try {
      await Promise.all(Array.from(selectedLeads).map(id => updateDoc(doc(db, 'leads', id), { status })));
      setSelectedLeads(new Set());
      toast.success(`Updated ${selectedLeads.size} leads to ${status}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leads/bulk/status');
      toast.error('Failed to update leads');
    }
  };

  const handleBulkAddTag = async () => {
    const tag = prompt('Enter tag to add:');
    if (!tag) return;
    try {
      await Promise.all(Array.from(selectedLeads).map(async id => {
        const lead = leads.find(l => l.id === id);
        const currentTags = lead?.tags || [];
        if (!currentTags.includes(tag)) {
          await updateDoc(doc(db, 'leads', id), { tags: [...currentTags, tag] });
        }
      }));
      setSelectedLeads(new Set());
      toast.success(`Added tag to ${selectedLeads.size} leads`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'leads/bulk/tags');
      toast.error('Failed to add tags');
    }
  };

  const exportToCSV = () => {
    if (leads.length === 0) return;
    
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Source', 'Interest', 'AI Score', 'Last Contacted', 'Created At'];
    const csvRows = [
      headers.join(','),
      ...leads.map(lead => [
        `"${lead.name}"`,
        `"${lead.email || ''}"`,
        `"${lead.phone || ''}"`,
        `"${lead.status}"`,
        `"${lead.source}"`,
        `"${lead.interest}"`,
        lead.ai_score,
        lead.last_contacted ? `"${new Date(lead.last_contacted).toISOString()}"` : '',
        lead.created_at ? `"${new Date(lead.created_at).toISOString()}"` : ''
      ].join(','))
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Export completed');
  };

  const toggleFilter = (type: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [type]: prev[type].includes(value) 
        ? prev[type].filter(v => v !== value)
        : [...prev[type], value]
    }));
  };

  return (
    <div className="space-y-8 pb-32">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-5xl font-black tracking-tighter bg-gradient-to-br from-white to-white/40 bg-clip-text text-transparent">Growth CRM</h1>
          <p className="text-neutral-400 font-medium">Manage your pipeline and accelerate conversion with AI intelligence.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={exportToCSV}
            className="flex items-center gap-2 px-6 py-4 bg-white/5 border border-white/10 rounded-[2rem] text-sm font-bold text-neutral-400 hover:bg-white/10 hover:text-white transition-all active:scale-95"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10">
            <button 
              onClick={() => setViewMode('board')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'board' ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20" : "text-neutral-500 hover:text-white"
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-xl transition-all",
                viewMode === 'list' ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20" : "text-neutral-500 hover:text-white"
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
          <button 
            onClick={() => setIsAddingLead(true)}
            className="px-8 py-4 bg-emerald-500 text-neutral-950 font-black rounded-[2rem] hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-xl shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            Add Opportunity
          </button>
        </div>
      </header>

      <div className="relative z-40">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-neutral-900/50 backdrop-blur-xl p-4 rounded-[2.5rem] border border-white/10 shadow-2xl">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
            <input 
              type="text" 
              placeholder="Search leads by name, email, or tags..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-transparent border-none outline-none text-white placeholder:text-neutral-700 font-medium"
            />
          </div>
          <div className="flex items-center gap-6 w-full md:w-auto px-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-2xl border transition-all font-bold text-xs uppercase tracking-widest",
                Object.values(filters).some(f => f.length > 0)
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                  : "bg-white/5 border-white/10 text-neutral-500 hover:text-white"
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {(filters.status.length + filters.source.length + filters.interest.length) > 0 && (
                <span className="w-5 h-5 bg-emerald-500 text-neutral-950 rounded-full flex items-center justify-center text-[10px]">
                  {filters.status.length + filters.source.length + filters.interest.length}
                </span>
              )}
            </button>

            <div className="h-8 w-px bg-white/10" />

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-neutral-600" />
                <select 
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs font-black uppercase tracking-widest outline-none cursor-pointer text-neutral-400 hover:text-white transition-colors"
                >
                  <option value="last_contacted" className="bg-neutral-900">Recent</option>
                  <option value="ai_score" className="bg-neutral-900">AI Score</option>
                  <option value="name" className="bg-neutral-900">Name</option>
                </select>
              </div>
              <button 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 hover:bg-white/5 rounded-xl transition-all text-neutral-500 hover:text-white"
              >
                <TrendingUp className={cn("w-4 h-4 transition-transform", sortOrder === 'desc' && "rotate-180")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-neutral-900 border-l border-white/10 shadow-2xl z-[101] p-10 space-y-10"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black tracking-tighter">Filters</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Pipeline Stage</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {STAGES.map(s => (
                      <button 
                        key={s}
                        onClick={() => toggleFilter('status', s)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left",
                          filters.status.includes(s)
                            ? "bg-emerald-500 border-emerald-500 text-neutral-950"
                            : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/20"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Lead Source</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['Manual', 'LinkedIn', 'Referral', 'Event'].map(s => (
                      <button 
                        key={s}
                        onClick={() => toggleFilter('source', s)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left",
                          filters.source.includes(s)
                            ? "bg-emerald-500 border-emerald-500 text-neutral-950"
                            : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/20"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Interest Area</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['Product', 'Business', 'Both'].map(s => (
                      <button 
                        key={s}
                        onClick={() => toggleFilter('interest', s)}
                        className={cn(
                          "px-4 py-3 rounded-xl text-xs font-bold transition-all border text-left",
                          filters.interest.includes(s)
                            ? "bg-emerald-500 border-emerald-500 text-neutral-950"
                            : "bg-white/5 border-white/10 text-neutral-400 hover:border-white/20"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-white/5 flex gap-4">
                <button 
                  onClick={() => setFilters({ status: [], source: [], interest: [] })}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl transition-all"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setIsSidebarOpen(false)}
                  className="flex-1 py-4 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all"
                >
                  Apply
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {viewMode === 'board' ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-8">
            {STAGES.map((stage) => (
              <div key={stage} className="space-y-6">
                <div className="flex items-center justify-between px-6 py-4 bg-neutral-900/50 border border-white/5 rounded-[1.5rem] backdrop-blur-xl">
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full shadow-lg",
                      stage === 'Prospect' && "bg-blue-500 shadow-blue-500/40",
                      stage === 'Invited' && "bg-amber-500 shadow-amber-500/40",
                      stage === 'Presented' && "bg-purple-500 shadow-purple-500/40",
                      stage === 'Follow-up' && "bg-emerald-500 shadow-emerald-500/40",
                      stage === 'Onboarded' && "bg-emerald-400 shadow-emerald-400/40"
                    )} />
                    {stage}
                  </h3>
                  <span className="text-xs font-black px-3 py-1 bg-white/5 rounded-full text-neutral-400">
                    {filteredLeads.filter(l => l.status === stage).length}
                  </span>
                </div>
                
                <SortableContext 
                  id={stage}
                  items={filteredLeads.filter(l => l.status === stage).map(l => l.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="bg-neutral-900/30 border border-white/5 rounded-[2rem] p-4 min-h-[600px] space-y-4 backdrop-blur-sm">
                    {filteredLeads.filter(l => l.status === stage).map((lead) => (
                      <div key={lead.id} className="relative group">
                        <div className="absolute left-4 top-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => toggleLeadSelection(lead.id)}
                            className={cn(
                              "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                              selectedLeads.has(lead.id) 
                                ? "bg-emerald-500 border-emerald-500 text-neutral-900" 
                                : "bg-neutral-900 border-white/20 hover:border-white/40"
                            )}
                          >
                            {selectedLeads.has(lead.id) && <Check className="w-3 h-3 font-bold" />}
                          </button>
                        </div>
                        <SortableLeadCard 
                          lead={lead} 
                          onSelect={setSelectedLead}
                          onGenerateIcebreaker={handleGenerateIcebreaker}
                          generatingAI={generatingAI}
                        />
                      </div>
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
          </div>

          <DragOverlay dropAnimation={{
            sideEffects: defaultDropAnimationSideEffects({
              styles: {
                active: {
                  opacity: '0.5',
                },
              },
            }),
          }}>
            {activeId ? (
              <div className="bg-neutral-900 border border-emerald-500/50 rounded-3xl p-6 shadow-2xl scale-105 backdrop-blur-xl">
                <h4 className="font-black text-white text-lg tracking-tight">{leads.find(l => l.id === activeId)?.name}</h4>
                <p className="text-xs font-bold text-emerald-500 uppercase tracking-widest mt-1">{leads.find(l => l.id === activeId)?.status}</p>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="bg-neutral-900/50 border border-white/10 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-6 w-12">
                  <button 
                    onClick={() => {
                      if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
                      else setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
                    }}
                    className={cn(
                      "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                      selectedLeads.size === filteredLeads.length && filteredLeads.length > 0
                        ? "bg-emerald-500 border-emerald-500 text-neutral-900" 
                        : "bg-neutral-900 border-white/20 hover:border-white/40"
                    )}
                  >
                    {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 && <Check className="w-3 h-3 font-bold" />}
                  </button>
                </th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Lead Name</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Tags</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Status</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">AI Score</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Interest</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Last Contact</th>
                <th className="p-6 text-[10px] font-black text-neutral-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredLeads.map(lead => (
                <tr key={lead.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="p-6">
                    <button 
                      onClick={() => toggleLeadSelection(lead.id)}
                      className={cn(
                        "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                        selectedLeads.has(lead.id) 
                          ? "bg-emerald-500 border-emerald-500 text-neutral-900" 
                          : "bg-neutral-900 border-white/20 hover:border-white/40"
                      )}
                    >
                      {selectedLeads.has(lead.id) && <Check className="w-3 h-3 font-bold" />}
                    </button>
                  </td>
                  <td className="p-6">
                    <div onClick={() => setSelectedLead(lead)} className="cursor-pointer">
                      <p className="font-bold text-white group-hover:text-emerald-400 transition-colors">{lead.name}</p>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">{lead.source}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {(lead.tags || []).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-white/5 text-[8px] font-bold text-neutral-400 rounded-md border border-white/5">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      lead.status === 'Prospect' && "bg-blue-500/10 text-blue-500",
                      lead.status === 'Invited' && "bg-amber-500/10 text-amber-500",
                      lead.status === 'Presented' && "bg-purple-500/10 text-purple-500",
                      lead.status === 'Follow-up' && "bg-emerald-500/10 text-emerald-500",
                      lead.status === 'Onboarded' && "bg-emerald-400/10 text-emerald-400"
                    )}>
                      {lead.status}
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${lead.ai_score}%` }} />
                      </div>
                      <span className="text-xs font-black text-emerald-500">{lead.ai_score}%</span>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="text-xs font-bold text-neutral-400">{lead.interest || 'Both'}</span>
                  </td>
                  <td className="p-6">
                    <span className="text-xs font-mono text-neutral-500">{new Date(lead.last_contacted || '').toLocaleDateString()}</span>
                  </td>
                  <td className="p-6">
                    <div className="flex items-center gap-2">
                      {lead.phone && (
                        <a 
                          href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all"
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      <button 
                        onClick={() => handleGenerateIcebreaker(lead)}
                        disabled={generatingAI === lead.id}
                        className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all"
                      >
                        <Zap className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setSelectedLead(lead)}
                        className="p-2 bg-white/5 text-neutral-400 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(lead.id)}
                        className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedLeads.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-neutral-900 border border-emerald-500/30 rounded-[2rem] px-8 py-4 shadow-2xl flex items-center gap-8 backdrop-blur-2xl"
          >
            <div className="flex items-center gap-3 pr-8 border-r border-white/10">
              <div className="w-8 h-8 bg-emerald-500 text-neutral-950 rounded-full flex items-center justify-center font-black text-sm">
                {selectedLeads.size}
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest">Leads Selected</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="relative group/bulk">
                <button className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-xl transition-all text-xs font-bold text-neutral-400 hover:text-white">
                  Change Status
                  <ChevronDown className="w-4 h-4" />
                </button>
                <div className="absolute bottom-full mb-2 left-0 hidden group-hover/bulk:block bg-neutral-900 border border-white/10 rounded-2xl p-2 shadow-2xl min-w-[160px]">
                  {STAGES.map(s => (
                    <button 
                      key={s}
                      onClick={() => handleBulkStatusChange(s)}
                      className="w-full text-left px-4 py-2 hover:bg-white/5 rounded-lg text-xs font-bold text-neutral-400 hover:text-emerald-500 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleBulkAddTag}
                className="flex items-center gap-2 px-4 py-2 hover:bg-white/5 rounded-xl transition-all text-xs font-bold text-neutral-400 hover:text-white"
              >
                <Tag className="w-4 h-4" />
                Add Tag
              </button>

              <button 
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 hover:bg-red-500/10 rounded-xl transition-all text-xs font-bold text-red-500"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>

            <button 
              onClick={() => setSelectedLeads(new Set())}
              className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
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
                  {showDeleteConfirm === 'bulk' 
                    ? `Are you sure you want to delete ${selectedLeads.size} leads? This action cannot be undone.`
                    : "Are you sure you want to delete this lead? This action cannot be undone."}
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Lead Modal */}
      {isAddingLead && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">New Opportunity</h2>
              <button onClick={() => setIsAddingLead(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Full Name</label>
                <input 
                  required
                  type="text" 
                  value={newLead.name}
                  onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.name ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="John Doe"
                />
                {errors.name && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email" 
                  value={newLead.email}
                  onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.email ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="john@example.com"
                />
                {errors.email && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Phone Number (WhatsApp)</label>
                <input 
                  type="tel" 
                  value={newLead.phone}
                  onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="+1234567890"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">LinkedIn Profile</label>
                <input 
                  type="url" 
                  value={newLead.linkedin_url}
                  onChange={(e) => setNewLead({...newLead, linkedin_url: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.linkedin_url ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="https://linkedin.com/in/..."
                />
                {errors.linkedin_url && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.linkedin_url}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Lead Source</label>
                <select 
                  value={newLead.source}
                  onChange={(e) => setNewLead({...newLead, source: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                >
                  <option value="Manual">Manual Entry</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Referral">Referral</option>
                  <option value="Event">Event</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all"
              >
                Create Lead
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Lead Details Modal */}
      {selectedLead && (
        <LeadDetails 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)} 
        />
      )}
    </div>
  );
}
