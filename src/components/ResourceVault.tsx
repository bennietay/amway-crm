import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Resource } from '../types';
import { motion } from 'motion/react';
import { 
  Search, 
  FileText, 
  Video, 
  ExternalLink, 
  Plus,
  X,
  Trash2,
  Edit2,
  Library,
  Eye,
  ChevronDown,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const CATEGORIES = ['Product Demo', 'Training Video', 'Opp', 'PDF Materials', 'Other'] as const;

interface ResourceVaultProps {
  profile: UserProfile | null;
}

export default function ResourceVault({ profile }: ResourceVaultProps) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newResource, setNewResource] = useState<Partial<Resource>>({
    title: '',
    description: '',
    url: '',
    type: 'PDF',
    category: 'PDF Materials'
  });

  const isAdmin = profile?.role === 'admin' || 
                profile?.email?.toLowerCase() === 'bennietay.agency@gmail.com' || 
                auth.currentUser?.email?.toLowerCase() === 'bennietay.agency@gmail.com';

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'resources'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Resource)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'resources');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !isAdmin) return;

    // Validation
    const newErrors: Record<string, string> = {};
    if (!newResource.title?.trim()) newErrors.title = 'Title is required';
    if (!newResource.description?.trim()) newErrors.description = 'Description is required';
    if (!newResource.url?.trim()) newErrors.url = 'URL is required';
    else if (!newResource.url.startsWith('http')) newErrors.url = 'Invalid URL format';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Google Drive Link Helper
    let finalUrl = newResource.url || '';
    if (finalUrl.includes('drive.google.com')) {
      const match = finalUrl.match(/\/d\/(.+?)\//);
      if (match && match[1]) {
        // Use preview link for embedding, uc?export=view for direct download/view
        finalUrl = `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }

    try {
      if (editingResource) {
        await updateDoc(doc(db, 'resources', editingResource.id), { ...newResource, url: finalUrl });
        toast.success('Resource updated successfully');
      } else {
        await addDoc(collection(db, 'resources'), {
          ...newResource,
          url: finalUrl,
          owner_id: auth.currentUser.uid,
          created_at: new Date().toISOString()
        });
        toast.success('Resource added successfully');
      }
      setIsAddingResource(false);
      setEditingResource(null);
      setErrors({});
      setNewResource({ title: '', description: '', url: '', type: 'PDF', category: 'PDF Materials' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'resources');
      toast.error('Failed to save resource');
    }
  };

  const handleDeleteResource = async () => {
    if (!isAdmin || !showDeleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'resources', showDeleteConfirm));
      setShowDeleteConfirm(null);
      toast.success('Resource deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `resources/${showDeleteConfirm}`);
      toast.error('Failed to delete resource');
    }
  };

  const filteredResources = resources.filter(r => {
    const matchesCategory = activeCategory === 'All' || r.category === activeCategory;
    const matchesSearch = r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         r.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="h-full flex flex-col space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-3xl font-bold tracking-tighter">Resource Vault</h1>
            {isAdmin && (
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-emerald-500/20">
                Admin Mode
              </span>
            )}
          </div>
          <p className="text-neutral-400">Access training materials, product demos, and opportunity assets.</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setIsAddingResource(true)}
            className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Resource
          </button>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
          <input 
            type="text" 
            placeholder="Search resources..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-emerald-500/50 transition-all"
          />
        </div>
        
        {/* Category Filter - Desktop Tabs / Mobile Dropdown */}
        <div className="relative">
          <div className="hidden md:flex gap-2 overflow-x-auto pb-2 md:pb-0 custom-scrollbar">
            {['All', ...CATEGORIES].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-6 py-4 rounded-2xl font-bold text-sm whitespace-nowrap transition-all border",
                  activeCategory === cat 
                    ? "bg-emerald-500 text-neutral-950 border-emerald-500" 
                    : "bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          
          <div className="md:hidden relative">
            <button 
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="w-full flex items-center justify-between px-6 py-4 bg-white/5 border border-white/10 rounded-2xl font-bold text-sm text-white"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-emerald-500" />
                {activeCategory}
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showCategoryDropdown && "rotate-180")} />
            </button>
            
            {showCategoryDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden z-20 shadow-2xl">
                {['All', ...CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    className={cn(
                      "w-full px-6 py-4 text-left text-sm font-bold transition-colors",
                      activeCategory === cat ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:bg-white/5"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredResources.map((resource) => (
          <motion.div
            layout
            key={resource.id}
            className="group bg-neutral-900 border border-white/5 rounded-[2rem] p-6 hover:border-emerald-500/30 transition-all flex flex-col"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={cn(
                "w-12 h-12 rounded-2xl flex items-center justify-center",
                resource.type === 'Video' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
              )}>
                {resource.type === 'Video' ? <Video className="w-6 h-6" /> : 
                 resource.type === 'PDF' ? <FileText className="w-6 h-6" /> :
                 <Library className="w-6 h-6" />}
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => {
                      setEditingResource(resource);
                      setNewResource(resource);
                      setIsAddingResource(true);
                    }}
                    className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowDeleteConfirm(resource.id)}
                    className="p-2 hover:bg-red-500/10 rounded-xl text-neutral-500 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            <h3 className="text-lg font-bold mb-2 group-hover:text-emerald-400 transition-colors">{resource.title}</h3>
            <p className="text-sm text-neutral-500 mb-6 flex-1">{resource.description}</p>

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
              <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{resource.category}</span>
              <div className="flex items-center gap-2">
                {(resource.type === 'Video' || resource.type === 'PDF') && (
                  <button 
                    onClick={() => setPreviewResource(resource)}
                    className="p-3 bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white rounded-xl transition-all"
                    title="Preview Resource"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                <a 
                  href={resource.url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="p-3 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 rounded-xl transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6 shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tighter">Delete Resource?</h3>
              <p className="text-neutral-400 text-sm">
                Are you sure you want to delete this resource? This action cannot be undone.
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
                onClick={handleDeleteResource}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add/Edit Resource Modal */}
      {isAddingResource && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-lg w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">{editingResource ? 'Edit Resource' : 'Add New Resource'}</h2>
              <button onClick={() => { setIsAddingResource(false); setEditingResource(null); }} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveResource} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Title</label>
                <input 
                  required
                  type="text" 
                  value={newResource.title}
                  onChange={(e) => setNewResource({...newResource, title: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.title ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="Product Training Guide"
                />
                {errors.title && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Description</label>
                <textarea 
                  required
                  value={newResource.description}
                  onChange={(e) => setNewResource({...newResource, description: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all resize-none",
                    errors.description ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="Brief overview of the resource..."
                  rows={3}
                />
                {errors.description && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.description}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Type</label>
                  <select 
                    value={newResource.type}
                    onChange={(e) => setNewResource({...newResource, type: e.target.value as any})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  >
                    <option value="PDF">PDF Document</option>
                    <option value="Video">Video Tutorial</option>
                    <option value="Link">External Link</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Category</label>
                  <select 
                    value={newResource.category}
                    onChange={(e) => setNewResource({...newResource, category: e.target.value as any})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  >
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Resource URL (Supports Google Drive)</label>
                <input 
                  required
                  type="url" 
                  value={newResource.url}
                  onChange={(e) => setNewResource({...newResource, url: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.url ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="https://..."
                />
                {errors.url && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.url}</p>}
                <p className="text-[10px] text-neutral-500 italic">Tip: Paste a Google Drive share link and we'll optimize it for viewing.</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="submit"
                  className="flex-1 py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all"
                >
                  {editingResource ? 'Update Resource' : 'Add Resource'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Resource Preview Modal */}
      {previewResource && (
        <div className="fixed inset-0 bg-neutral-950/90 backdrop-blur-md z-[60] flex items-center justify-center p-4 md:p-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-[2.5rem] w-full max-w-6xl h-full flex flex-col overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-neutral-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  previewResource.type === 'Video' ? "bg-purple-500/10 text-purple-500" : "bg-blue-500/10 text-blue-500"
                )}>
                  {previewResource.type === 'Video' ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{previewResource.title}</h2>
                  <p className="text-xs text-neutral-500 uppercase font-bold tracking-widest">{previewResource.category}</p>
                </div>
              </div>
              <button 
                onClick={() => setPreviewResource(null)}
                className="p-3 hover:bg-white/5 rounded-2xl text-neutral-400 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 bg-black relative">
              {previewResource.type === 'Video' ? (
                previewResource.url.includes('youtube.com') || previewResource.url.includes('youtu.be') ? (
                  <iframe 
                    src={previewResource.url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                    className="w-full h-full"
                    allowFullScreen
                    title={previewResource.title}
                  />
                ) : (
                  <video 
                    src={previewResource.url} 
                    controls 
                    className="w-full h-full"
                    poster="https://picsum.photos/seed/video/1280/720"
                  />
                )
              ) : (
                <iframe 
                  src={previewResource.url}
                  className="w-full h-full"
                  title={previewResource.title}
                />
              )}
            </div>
            
            <div className="p-6 bg-neutral-900/50 border-t border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <p className="text-sm text-neutral-400 max-w-2xl">{previewResource.description}</p>
              <a 
                href={previewResource.url}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" />
                Open Original
              </a>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
