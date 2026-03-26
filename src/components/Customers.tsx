import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc } from 'firebase/firestore';
import { Customer } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Calendar, 
  Tag, 
  MoreVertical,
  Trash2,
  ExternalLink,
  ChevronRight,
  UserCheck,
  X,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [newCustomer, setNewCustomer] = useState<Partial<Customer>>({
    name: '',
    email: '',
    phone: '',
    interest: 'Both',
    notes: '',
    tags: []
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'customers'),
      where('owner_id', '==', auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const customerData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Customer));
      setCustomers(customerData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await deleteDoc(doc(db, 'customers', showDeleteConfirm));
      if (selectedCustomer?.id === showDeleteConfirm) setSelectedCustomer(null);
      setShowDeleteConfirm(null);
      toast.success('Customer deleted successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${showDeleteConfirm}`);
      toast.error('Failed to delete customer');
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newCustomer.name) return;

    setIsSaving(true);
    try {
      await addDoc(collection(db, 'customers'), {
        ...newCustomer,
        owner_id: auth.currentUser.uid,
        onboarded_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
      setIsAddingCustomer(false);
      setNewCustomer({
        name: '',
        email: '',
        phone: '',
        interest: 'Both',
        notes: '',
        tags: []
      });
      toast.success('Customer added successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
      toast.error('Failed to add customer');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter">Customer Intelligence</h1>
          <p className="text-neutral-400">Manage your onboarded customers and track their journey.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddingCustomer(true)}
            className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Customer
          </button>
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
            <UserCheck className="w-5 h-5 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-500">{customers.length} Active Customers</span>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Customer List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center gap-4 bg-neutral-900/50 backdrop-blur-xl p-4 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600" />
              <input 
                type="text" 
                placeholder="Search customers by name, email, or tags..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-14 pr-6 py-3 bg-transparent border-none outline-none text-white placeholder:text-neutral-700 font-medium"
              />
            </div>
            <button className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-neutral-400 hover:text-white">
              <Filter className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Customer</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Onboarded</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Tags</th>
                    <th className="px-8 py-5 text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCustomers.map((customer) => (
                    <tr 
                      key={customer.id} 
                      onClick={() => setSelectedCustomer(customer)}
                      className={cn(
                        "hover:bg-white/[0.02] transition-colors group cursor-pointer",
                        selectedCustomer?.id === customer.id && "bg-emerald-500/5"
                      )}
                    >
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center font-bold text-emerald-500 text-xl border border-white/10">
                            {customer.name[0]}
                          </div>
                          <div>
                            <p className="font-bold text-lg tracking-tight">{customer.name}</p>
                            <p className="text-xs text-neutral-500">{customer.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 text-neutral-400">
                          <Calendar className="w-4 h-4" />
                          <span className="text-sm">
                            {new Date(customer.onboarded_at).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-1.5">
                          {customer.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-neutral-400">
                              {tag}
                            </span>
                          ))}
                          {customer.tags && customer.tags.length > 2 && (
                            <span className="text-[10px] font-bold text-neutral-600">+{customer.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(customer.id);
                            }}
                            className="p-2 hover:bg-red-500/10 rounded-xl text-neutral-500 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <ChevronRight className="w-5 h-5 text-neutral-700" />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredCustomers.length === 0 && !loading && (
                    <tr>
                      <td colSpan={4} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 text-neutral-500">
                          <Users className="w-12 h-12 opacity-20" />
                          <p className="font-bold tracking-tight text-lg">No customers found</p>
                          <p className="text-sm">Convert leads in the CRM to see them here.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Customer Details Panel */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            {selectedCustomer ? (
              <motion.div 
                key={selectedCustomer.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-8 sticky top-8"
              >
                <div className="flex justify-between items-start">
                  <div className="w-20 h-20 rounded-3xl bg-emerald-500 flex items-center justify-center text-neutral-950 text-3xl font-black shadow-2xl shadow-emerald-500/20">
                    {selectedCustomer.name[0]}
                  </div>
                  <button className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                    <MoreVertical className="w-6 h-6 text-neutral-500" />
                  </button>
                </div>

                <div>
                  <h2 className="text-3xl font-black tracking-tighter mb-1">{selectedCustomer.name}</h2>
                  <p className="text-emerald-500 font-bold text-sm uppercase tracking-widest">Active Customer</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5">
                    <Mail className="w-4 h-4" />
                    <span className="text-xs font-bold">Email</span>
                  </button>
                  <button className="flex items-center justify-center gap-2 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-bold">Call</span>
                  </button>
                </div>

                <div className="space-y-6 pt-6 border-t border-white/5">
                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Contact Information</h4>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm">
                        <Mail className="w-4 h-4 text-neutral-600" />
                        <span className="text-neutral-300">{selectedCustomer.email}</span>
                      </div>
                      {selectedCustomer.phone && (
                        <div className="flex items-center gap-3 text-sm">
                          <Phone className="w-4 h-4 text-neutral-600" />
                          <span className="text-neutral-300">{selectedCustomer.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Interest Area</h4>
                    <p className="text-sm text-neutral-300">{selectedCustomer.interest || 'Not specified'}</p>
                  </div>

                  {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCustomer.tags.map(tag => (
                          <span key={tag} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-500">
                            <Tag className="w-3 h-3" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedCustomer.notes && (
                    <div className="space-y-2">
                      <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Notes</h4>
                      <p className="text-sm text-neutral-400 leading-relaxed italic">"{selectedCustomer.notes}"</p>
                    </div>
                  )}
                </div>

                <button className="w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-2 text-sm font-bold">
                  <ExternalLink className="w-4 h-4" />
                  View Original Lead
                </button>
              </motion.div>
            ) : (
              <div className="bg-white/5 border border-white/10 border-dashed rounded-[2.5rem] p-12 text-center h-[600px] flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center">
                  <UserCheck className="w-8 h-8 text-neutral-700" />
                </div>
                <p className="text-neutral-500 font-bold tracking-tight">Select a customer to view details</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
                <h3 className="text-2xl font-bold tracking-tighter">Remove Customer?</h3>
                <p className="text-neutral-400 text-sm">
                  Are you sure you want to remove this customer record? This action cannot be undone.
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
                  onClick={handleDelete}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Customer Modal */}
      <AnimatePresence>
        {isAddingCustomer && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold tracking-tighter">New Customer</h2>
                <button onClick={() => setIsAddingCustomer(false)} className="p-2 hover:bg-white/5 rounded-xl">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleAddCustomer} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Full Name</label>
                  <input 
                    required
                    type="text" 
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Email Address</label>
                  <input 
                    required
                    type="email" 
                    value={newCustomer.email}
                    onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Phone Number</label>
                  <input 
                    type="tel" 
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer({...newCustomer, phone: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="+1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Interest</label>
                  <select 
                    value={newCustomer.interest}
                    onChange={(e) => setNewCustomer({...newCustomer, interest: e.target.value as any})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  >
                    <option value="Product">Product</option>
                    <option value="Business">Business</option>
                    <option value="Both">Both</option>
                  </select>
                </div>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                >
                  {isSaving && <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />}
                  Create Customer
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
