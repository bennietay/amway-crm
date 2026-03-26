import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  List, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  MapPin, 
  User,
  CheckCircle2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { db, auth } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy 
} from 'firebase/firestore';
import { Appointment, Lead, Customer } from '../types';
import { format, isSameDay, parseISO, addHours } from 'date-fns';
import { cn } from '../lib/utils';
import { handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';

const STATUS_COLORS = {
  Scheduled: 'text-blue-500 border-blue-500/30 bg-blue-500/5',
  Completed: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5',
  Cancelled: 'text-red-500 border-red-500/30 bg-red-500/5',
  'No Show': 'text-amber-500 border-amber-500/30 bg-amber-500/5'
};

export default function Appointments() {
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddingAppointment, setIsAddingAppointment] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newAppointment, setNewAppointment] = useState({
    title: '',
    description: '',
    start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_time: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
    location: '',
    lead_id: '',
    customer_id: '',
    status: 'Scheduled' as Appointment['status']
  });

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'appointments'),
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('start_time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Appointment));
      setAppointments(apps);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    const leadsUnsubscribe = onSnapshot(
      query(collection(db, 'leads'), where('owner_id', '==', auth.currentUser.uid)),
      (snapshot) => {
        setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'leads');
      }
    );

    const customersUnsubscribe = onSnapshot(
      query(collection(db, 'customers'), where('owner_id', '==', auth.currentUser.uid)),
      (snapshot) => {
        setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'customers');
      }
    );

    return () => {
      unsubscribe();
      leadsUnsubscribe();
      customersUnsubscribe();
    };
  }, []);

  const handleAddAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'appointments'), {
        ...newAppointment,
        owner_id: auth.currentUser.uid,
        created_at: new Date().toISOString()
      });

      // Log activity
      await addDoc(collection(db, 'activities'), {
        owner_id: auth.currentUser.uid,
        type: 'Meeting',
        content: `Scheduled: ${newAppointment.title}`,
        timestamp: new Date().toISOString()
      });

      setIsAddingAppointment(false);
      setNewAppointment({
        title: '',
        description: '',
        start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        end_time: format(addHours(new Date(), 1), "yyyy-MM-dd'T'HH:mm"),
        location: '',
        lead_id: '',
        customer_id: '',
        status: 'Scheduled'
      });
      toast.success('Appointment scheduled');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'appointments');
      toast.error('Failed to schedule appointment');
    }
  };

  const handleUpdateStatus = async (appointmentId: string, newStatus: Appointment['status']) => {
    try {
      await updateDoc(doc(db, 'appointments', appointmentId), {
        status: newStatus
      });
      toast.success(`Appointment marked as ${newStatus}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `appointments/${appointmentId}`);
      toast.error('Failed to update status');
    }
  };

  const filteredAppointments = appointments.filter(app => 
    app.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedDateAppointments = appointments.filter(app => 
    isSameDay(parseISO(app.start_time), selectedDate)
  );

  return (
    <div className="p-8 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tighter uppercase italic">Upcoming Appointments</h1>
          <p className="text-neutral-500 text-sm font-medium">Manage your schedule and appointments</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddingAppointment(true)}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-neutral-950 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            New Appointment
          </button>
        </div>
      </header>

      <div className="flex items-center gap-4 bg-white/5 p-2 rounded-2xl border border-white/10 w-fit">
        <button 
          onClick={() => setView('calendar')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            view === 'calendar' ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-white"
          )}
        >
          <CalendarIcon className="w-4 h-4" />
          Calendar
        </button>
        <button 
          onClick={() => setView('table')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all",
            view === 'table' ? "bg-emerald-500 text-neutral-950" : "text-neutral-400 hover:text-white"
          )}
        >
          <List className="w-4 h-4" />
          Table
        </button>
      </div>

      {view === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6">
            <Calendar 
              onChange={(val) => setSelectedDate(val as Date)} 
              value={selectedDate}
              className="w-full"
            />
          </div>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-emerald-500">
                {format(selectedDate, 'MMMM d, yyyy')}
              </h3>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                {selectedDateAppointments.length} Events
              </span>
            </div>
            <div className="space-y-4">
              {selectedDateAppointments.length > 0 ? (
                selectedDateAppointments.map(app => (
                  <motion.div 
                    key={app.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 border border-white/10 rounded-2xl hover:border-emerald-500/30 transition-all group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-sm mb-1 group-hover:text-emerald-500 transition-colors">{app.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                          <Clock className="w-3 h-3" />
                          {format(parseISO(app.start_time), 'h:mm a')} - {format(parseISO(app.end_time), 'h:mm a')}
                        </div>
                      </div>
                      <select 
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.id, e.target.value as Appointment['status'])}
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border outline-none transition-all cursor-pointer",
                          STATUS_COLORS[app.status]
                        )}
                      >
                        <option value="Scheduled" className="bg-neutral-900">Scheduled</option>
                        <option value="Completed" className="bg-neutral-900">Completed</option>
                        <option value="Cancelled" className="bg-neutral-900">Cancelled</option>
                        <option value="No Show" className="bg-neutral-900">No Show</option>
                      </select>
                    </div>
                    {app.location && (
                      <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
                        <MapPin className="w-3 h-3" />
                        {app.location}
                      </div>
                    )}
                    {app.description && (
                      <p className="text-xs text-neutral-500 line-clamp-2 italic">"{app.description}"</p>
                    )}
                  </motion.div>
                ))
              ) : (
                <div className="text-center py-12 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                  <CalendarIcon className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">No appointments today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search appointments..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-2 text-sm outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="p-2 bg-white/5 border border-white/10 rounded-xl text-neutral-400 hover:text-white transition-all">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Appointment</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Date & Time</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Location</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-neutral-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAppointments.map(app => (
                  <tr key={app.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-sm group-hover:text-emerald-500 transition-colors">{app.title}</div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest truncate max-w-[200px]">
                        {app.description || 'No description'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">{format(parseISO(app.start_time), 'MMM d, yyyy')}</div>
                      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">
                        {format(parseISO(app.start_time), 'h:mm a')}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-neutral-400">
                        <MapPin className="w-3 h-3" />
                        {app.location || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={app.status}
                        onChange={(e) => handleUpdateStatus(app.id, e.target.value as Appointment['status'])}
                        className={cn(
                          "text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border outline-none transition-all cursor-pointer",
                          STATUS_COLORS[app.status]
                        )}
                      >
                        <option value="Scheduled" className="bg-neutral-900">Scheduled</option>
                        <option value="Completed" className="bg-neutral-900">Completed</option>
                        <option value="Cancelled" className="bg-neutral-900">Cancelled</option>
                        <option value="No Show" className="bg-neutral-900">No Show</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-all">
                        <MoreVertical className="w-4 h-4 text-neutral-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {isAddingAppointment && (
          <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-neutral-900 border border-white/10 rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter uppercase italic">New Appointment</h2>
                  <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest">Schedule a meeting or event</p>
                </div>
                <button 
                  onClick={() => setIsAddingAppointment(false)}
                  className="p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddAppointment} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Appointment Title</label>
                  <input 
                    required
                    type="text" 
                    value={newAppointment.title}
                    onChange={(e) => setNewAppointment({...newAppointment, title: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., Business Presentation"
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Start Time</label>
                    <input 
                      required
                      type="datetime-local" 
                      value={newAppointment.start_time}
                      onChange={(e) => setNewAppointment({...newAppointment, start_time: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">End Time</label>
                    <input 
                      required
                      type="datetime-local" 
                      value={newAppointment.end_time}
                      onChange={(e) => setNewAppointment({...newAppointment, end_time: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Location / Link</label>
                  <input 
                    type="text" 
                    value={newAppointment.location}
                    onChange={(e) => setNewAppointment({...newAppointment, location: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="e.g., Zoom Link or Physical Address"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Related To (Optional)</label>
                  <select 
                    value={newAppointment.lead_id || newAppointment.customer_id}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (leads.find(l => l.id === val)) {
                        setNewAppointment({...newAppointment, lead_id: val, customer_id: ''});
                      } else {
                        setNewAppointment({...newAppointment, customer_id: val, lead_id: ''});
                      }
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  >
                    <option value="" className="bg-neutral-900">None</option>
                    <optgroup label="Leads" className="bg-neutral-900">
                      {leads.map(lead => (
                        <option key={lead.id} value={lead.id} className="bg-neutral-900">{lead.name}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Customers" className="bg-neutral-900">
                      {customers.map(cust => (
                        <option key={cust.id} value={cust.id} className="bg-neutral-900">{cust.name}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Status</label>
                  <select 
                    value={newAppointment.status}
                    onChange={(e) => setNewAppointment({...newAppointment, status: e.target.value as Appointment['status']})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  >
                    <option value="Scheduled" className="bg-neutral-900 text-white">Scheduled</option>
                    <option value="Completed" className="bg-neutral-900 text-white">Completed</option>
                    <option value="Cancelled" className="bg-neutral-900 text-white">Cancelled</option>
                    <option value="No Show" className="bg-neutral-900 text-white">No Show</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Notes</label>
                  <textarea 
                    value={newAppointment.description}
                    onChange={(e) => setNewAppointment({...newAppointment, description: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all h-24 resize-none"
                    placeholder="Add any additional details..."
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  CREATE APPOINTMENT
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
