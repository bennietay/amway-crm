import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Expense } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { TrendingUp, DollarSign, Target, Award, Plus, Trash2, Edit2, Save, X, Calculator, ArrowUpRight, BarChart3, Info, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface PVTrackerProps {
  profile: UserProfile | null;
}

export default function PVTracker({ profile }: PVTrackerProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [isUpdatingPV, setIsUpdatingPV] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [bvPvRatio, setBvPvRatio] = useState(3); // Default ratio
  const [autoCalculateBv, setAutoCalculateBv] = useState(true);

  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: 'Samples & Demos' as Expense['category'],
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [tempGoals, setTempGoals] = useState({
    goal_pv: profile?.goal_pv?.toString() || '100',
    goal_bv: profile?.goal_bv?.toString() || '300'
  });

  const [tempPV, setTempPV] = useState({
    current_pv: profile?.current_pv?.toString() || '0',
    current_bv: profile?.current_bv?.toString() || '0'
  });

  const [pvInputError, setPvInputError] = useState<string | null>(null);
  const [bvInputError, setBvInputError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setTempGoals({
        goal_pv: profile.goal_pv.toString(),
        goal_bv: (profile.goal_bv || profile.goal_pv * bvPvRatio).toString()
      });
      setTempPV({
        current_pv: profile.current_pv.toString(),
        current_bv: profile.current_bv.toString()
      });
    }
  }, [profile]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'expenses'), where('owner_id', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    // Validation
    const newErrors: Record<string, string> = {};
    const amountNum = parseFloat(newExpense.amount);
    if (isNaN(amountNum) || amountNum <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!newExpense.description.trim()) newErrors.description = 'Description is required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        amount: amountNum,
        category: newExpense.category,
        description: newExpense.description,
        date: newExpense.date,
        owner_id: auth.currentUser.uid
      });
      setIsAddingExpense(false);
      setErrors({});
      setNewExpense({ 
        amount: '', 
        category: 'Samples & Demos', 
        description: '', 
        date: new Date().toISOString().split('T')[0] 
      });
      toast.success('Expense logged successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
      toast.error('Failed to log expense');
    }
  };

  const handleUpdatePV = async () => {
    if (!auth.currentUser || !profile) return;
    
    const pvNum = parseFloat(tempPV.current_pv);
    const bvNum = parseFloat(tempPV.current_bv);

    if (isNaN(pvNum) || pvNum < 0) {
      setPvInputError('Invalid PV value');
      return;
    }
    if (isNaN(bvNum) || bvNum < 0) {
      setBvInputError('Invalid BV value');
      return;
    }

    try {
      const oldPv = profile.current_pv || 0;
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        current_pv: pvNum,
        current_bv: bvNum
      });

      // Log notable achievement if PV increased significantly or reached a milestone
      if (pvNum > oldPv && pvNum >= 100) {
        const milestones = [100, 300, 600, 1200, 2400, 4000, 7500];
        const reachedMilestone = milestones.find(m => pvNum >= m && oldPv < m);
        
        if (reachedMilestone || (pvNum - oldPv) >= 100) {
          await addDoc(collection(db, 'team_activities'), {
            user_id: auth.currentUser.uid,
            user_name: profile.name,
            action: reachedMilestone 
              ? `reached ${reachedMilestone} PV milestone!` 
              : `achieved a significant PV boost to ${pvNum}!`,
            timestamp: new Date().toISOString(),
            type: 'pv_achievement'
          });
        }
      }

      setIsUpdatingPV(false);
      setPvInputError(null);
      setBvInputError(null);
      toast.success('PV/BV stats updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      toast.error('Failed to update stats');
    }
  };

  const handleUpdateGoals = async () => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        goal_pv: Number(tempGoals.goal_pv) || 0,
        goal_bv: Number(tempGoals.goal_bv) || 0
      });
      setIsEditingGoals(false);
      toast.success('Goals updated');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
      toast.error('Failed to update goals');
    }
  };

  const syncBvFromPv = (pv: string) => {
    setPvInputError(null);
    const pvNum = parseFloat(pv);
    if (!isNaN(pvNum)) {
      setTempPV(prev => ({
        ...prev,
        current_pv: pv,
        current_bv: (pvNum * bvPvRatio).toFixed(2)
      }));
    } else {
      setTempPV(prev => ({ ...prev, current_pv: pv }));
      if (pv !== '') setPvInputError('Please enter a valid number');
    }
  };

  const syncGoalBvFromPv = (pv: string) => {
    const pvNum = parseFloat(pv);
    if (!isNaN(pvNum)) {
      setTempGoals(prev => ({
        ...prev,
        goal_pv: pv,
        goal_bv: (pvNum * bvPvRatio).toFixed(2)
      }));
    } else {
      setTempGoals(prev => ({ ...prev, goal_pv: pv }));
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'expenses', id));
      toast.success('Expense deleted');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
      toast.error('Failed to delete expense');
    }
  };

  const categoryTotals = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const data = [
    { name: 'Jan', pv: 40, bv: 120 },
    { name: 'Feb', pv: 65, bv: 195 },
    { name: 'Mar', pv: profile?.current_pv || 85, bv: (profile?.current_pv || 85) * 3 },
  ];

  const stats = [
    { label: 'Personal PV', value: profile?.current_pv || 0, icon: Target, color: 'text-emerald-500' },
    { label: 'Group PV', value: (profile?.current_pv || 0) * 1.5, icon: TrendingUp, color: 'text-blue-500' }, // Mock group logic
    { label: 'Total BV', value: profile?.current_bv || 0, icon: DollarSign, color: 'text-amber-500' },
    { label: 'Next Pin', value: '6%', icon: Award, color: 'text-purple-500' },
  ];

  const pvProgress = Math.min(100, ((profile?.current_pv || 0) / (profile?.goal_pv || 100)) * 100);
  const bvProgress = Math.min(100, ((profile?.current_bv || 0) / (profile?.goal_bv || 300)) * 100);

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const currentDay = new Date().getDate();
  const projectedPv = Math.round(((profile?.current_pv || 0) / currentDay) * daysInMonth);

  const PIN_LEVELS = [
    { level: '3%', pv: 100 },
    { level: '6%', pv: 300 },
    { level: '9%', pv: 600 },
    { level: '12%', pv: 1200 },
    { level: '15%', pv: 2400 },
    { level: '18%', pv: 4000 },
    { level: '21%', pv: 7500 },
  ];

  const nextPin = PIN_LEVELS.find(p => p.pv > (profile?.current_pv || 0)) || PIN_LEVELS[PIN_LEVELS.length - 1];
  const pvToNextPin = Math.max(0, nextPin.pv - (profile?.current_pv || 0));

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tighter">PV/BV Intelligence</h1>
          <p className="text-neutral-400">Real-time performance tracking and goal forecasting.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsUpdatingPV(true)}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            Update PV/BV
          </button>
          <button 
            onClick={() => setIsAddingExpense(true)}
            className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-2xl bg-white/5 ${stat.color}`}>
                <stat.icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Monthly</span>
            </div>
            <div>
              <p className="text-sm text-neutral-400">{stat.label}</p>
              <p className="text-3xl font-bold tracking-tighter">
                {stat.label === 'Next Pin' ? nextPin.level : stat.value}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold">Growth Trajectory</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Actual PV</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/30" />
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Projected</span>
                </div>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#171717', border: '1px solid #ffffff10', borderRadius: '12px' }}
                    itemStyle={{ color: '#10b981' }}
                  />
                  <Area type="monotone" dataKey="pv" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPv)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-neutral-900 border border-white/10 rounded-3xl p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart3 className="w-24 h-24" />
              </div>
              <div className="relative z-10 space-y-4">
                <h4 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Month-End Projection</h4>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black tracking-tighter text-emerald-500">{projectedPv}</span>
                  <span className="text-sm font-bold text-neutral-500 uppercase tracking-widest">PV</span>
                </div>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Based on your current velocity of <span className="text-white font-bold">{((profile?.current_pv || 0) / currentDay).toFixed(1)} PV/day</span>, you are on track to finish at <span className="text-white font-bold">{projectedPv} PV</span>.
                </p>
                <div className="pt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  <TrendingUp className="w-3 h-3" />
                  {projectedPv >= (profile?.goal_pv || 100) ? 'On track for goal' : 'Behind goal pace'}
                </div>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
              <h4 className="text-xs font-black text-neutral-500 uppercase tracking-[0.2em]">Pin Level Roadmap</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold">
                      {nextPin.level}
                    </div>
                    <div>
                      <p className="text-sm font-bold">Next Milestone</p>
                      <p className="text-xs text-neutral-500">{nextPin.pv} PV Required</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">{pvToNextPin}</p>
                    <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">PV to go</p>
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 rounded-full" 
                    style={{ width: `${Math.min(100, ((profile?.current_pv || 0) / nextPin.pv) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                  <Info className="w-3 h-3" />
                  Reach {nextPin.pv} PV to unlock the {nextPin.level} bonus level.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 space-y-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">Goal Tracking</h3>
            <button 
              onClick={() => setIsEditingGoals(!isEditingGoals)}
              className="p-2 hover:bg-white/5 rounded-xl text-neutral-500 hover:text-white transition-all"
            >
              {isEditingGoals ? <X className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
            </button>
          </div>

          {isEditingGoals ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Monthly PV Goal</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    value={tempGoals.goal_pv}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (autoCalculateBv) {
                        syncGoalBvFromPv(val);
                      } else {
                        setTempGoals({...tempGoals, goal_pv: val});
                      }
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50"
                  />
                  <button 
                    onClick={() => syncGoalBvFromPv(tempGoals.goal_pv)}
                    className="px-3 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 rounded-xl transition-all"
                    title="Calculate BV from PV"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Monthly BV Goal</label>
                <input 
                  type="number"
                  value={tempGoals.goal_bv}
                  onChange={(e) => setTempGoals({...tempGoals, goal_bv: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 outline-none focus:border-emerald-500/50"
                />
              </div>
              <button 
                onClick={handleUpdateGoals}
                className="w-full py-3 bg-emerald-500 text-neutral-950 font-bold rounded-xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Goals
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-neutral-500">
                  <span>PV Progress</span>
                  <span>{profile?.current_pv || 0} / {profile?.goal_pv || 100}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${pvProgress}%` }}
                    className="h-full bg-emerald-500 rounded-full" 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-neutral-500">
                  <span>BV Progress</span>
                  <span>{profile?.current_bv || 0} / {profile?.goal_bv || 300}</span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${bvProgress}%` }}
                    className="h-full bg-amber-500 rounded-full" 
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-white/10">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-sm text-neutral-400">Estimated Bonus</p>
                    <p className="text-4xl font-bold text-emerald-500 tracking-tighter">
                      ${((profile?.current_bv || 0) * (parseInt(profile?.pin_level || '3') / 100)).toFixed(2)}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-500 mb-1">Based on {profile?.pin_level || '3%'}</span>
                </div>
              </div>
            </div>
          )}

          <div className="pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Calculation Engine</p>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div 
                    onClick={() => setAutoCalculateBv(!autoCalculateBv)}
                    className={cn(
                      "w-8 h-4 rounded-full transition-all relative",
                      autoCalculateBv ? "bg-emerald-500" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                      autoCalculateBv ? "left-4.5" : "left-0.5"
                    )} />
                  </div>
                  <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest group-hover:text-white transition-colors">Auto-BV</span>
                </label>
                <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg">
                  <span className="text-[10px] text-neutral-500">Ratio:</span>
                  <input 
                    type="number" 
                    value={bvPvRatio} 
                    onChange={(e) => setBvPvRatio(Number(e.target.value))}
                    className="w-8 bg-transparent text-[10px] font-bold outline-none text-emerald-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-400">Samples & Demos</span>
              <span className="font-mono text-red-400">-${categoryTotals['Samples & Demos'] || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-400">Travel Expenses</span>
              <span className="font-mono text-red-400">-${categoryTotals['Travel'] || 0}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-neutral-400">Subscriptions</span>
              <span className="font-mono text-red-400">-${categoryTotals['Subscriptions'] || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Update PV/BV Modal */}
      {isUpdatingPV && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">Update Performance</h2>
              <button onClick={() => setIsUpdatingPV(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-xl",
                    autoCalculateBv ? "bg-emerald-500/10 text-emerald-500" : "bg-neutral-500/10 text-neutral-500"
                  )}>
                    <Calculator className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold">Auto-Calculate BV</p>
                    <p className="text-[10px] text-neutral-500">Sync BV based on PV ratio</p>
                  </div>
                </div>
                <div 
                  onClick={() => setAutoCalculateBv(!autoCalculateBv)}
                  className={cn(
                    "w-10 h-5 rounded-full transition-all relative cursor-pointer",
                    autoCalculateBv ? "bg-emerald-500" : "bg-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-3 h-3 rounded-full bg-white transition-all",
                    autoCalculateBv ? "left-6" : "left-1"
                  )} />
                </div>
              </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Current Personal PV</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    step="0.01"
                    value={tempPV.current_pv}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (autoCalculateBv) {
                        syncBvFromPv(val);
                      } else {
                        setTempPV({...tempPV, current_pv: val});
                        setPvInputError(null);
                      }
                    }}
                    className={cn(
                      "flex-1 bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                      pvInputError ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-emerald-500/50"
                    )}
                  />
                  <button 
                    onClick={() => syncBvFromPv(tempPV.current_pv)}
                    className="px-3 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 rounded-xl transition-all"
                    title="Calculate BV from PV"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
                {pvInputError && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">{pvInputError}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Current Personal BV</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={tempPV.current_bv}
                  onChange={(e) => {
                    setTempPV({...tempPV, current_bv: e.target.value});
                    setBvInputError(null);
                  }}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    bvInputError ? "border-red-500/50 focus:border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                />
                {bvInputError && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-1">{bvInputError}</p>}
              </div>
              <button 
                onClick={handleUpdatePV}
                className="w-full py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all"
              >
                Update Stats
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Expense Modal */}
      {isAddingExpense && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">Log Expense</h2>
              <button onClick={() => { setIsAddingExpense(false); setErrors({}); }} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Amount ($)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({...newExpense, amount: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.amount ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="0.00"
                />
                {errors.amount && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.amount}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Category</label>
                <select 
                  value={newExpense.category}
                  onChange={(e) => setNewExpense({...newExpense, category: e.target.value as any})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                >
                  <option value="Samples & Demos">Samples & Demos</option>
                  <option value="Travel">Travel</option>
                  <option value="Subscriptions">Subscriptions</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Description</label>
                <input 
                  required
                  type="text" 
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                  className={cn(
                    "w-full bg-white/5 border rounded-xl px-4 py-3 outline-none transition-all",
                    errors.description ? "border-red-500" : "border-white/10 focus:border-emerald-500/50"
                  )}
                  placeholder="Product samples for Sarah"
                />
                {errors.description && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{errors.description}</p>}
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => { setIsAddingExpense(false); setErrors({}); }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-xl font-bold transition-all"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
