import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, getDocs, deleteDoc, setDoc, addDoc, writeBatch } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { 
  Users, 
  UserPlus, 
  Shield, 
  TrendingUp, 
  Award, 
  AlertCircle,
  ChevronRight,
  Search,
  Filter,
  MessageCircle,
  Phone,
  ArrowRight,
  AlertTriangle,
  Copy,
  Link as LinkIcon,
  X,
  UserCheck,
  ShieldAlert,
  Edit2,
  Trash2,
  Save
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import TeamActivityFeed from './TeamActivityFeed';
import { cn } from '../lib/utils';

interface TeamMember extends UserProfile {
  id: string;
  direct_downlines?: number;
  total_team_pv?: number;
}

export default function TeamHub({ profile }: { profile: UserProfile | null }) {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [isManagingPermissions, setIsManagingPermissions] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showAllPartners, setShowAllPartners] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    pin_level: '',
    amway_id: ''
  });

  const [isInviting, setIsInviting] = useState(false);
  const [inviteMode, setInviteMode] = useState<'link' | 'manual'>('link');
  const [invitePhone, setInvitePhone] = useState('');
  const [manualPartner, setManualPartner] = useState({
    name: '',
    email: '',
    pin_level: '3%',
    role: 'user' as 'admin' | 'user'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // In a real multi-level system, we'd query by upline_id
    // For this demo, we'll fetch all users if the current user is an admin,
    // or just their downlines if they are a regular leader.
    const q = profile?.role === 'admin' 
      ? query(collection(db, 'users'))
      : query(collection(db, 'users'), where('upline_id', '==', auth.currentUser.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teamData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember));
      // Filter out the current user from the team list if they are an admin
      const filteredData = profile?.role === 'admin' 
        ? teamData.filter(m => m.uid !== auth.currentUser?.uid)
        : teamData;
      setTeam(filteredData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching team:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.role, profile?.uid]);

  const filteredTeam = team.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         member.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || member.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const stats = {
    totalPartners: team.length,
    activePV: team.reduce((acc, curr) => acc + (curr.current_pv || 0), 0),
    topPerformer: [...team].sort((a, b) => (b.current_pv || 0) - (a.current_pv || 0))[0],
    atRisk: team.filter(m => (m.current_pv || 0) < 50)
  };

  const referralLink = `${window.location.origin}/?ref=${auth.currentUser?.uid}`;

  const copyReferralLink = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Referral link copied!', {
      description: 'Share this link to onboard new partners directly to your team.'
    });
  };

  const handleUpdateRole = async (memberId: string, newRole: 'admin' | 'user') => {
    try {
      await updateDoc(doc(db, 'users', memberId), { role: newRole });
      toast.success(`Role updated to ${newRole}`);
      setIsManagingPermissions(false);
      setSelectedMember(null);
      
      // Log activity
      await addDoc(collection(db, 'team_activities'), {
        user_id: auth.currentUser?.uid,
        user_name: profile?.name || 'Admin',
        action: `updated role for ${team.find(m => m.id === memberId)?.name} to ${newRole}`,
        timestamp: new Date().toISOString(),
        type: 'achievement'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${memberId}`);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete) return;
    
    try {
      await deleteDoc(doc(db, 'users', memberToDelete.id));
      toast.success('Partner removed from team');
      
      // Log activity
      await addDoc(collection(db, 'team_activities'), {
        user_id: auth.currentUser?.uid,
        user_name: profile?.name || 'Admin',
        action: `removed ${memberToDelete.name || 'a partner'} from the team`,
        timestamp: new Date().toISOString(),
        type: 'default'
      });
      setMemberToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${memberToDelete.id}`);
    }
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;

    try {
      const memberRef = doc(db, 'users', selectedMember.id);
      await updateDoc(memberRef, {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        pin_level: editForm.pin_level,
        amway_id: editForm.amway_id
      });
      
      toast.success('Partner details updated');
      setIsEditingMember(false);
      setSelectedMember(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedMember.id}`);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !manualPartner.name || !manualPartner.email) return;

    setIsSubmitting(true);
    try {
      const tempId = `manual_${Date.now()}`;
      const newPartner = {
        uid: tempId,
        name: manualPartner.name,
        email: manualPartner.email,
        pin_level: manualPartner.pin_level,
        role: manualPartner.role,
        upline_id: auth.currentUser.uid,
        current_pv: 0,
        current_bv: 0,
        goal_pv: 100,
        goal_bv: 300,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', tempId), newPartner);

      await addDoc(collection(db, 'team_activities'), {
        user_id: auth.currentUser.uid,
        user_name: profile?.name || 'Leader',
        action: `manually added a new partner: ${manualPartner.name}`,
        timestamp: new Date().toISOString(),
        type: 'signup'
      });

      toast.success('Partner added manually');
      setIsInviting(false);
      setManualPartner({ name: '', email: '', pin_level: '3%', role: 'user' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = () => {
    if (!invitePhone) return;
    const text = encodeURIComponent(`Hi! I'd love for you to join my Amway team. You can sign up here: ${referralLink}`);
    const cleanPhone = invitePhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    toast.success('WhatsApp opened');
  };

  const handleClearAllPartners = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      let count = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Protect the main admin and the current user
        if (data.email !== 'bennietay.agency@gmail.com' && doc.id !== auth.currentUser?.uid) {
          batch.delete(doc.ref);
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        toast.success(`${count} partners cleared successfully`);
        
        await addDoc(collection(db, 'team_activities'), {
          user_id: auth.currentUser?.uid,
          user_name: profile?.name || 'Admin',
          action: `cleared ${count} partners from the system`,
          timestamp: new Date().toISOString(),
          type: 'default'
        });
      } else {
        toast.info('No partners found to clear');
      }
      setIsConfirmingClearAll(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'users');
    }
  };

  // Mock historical data - in a real app, this would be fetched from a 'pv_history' collection
  const growthData = [
    { month: 'Oct', pv: Math.max(0, stats.activePV * 0.6) },
    { month: 'Nov', pv: Math.max(0, stats.activePV * 0.75) },
    { month: 'Dec', pv: Math.max(0, stats.activePV * 0.8) },
    { month: 'Jan', pv: Math.max(0, stats.activePV * 0.85) },
    { month: 'Feb', pv: Math.max(0, stats.activePV * 0.9) },
    { month: 'Mar', pv: stats.activePV },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter">Team Intelligence</h1>
          <p className="text-neutral-400">Manage your downline and monitor team performance.</p>
        </div>
        <div className="flex items-center gap-3">
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setIsConfirmingClearAll(true)}
              className="px-4 py-3 bg-red-500/10 text-red-500 border border-red-500/20 font-bold rounded-2xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
              title="Clear all partners (Mock Data)"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          )}
          <button 
            onClick={() => setIsInviting(true)}
            className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <UserPlus className="w-4 h-4" />
            Invite Partner
          </button>
        </div>
      </header>

      {/* Team Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total Partners', value: stats.totalPartners, icon: Users, color: 'text-blue-500' },
          { label: 'Team PV', value: stats.activePV, icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Top Performer', value: stats.topPerformer?.name || 'N/A', icon: Award, color: 'text-amber-500' },
          { label: 'At Risk', value: stats.atRisk.length, icon: AlertCircle, color: 'text-red-500' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white/5 border border-white/10 rounded-3xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 bg-white/5 rounded-2xl ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold truncate">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Growth Chart Section */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-bold tracking-tight">Team PV Velocity</h3>
            <p className="text-sm text-neutral-500">Historical growth over the last 6 months</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-xl text-[10px] font-black uppercase tracking-widest">
            <TrendingUp className="w-3 h-3" />
            +12% vs last month
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="teamPvGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
              <XAxis 
                dataKey="month" 
                stroke="#ffffff40" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                dy={10}
              />
              <YAxis 
                stroke="#ffffff40" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `${val} PV`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#171717', 
                  border: '1px solid #ffffff10', 
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                itemStyle={{ color: '#10b981' }}
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
              />
              <Area 
                type="monotone" 
                dataKey="pv" 
                stroke="#10b981" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#teamPvGradient)" 
                animationDuration={2000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* At Risk Members Section */}
      {stats.atRisk.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-xl text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-red-500">At Risk Partners</h3>
                <p className="text-xs text-neutral-500">Members with current PV below 50</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest">
              {stats.atRisk.length} Members
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.atRisk.map((member) => (
              <motion.div 
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-red-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center font-bold text-red-500">
                    {member.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{member.name}</p>
                    <p className="text-[10px] text-red-500/70 font-bold uppercase tracking-widest">{member.current_pv} PV</p>
                  </div>
                </div>
                <a 
                  href={`https://wa.me/${member.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi ${member.name}, I noticed your PV is at ${member.current_pv}. How can I help you reach your goals this month?`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "p-2 bg-white/5 rounded-lg transition-all",
                    member.phone ? "text-neutral-500 hover:text-white hover:bg-emerald-500/20" : "text-neutral-700 cursor-not-allowed pointer-events-none"
                  )}
                  title={member.phone ? `WhatsApp ${member.name}` : "No phone number"}
                >
                  <MessageCircle className="w-4 h-4" />
                </a>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Team List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Search team members..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
              <Filter className="w-4 h-4 text-neutral-500" />
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as any)}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer"
              >
                <option value="all" className="bg-neutral-900">All Roles</option>
                <option value="admin" className="bg-neutral-900">Admins</option>
                <option value="user" className="bg-neutral-900">Users</option>
              </select>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Partner</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Pin Level</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Current PV</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredTeam.map((member) => (
                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-emerald-500">
                            {member.name[0]}
                          </div>
                          <div>
                            <p className="font-bold">{member.name}</p>
                            <p className="text-xs text-neutral-500">{member.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full text-[10px] font-bold uppercase tracking-wider">
                          {member.pin_level || '3%'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold">
                        {member.current_pv || 0} PV
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          {member.role === 'admin' ? (
                            <Shield className="w-3 h-3 text-amber-500" />
                          ) : (
                            <Users className="w-3 h-3 text-neutral-500" />
                          )}
                          <span className="text-xs capitalize">{member.role}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <a 
                            href={`https://wa.me/${member.phone?.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "p-2 hover:bg-white/10 rounded-lg transition-all",
                              member.phone ? "text-neutral-400 hover:text-emerald-500" : "text-neutral-600 cursor-not-allowed pointer-events-none"
                            )}
                            title={member.phone ? `WhatsApp ${member.name}` : "No phone number"}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          {member.phone && (
                            <a 
                              href={`tel:${member.phone}`}
                              className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-white transition-all"
                              title={`Call ${member.name}`}
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          {profile?.role === 'admin' && (
                            <>
                              <button 
                                onClick={() => {
                                  setSelectedMember(member);
                                  setEditForm({
                                    name: member.name,
                                    email: member.email,
                                    phone: member.phone || '',
                                    pin_level: member.pin_level || '3%',
                                    amway_id: member.amway_id || ''
                                  });
                                  setIsEditingMember(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-emerald-500 transition-all"
                                title="Edit Partner"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => {
                                  setSelectedMember(member);
                                  setIsManagingPermissions(true);
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-amber-500 transition-all"
                                title="Manage Permissions"
                              >
                                <ShieldAlert className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setMemberToDelete(member)}
                                className="p-2 hover:bg-white/10 rounded-lg text-neutral-400 hover:text-red-500 transition-all"
                                title="Delete Partner"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Team Hierarchy Visualization (Simplified) */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6">Team Structure</h3>
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-neutral-950 font-bold">
                    {profile?.name?.[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold">You (Leader)</p>
                    <p className="text-[10px] text-emerald-500/70 uppercase font-bold tracking-widest">{profile?.pin_level}</p>
                  </div>
                </div>
              </div>
              
              <div className="ml-6 border-l-2 border-white/5 pl-6 space-y-4">
                {(showAllPartners ? team : team.slice(0, 3)).map((member) => (
                  <div key={member.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl relative">
                    <div className="absolute -left-6 top-1/2 -translate-y-1/2 w-6 h-0.5 bg-white/5" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold">
                          {member.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{member.name}</p>
                          <p className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">{member.pin_level || '3%'}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-neutral-600" />
                    </div>
                  </div>
                ))}
                {team.length > 3 && (
                  <button 
                    onClick={() => setShowAllPartners(!showAllPartners)}
                    className="text-xs text-emerald-500 hover:text-emerald-400 font-bold transition-colors pl-2"
                  >
                    {showAllPartners ? 'Show Less' : `+ ${team.length - 3} more partners`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Team Activity Feed */}
          <TeamActivityFeed />
        </div>
      </div>

      {/* Role Management Modal */}
      {isManagingPermissions && selectedMember && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Manage Permissions</h2>
              </div>
              <button 
                onClick={() => {
                  setIsManagingPermissions(false);
                  setSelectedMember(null);
                }}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <p className="text-xs text-neutral-500 uppercase font-black tracking-widest mb-2">Member</p>
              <p className="font-bold text-white">{selectedMember.name}</p>
              <p className="text-xs text-neutral-400">{selectedMember.email}</p>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-neutral-500 uppercase font-black tracking-widest ml-1">Select Role</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleUpdateRole(selectedMember.id, 'user')}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                    selectedMember.role === 'user' 
                      ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" 
                      : "bg-white/5 border-white/10 text-neutral-500 hover:border-white/20"
                  )}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold">User</span>
                </button>
                <button
                  onClick={() => handleUpdateRole(selectedMember.id, 'admin')}
                  className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col items-center gap-2",
                    selectedMember.role === 'admin' 
                      ? "bg-amber-500/10 border-amber-500 text-amber-500" 
                      : "bg-white/5 border-white/10 text-neutral-500 hover:border-white/20"
                  )}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-xs font-bold">Admin</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
              <p className="text-[10px] text-amber-500/70 font-bold leading-relaxed">
                <AlertCircle className="w-3 h-3 inline mr-1 mb-0.5" />
                Warning: Granting admin access allows this user to manage other users and resources.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Member Modal */}
      {isEditingMember && selectedMember && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Edit2 className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Edit Partner</h2>
              </div>
              <button 
                onClick={() => {
                  setIsEditingMember(false);
                  setSelectedMember(null);
                }}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                <input 
                  required
                  type="text" 
                  value={editForm.name}
                  onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                <input 
                  required
                  type="email" 
                  value={editForm.email}
                  onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Phone Number</label>
                <input 
                  type="tel" 
                  value={editForm.phone}
                  onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Pin Level</label>
                  <select 
                    value={editForm.pin_level}
                    onChange={(e) => setEditForm({...editForm, pin_level: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all text-white"
                  >
                    {['3%', '6%', '9%', '12%', '15%', '18%', '21%', 'Silver', 'Gold', 'Platinum', 'Ruby', 'Founders Platinum', 'Sapphire', 'Emerald', 'Diamond'].map(level => (
                      <option key={level} value={level} className="bg-neutral-900">{level}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Amway ID</label>
                  <input 
                    type="text" 
                    value={editForm.amway_id}
                    onChange={(e) => setEditForm({...editForm, amway_id: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all text-white"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Save className="w-5 h-5" />
                Save Changes
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Invite Modal */}
      {isInviting && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold tracking-tight">Add New Partner</h2>
              </div>
              <button 
                onClick={() => setIsInviting(false)}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex p-1 bg-white/5 rounded-2xl">
              <button 
                onClick={() => setInviteMode('link')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                  inviteMode === 'link' ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                Referral Link
              </button>
              <button 
                onClick={() => setInviteMode('manual')}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-xl transition-all",
                  inviteMode === 'manual' ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
                )}
              >
                Manual Add
              </button>
            </div>
            
            <div className="space-y-6">
              {inviteMode === 'link' ? (
                <div className="space-y-6">
                  <p className="text-sm text-neutral-400">
                    Share this referral link with your potential partners. When they sign up, they will be automatically added to your downline.
                  </p>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Your Referral Link</label>
                    <div className="flex gap-2">
                      <input 
                        readOnly
                        type="text" 
                        value={referralLink}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none text-xs font-mono text-neutral-400"
                      />
                      <button 
                        onClick={copyReferralLink}
                        className="p-3 bg-emerald-500 text-neutral-950 rounded-xl hover:bg-emerald-400 transition-all"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest mb-4 ml-1">Or Invite via WhatsApp</p>
                    <div className="flex gap-2">
                      <input 
                        type="tel" 
                        placeholder="+1234567890"
                        value={invitePhone}
                        onChange={(e) => setInvitePhone(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-white"
                      />
                      <button 
                        onClick={handleSendWhatsApp}
                        className="px-4 py-3 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-xl font-bold text-sm transition-all"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleManualAdd} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                    <input 
                      required
                      type="text" 
                      placeholder="John Doe"
                      value={manualPartner.name}
                      onChange={(e) => setManualPartner({...manualPartner, name: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
                    <input 
                      required
                      type="email" 
                      placeholder="john@example.com"
                      value={manualPartner.email}
                      onChange={(e) => setManualPartner({...manualPartner, email: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Pin Level</label>
                      <select 
                        value={manualPartner.pin_level}
                        onChange={(e) => setManualPartner({...manualPartner, pin_level: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-white"
                      >
                        {['3%', '6%', '9%', '12%', '15%', '18%', '21%', 'Silver', 'Gold', 'Platinum'].map(p => (
                          <option key={p} value={p} className="bg-neutral-900">{p}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Role</label>
                      <select 
                        value={manualPartner.role}
                        onChange={(e) => setManualPartner({...manualPartner, role: e.target.value as any})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 text-white"
                      >
                        <option value="user" className="bg-neutral-900">User</option>
                        <option value="admin" className="bg-neutral-900">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all disabled:opacity-50 mt-4"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Partner'}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full space-y-6"
          >
            <div className="flex items-center gap-4 text-red-500">
              <div className="p-3 bg-red-500/10 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight">Remove Partner?</h2>
            </div>
            
            <p className="text-neutral-400 text-sm leading-relaxed">
              Are you sure you want to remove <span className="text-white font-bold">{memberToDelete.name}</span> from your team? This action cannot be undone and they will lose access to team resources.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setMemberToDelete(null)}
                className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteMember}
                className="flex-1 py-4 bg-red-500 text-neutral-950 font-black rounded-2xl hover:bg-red-400 transition-all shadow-lg shadow-red-500/20"
              >
                Remove
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {isConfirmingClearAll && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-red-500/20 rounded-[2rem] p-8 max-w-md w-full space-y-6"
          >
            <div className="flex items-center gap-4 text-red-500">
              <div className="p-3 bg-red-500/10 rounded-2xl">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold tracking-tight uppercase">Critical Action</h2>
            </div>
            
            <div className="space-y-4">
              <p className="text-neutral-400 text-sm leading-relaxed">
                This will remove <span className="text-white font-bold italic">ALL partners</span> from the system except for you and the primary administrator.
              </p>
              <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl">
                <p className="text-xs text-red-400 font-bold">This is intended for clearing mock data and cannot be reversed.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setIsConfirmingClearAll(false)}
                className="flex-1 py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleClearAllPartners}
                className="flex-1 py-4 bg-red-500 text-neutral-950 font-black rounded-2xl hover:bg-red-400 transition-all shadow-lg shadow-red-500/20"
              >
                Clear All
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
