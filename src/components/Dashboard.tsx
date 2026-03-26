import React, { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { Task, Lead, UserProfile, Goal } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Zap, 
  TrendingUp, 
  Calendar,
  Clock,
  Trash2,
  Edit2,
  X,
  ArrowUpRight,
  MessageSquare,
  Search,
  MoreVertical,
  Target,
  ChevronRight,
  Minus,
  Sparkles,
  BrainCircuit,
  Lightbulb,
  RefreshCw
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';
import { GoogleGenAI } from "@google/genai";
import { toast } from 'sonner';
import IPAChecklist from './IPAChecklist';
import ActivityFeed from './ActivityFeed';

interface DashboardProps {
  profile: UserProfile | null;
  setActiveTab: (tab: string) => void;
}

export default function Dashboard({ profile, setActiveTab }: DashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newTask, setNewTask] = useState({ 
    title: '', 
    reminder_time: '', 
    priority: 'medium' as Task['priority'],
    category: 'General' as Task['category']
  });
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [taskSort, setTaskSort] = useState<'date' | 'priority'>('date');
  const [newGoal, setNewGoal] = useState({ title: '', target: 0, unit: '', category: 'prospecting' as Goal['category'] });
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prospectingInput, setProspectingInput] = useState('');
  const [isProspecting, setIsProspecting] = useState(false);
  const [prospectingResult, setProspectingResult] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [dailyQuote, setDailyQuote] = useState<{ text: string, author: string } | null>(null);

  const QUICK_TEMPLATES = [
    { title: 'Follow up with 3 prospects', priority: 'high', category: 'IPA' },
    { title: 'Invite 2 people to overview', priority: 'high', category: 'IPA' },
    { title: 'Review training materials', priority: 'medium', category: 'General' },
    { title: 'Check team PV progress', priority: 'medium', category: 'General' },
    { title: 'Post product testimonial', priority: 'low', category: 'General' },
  ];

  const MOTIVATIONAL_QUOTES = [
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
    { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
    { text: "Your network is your net worth.", author: "Porter Gale" },
    { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  ];

  const handleFirestoreError = (error: any, operationType: OperationType, path: string | null) => {
    const errInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const tasksQuery = query(
      collection(db, 'tasks'), 
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc')
    );
    const leadsQuery = query(
      collection(db, 'leads'), 
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('last_contacted', 'desc')
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    const unsubLeads = onSnapshot(leadsQuery, (snapshot) => {
      setLeads(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lead)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'leads');
    });

    const goalsQuery = query(
      collection(db, 'goals'), 
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('created_at', 'desc')
    );

    const unsubGoals = onSnapshot(goalsQuery, (snapshot) => {
      setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'goals');
    });

    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('start_time', 'asc')
    );

    const unsubAppointments = onSnapshot(appointmentsQuery, (snapshot) => {
      setAppointments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    // Set a random daily quote
    setDailyQuote(MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)]);

    return () => {
      unsubTasks();
      unsubLeads();
      unsubGoals();
      unsubAppointments();
    };
  }, []);

  const handleProspecting = async () => {
    if (!prospectingInput.trim()) return;
    setIsProspecting(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Generate a high-converting, professional, and personalized icebreaker for a potential Amway lead based on this context: "${prospectingInput}". 
      Keep it short, curious, and non-spammy. Focus on business opportunity or high-quality products.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setProspectingResult(response.text || "Failed to generate icebreaker.");
      toast.success('Icebreaker generated!');
    } catch (error) {
      console.error('Error in prospecting:', error);
      toast.error('Failed to generate icebreaker.');
      setProspectingResult("Error generating icebreaker. Please try again.");
    } finally {
      setIsProspecting(false);
    }
  };

  const generateInsights = async () => {
    if (leads.length === 0 && tasks.length === 0) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Analyze the following business data for an Amway leader and provide 3-4 short, actionable "AI Insights" or "Recommendations" for today. 
      Focus on lead follow-up, task prioritization, and goal progress.
      
      Leads: ${leads.map(l => `${l.name} (${l.status}, interest: ${l.interest})`).join(', ')}
      Tasks: ${tasks.map(t => `${t.title} (${t.completed ? 'Done' : 'Pending'})`).join(', ')}
      Goals: ${goals.map(g => `${g.title}: ${g.current}/${g.target} ${g.unit}`).join(', ')}
      
      Format the output as a bulleted list of short sentences.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsights(response.text || "No insights available at the moment.");
      toast.success('Business intelligence updated!');
    } catch (error) {
      console.error('Error generating insights:', error);
      toast.error('Failed to generate AI insights.');
      setAiInsights("Failed to generate AI insights. Please try again later.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newTask.title) return;

    try {
      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), {
          title: newTask.title,
          priority: newTask.priority,
          category: newTask.category,
          reminder_time: newTask.reminder_time || null,
        });
        toast.success('Task updated');
      } else {
        await addDoc(collection(db, 'tasks'), {
          owner_id: auth.currentUser.uid,
          title: newTask.title,
          completed: false,
          priority: newTask.priority || 'medium',
          category: newTask.category || 'General',
          reminder_time: newTask.reminder_time || null,
          created_at: new Date().toISOString()
        });
        toast.success('Task added to stack');
      }

      setNewTask({ title: '', reminder_time: '', priority: 'medium', category: 'General' });
      setIsAddingTask(false);
      setEditingTask(null);
    } catch (error) {
      handleFirestoreError(error, editingTask ? OperationType.UPDATE : OperationType.CREATE, 'tasks');
      toast.error(editingTask ? 'Failed to update task' : 'Failed to add task');
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), { completed: !task.completed });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newGoal.title) return;

    try {
      await addDoc(collection(db, 'goals'), {
        owner_id: auth.currentUser.uid,
        title: newGoal.title,
        target: Number(newGoal.target),
        current: 0,
        unit: newGoal.unit,
        category: newGoal.category,
        created_at: new Date().toISOString()
      });

      setNewGoal({ title: '', target: 0, unit: '', category: 'prospecting' });
      setIsAddingGoal(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'goals');
    }
  };

  const updateGoalProgress = async (goal: Goal, increment: number) => {
    try {
      const newCurrent = Math.max(0, goal.current + increment);
      await updateDoc(doc(db, 'goals', goal.id), { current: newCurrent });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `goals/${goal.id}`);
    }
  };

  const deleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `goals/${id}`);
    }
  };

  const addInsightsToTasks = async () => {
    if (!aiInsights || !auth.currentUser) return;
    
    const insightLines = aiInsights.split('\n').filter(line => line.trim());
    
    try {
      for (const line of insightLines) {
        const title = line.replace(/^[*-]\s*/, '').trim();
        if (title) {
          await addDoc(collection(db, 'tasks'), {
            owner_id: auth.currentUser.uid,
            title: `AI: ${title}`,
            completed: false,
            priority: 'medium',
            reminder_time: null,
            created_at: new Date().toISOString()
          });
        }
      }
      setAiInsights(null); // Clear after adding
      toast.success('Insights added to Action Stack');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      toast.error('Failed to add insights to tasks');
    }
  };

  const clearCompletedTasks = async () => {
    const completedTasks = tasks.filter(t => t.completed);
    try {
      for (const task of completedTasks) {
        await deleteDoc(doc(db, 'tasks', task.id));
      }
      setShowClearConfirm(false);
      toast.success('Cleared completed tasks');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'tasks');
      toast.error('Failed to clear tasks');
    }
  };

  const applyTemplate = async (template: typeof QUICK_TEMPLATES[0]) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        owner_id: auth.currentUser.uid,
        title: template.title,
        completed: false,
        priority: template.priority,
        category: template.category,
        reminder_time: null,
        created_at: new Date().toISOString()
      });
      toast.success(`Added: ${template.title}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
      toast.error('Failed to add template task');
    }
  };

  const isReminderDue = (reminderTime: string | null) => {
    if (!reminderTime) return false;
    const now = new Date();
    const reminder = new Date(reminderTime);
    return now >= reminder;
  };

  const filteredTasks = tasks
    .filter(t => {
      if (taskFilter === 'pending') return !t.completed;
      if (taskFilter === 'completed') return t.completed;
      return true;
    })
    .sort((a, b) => {
      if (taskSort === 'priority') {
        const priorityMap = { high: 3, medium: 2, low: 1 };
        return (priorityMap[b.priority || 'low'] || 0) - (priorityMap[a.priority || 'low'] || 0);
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

  const pvData = [
    { name: 'Current', value: profile?.current_pv || 0 },
    { name: 'Remaining', value: Math.max(0, (profile?.goal_pv || 100) - (profile?.current_pv || 0)) },
  ];
  const COLORS = ['#10b981', 'rgba(255,255,255,0.05)'];

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter">Welcome back, {profile?.name?.split(' ')[0]}</h1>
          <p className="text-neutral-400">Here's what's happening in your business today.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const url = `${window.location.origin}?ref=${auth.currentUser?.uid}`;
              navigator.clipboard.writeText(url);
              toast.success('Referral link copied!');
            }}
            className="px-6 py-3 bg-white/5 border border-white/10 text-white font-bold rounded-2xl hover:bg-white/10 transition-all flex items-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            Share Referral
          </button>
          <button 
            onClick={() => setActiveTab('crm')}
            className="px-6 py-3 bg-emerald-500 text-neutral-950 font-bold rounded-2xl hover:bg-emerald-400 transition-all flex items-center gap-2"
          >
            <Zap className="w-4 h-4" />
            New Lead
          </button>
        </div>
      </header>

      {dailyQuote && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 flex items-center gap-6"
        >
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-500/90 italic">"{dailyQuote.text}"</p>
            <p className="text-[10px] font-bold text-emerald-500/50 uppercase tracking-widest mt-1">— {dailyQuote.author}</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {/* AI Insights Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-3 lg:col-span-4 bg-neutral-900 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden group shadow-2xl"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <BrainCircuit className="w-32 h-32" />
          </div>
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500 rounded-xl">
                  <Sparkles className="w-5 h-5 text-neutral-950" />
                </div>
                <h2 className="text-2xl font-black tracking-tighter">Business Intelligence</h2>
              </div>
              <p className="text-neutral-400 max-w-xl">AI-driven recommendations based on your current pipeline and activity stack.</p>
            </div>
            
            <button 
              onClick={generateInsights}
              disabled={isAnalyzing}
              className="px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl font-bold text-sm transition-all flex items-center gap-3 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Lightbulb className="w-4 h-4 text-amber-500" />
              )}
              {isAnalyzing ? 'Analyzing Data...' : 'Generate Insights'}
            </button>
          </div>

          <AnimatePresence>
            {aiInsights && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-8 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="prose prose-invert max-w-none">
                  <div className="text-neutral-300 text-sm leading-relaxed space-y-4">
                    {aiInsights.split('\n').filter(line => line.trim()).map((insight, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="flex gap-3"
                      >
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <p>{insight.replace(/^[*-]\s*/, '')}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
                <div className="bg-white/5 rounded-3xl p-6 flex flex-col justify-center items-center text-center gap-4 border border-white/5">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                    <Zap className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-bold tracking-tight">Ready to execute?</p>
                    <p className="text-xs text-neutral-500">Add these to your Daily Action Stack.</p>
                  </div>
                  <button 
                    onClick={addInsightsToTasks}
                    className="w-full py-3 bg-emerald-500 text-neutral-950 font-bold rounded-xl hover:bg-emerald-400 transition-all text-xs"
                  >
                    Add to Action Stack
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* PV Progress Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-2 lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-100 transition-opacity">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-4">PV Progress</h3>
          <div className="h-48 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pvData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pvData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center mt-4">
              <span className="text-3xl font-bold">{profile?.current_pv || 0}</span>
              <p className="text-xs text-neutral-500">/ {profile?.goal_pv || 100} PV</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-sm font-medium text-emerald-500">
              {Math.round(((profile?.current_pv || 0) / (profile?.goal_pv || 100)) * 100)}% to goal
            </p>
          </div>
        </motion.div>

        {/* Daily Action Stack */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-1 lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col"
        >
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Daily Action Stack</h3>
              <div className="flex items-center gap-2">
                {tasks.some(t => t.completed) && (
                  <button 
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 hover:bg-red-500/10 text-neutral-500 hover:text-red-500 rounded-lg transition-all"
                    title="Clear Completed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="p-1.5 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 rounded-lg transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Priority Legend */}
            <div className="flex items-center gap-4 px-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-tighter">High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-tighter">Med</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span className="text-[8px] font-bold text-neutral-500 uppercase tracking-tighter">Low</span>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
                {(['all', 'pending', 'completed'] as const).map((status) => (
                  <button
                    key={status}
                    onClick={() => setTaskFilter(status)}
                    className={cn(
                      "flex-1 px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      taskFilter === status 
                        ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20" 
                        : "text-neutral-500 hover:text-white"
                    )}
                  >
                    {status}
                  </button>
                ))}
              </div>
              <div className="flex items-center bg-white/5 p-1 rounded-xl border border-white/10">
                {(['date', 'priority'] as const).map((sort) => (
                  <button
                    key={sort}
                    onClick={() => setTaskSort(sort)}
                    className={cn(
                      "flex-1 px-2 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      taskSort === sort 
                        ? "bg-emerald-500 text-neutral-950 shadow-lg shadow-emerald-500/20" 
                        : "text-neutral-500 hover:text-white"
                    )}
                  >
                    {sort === 'date' ? 'Newest' : 'Priority'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {filteredTasks.map((task) => (
              <div 
                key={task.id} 
                className={cn(
                  "flex items-center justify-between group cursor-pointer p-2 rounded-xl transition-all",
                  isReminderDue(task.reminder_time) && !task.completed && "bg-red-500/5 border border-red-500/20"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-1 h-8 rounded-full shrink-0",
                    task.priority === 'high' ? "bg-red-500" :
                    task.priority === 'medium' ? "bg-amber-500" :
                    "bg-blue-500"
                  )} />
                  <button onClick={() => toggleTask(task)} className={cn(
                    "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                    task.completed ? "bg-emerald-500 border-emerald-500" : "border-white/20 group-hover:border-emerald-500/50"
                  )}>
                    {task.completed && <CheckCircle2 className="w-4 h-4 text-neutral-950" />}
                  </button>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm", task.completed ? "text-neutral-500 line-through" : "text-white")}>
                        {task.title}
                      </span>
                    </div>
                    {task.reminder_time && !task.completed && (
                      <span className={cn(
                        "text-[10px] flex items-center gap-1 mt-0.5",
                        isReminderDue(task.reminder_time) ? "text-red-500 font-bold" : "text-neutral-500"
                      )}>
                        <Clock className="w-3 h-3" />
                        {new Date(task.reminder_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingTask(task);
                      setNewTask({
                        title: task.title,
                        reminder_time: task.reminder_time || '',
                        priority: task.priority || 'medium',
                        category: task.category || 'General'
                      });
                      setIsAddingTask(true);
                    }}
                    className="p-1.5 text-neutral-600 hover:text-emerald-500 hover:bg-white/5 rounded-lg transition-all"
                    title="Edit Task"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => deleteTask(task.id)}
                    className="p-1.5 text-neutral-600 hover:text-red-500 hover:bg-white/5 rounded-lg transition-all"
                    title="Delete Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button 
            onClick={() => setActiveTab('crm')}
            className="mt-6 text-xs text-emerald-500 font-bold flex items-center gap-1 hover:gap-2 transition-all"
          >
            View All Tasks <ArrowUpRight className="w-3 h-3" />
          </button>
        </motion.div>

        {/* Daily Goals Tracking */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-1 lg:col-span-1 bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Daily Goals</h3>
            <button 
              onClick={() => setIsAddingGoal(true)}
              className="p-1.5 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 rounded-lg transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {goals.map((goal) => (
              <div key={goal.id} className="space-y-3 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-bold">{goal.title}</span>
                  </div>
                  <button 
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 text-neutral-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                    <span>{goal.current} / {goal.target} {goal.unit}</span>
                    <span>{Math.round((goal.current / goal.target) * 100)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative group/progress">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                      className="h-full bg-emerald-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/progress:opacity-100 transition-opacity bg-neutral-950/80">
                      <span className="text-[8px] font-black text-emerald-500 tracking-tighter">
                        {Math.round((goal.current / goal.target) * 100)}% COMPLETE
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button 
                      onClick={() => updateGoalProgress(goal, -1)}
                      className="p-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => updateGoalProgress(goal, 1)}
                      className="flex-1 py-1 bg-white/5 hover:bg-emerald-500 hover:text-neutral-950 text-[10px] font-bold rounded-lg transition-all"
                    >
                      Log Progress
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {goals.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                <Target className="w-8 h-8 text-neutral-600" />
                <p className="text-xs">No goals set for today.</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* AI Prospecting Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-2 lg:col-span-2 bg-emerald-500 rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/20 rounded-full blur-3xl" />
          <div className="relative z-10">
            <div className="w-12 h-12 bg-neutral-950/20 rounded-2xl flex items-center justify-center mb-6">
              <MessageSquare className="text-neutral-950 w-6 h-6" />
            </div>
            <h2 className="text-3xl font-bold text-neutral-950 tracking-tighter mb-2">AI Prospecting Engine</h2>
            <p className="text-neutral-950/70 max-w-md">Generate high-converting icebreakers and compliance-ready scripts in seconds.</p>
          </div>
          
          <div className="relative z-10 mt-8 space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-neutral-950/10 border border-neutral-950/20 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Search className="w-4 h-4 text-neutral-950/50" />
                <input 
                  type="text" 
                  value={prospectingInput}
                  onChange={(e) => setProspectingInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleProspecting()}
                  placeholder="Paste LinkedIn URL or Bio..." 
                  className="bg-transparent border-none outline-none text-neutral-950 placeholder:text-neutral-950/30 w-full"
                />
              </div>
              <button 
                onClick={handleProspecting}
                disabled={isProspecting}
                className="p-4 bg-neutral-950 text-white rounded-2xl hover:bg-neutral-900 transition-all disabled:opacity-50"
              >
                {isProspecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5" />}
              </button>
            </div>

            <AnimatePresence>
              {prospectingResult && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-neutral-950/10 border border-neutral-950/20 rounded-2xl p-4 relative group"
                >
                  <button 
                    onClick={() => setProspectingResult(null)}
                    className="absolute top-2 right-2 p-1 hover:bg-neutral-950/10 rounded-lg"
                  >
                    <X className="w-4 h-4 text-neutral-950/50" />
                  </button>
                  <p className="text-sm text-neutral-950 font-medium leading-relaxed italic">
                    "{prospectingResult}"
                  </p>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(prospectingResult);
                      toast.success('Copied to clipboard!');
                    }}
                    className="mt-3 text-[10px] font-bold text-neutral-950/50 uppercase tracking-widest hover:text-neutral-950 transition-colors"
                  >
                    Copy to Clipboard
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Recent Leads */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-3 lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Recent Leads</h3>
            <button 
              onClick={() => setActiveTab('crm')}
              className="text-xs text-emerald-500 font-bold hover:underline"
            >
              View CRM
            </button>
          </div>
          <div className="space-y-4">
            {leads.slice(0, 3).map((lead) => (
              <div key={lead.id} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                    {lead.name[0]}
                  </div>
                  <div>
                    <p className="font-bold">{lead.name}</p>
                    <p className="text-xs text-neutral-500">{lead.source} • {lead.last_contacted ? new Date(lead.last_contacted).toLocaleDateString() : 'Never'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    {lead.status}
                  </span>
                  <button 
                    onClick={() => setActiveTab('crm')}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                  >
                    <ArrowUpRight className="w-4 h-4 text-neutral-400" />
                  </button>
                </div>
              </div>
            ))}
            {leads.length === 0 && (
              <div className="text-center py-8 opacity-50">
                <p className="text-sm">No leads yet. Start prospecting!</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Upcoming Appointments */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-3 lg:col-span-2 bg-white/5 border border-white/10 rounded-3xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Upcoming Appointments</h3>
            <Calendar className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="space-y-4">
            {appointments.filter(a => new Date(a.start_time) >= new Date()).slice(0, 3).map((app) => (
              <div key={app.id} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-bold text-emerald-500">{app.title}</p>
                  <span className="text-xs text-emerald-500/70 font-mono">
                    {new Date(app.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-neutral-400">
                  {new Date(app.start_time).toLocaleDateString()} • {app.location || 'No location'}
                </p>
              </div>
            ))}
            {appointments.filter(a => new Date(a.start_time) >= new Date()).length === 0 && (
              <div className="text-center py-8 opacity-50">
                <p className="text-sm">No upcoming appointments.</p>
                <button 
                  onClick={() => setActiveTab('appointments')}
                  className="text-xs text-emerald-500 font-bold mt-2 hover:underline"
                >
                  Schedule One
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* New Sections: IPA and Activity Feed */}
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <IPAChecklist />
        </div>
        <div className="col-span-1 md:col-span-3 lg:col-span-2">
          <ActivityFeed />
        </div>

        {/* Success Path Card */}
        <motion.div 
          whileHover={{ y: -5 }}
          className="col-span-1 md:col-span-3 lg:col-span-4 bg-white/5 border border-white/10 rounded-[2.5rem] p-8 relative overflow-hidden"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-emerald-500 rounded-xl">
              <TrendingUp className="w-5 h-5 text-neutral-950" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter">Your Success Path</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Phase 1: Foundation', tasks: ['Complete Training', 'Set PV Goals', 'List 50 Leads'], colorClass: 'text-emerald-500' },
              { title: 'Phase 2: Momentum', tasks: ['5 Presentations', '3 New Customers', '1 New Partner'], colorClass: 'text-blue-500' },
              { title: 'Phase 3: Leadership', tasks: ['Train a Partner', '300 Personal PV', 'Lead a Meeting'], colorClass: 'text-amber-500' },
            ].map((phase, i) => (
              <div key={i} className="bg-white/5 rounded-3xl p-6 border border-white/5 hover:border-emerald-500/30 transition-all">
                <h3 className={cn("text-lg font-bold mb-4", phase.colorClass)}>{phase.title}</h3>
                <ul className="space-y-3">
                  {phase.tasks.map((task, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm text-neutral-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-neutral-700" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Add Task Modal */}
      {isAddingTask && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">{editingTask ? 'Edit Action Item' : 'New Action Item'}</h2>
              <button onClick={() => { setIsAddingTask(false); setEditingTask(null); setNewTask({ title: '', reminder_time: '', priority: 'medium', category: 'General' }); }} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Quick Templates</label>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((template, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="px-3 py-1.5 bg-white/5 hover:bg-emerald-500/20 border border-white/10 rounded-lg text-[10px] font-bold text-neutral-400 hover:text-emerald-500 transition-all"
                    >
                      + {template.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Task Title</label>
                <input 
                  required
                  type="text" 
                  value={newTask.title}
                  onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  placeholder="Follow up with Sarah..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Reminder Time (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={newTask.reminder_time}
                  onChange={(e) => setNewTask({...newTask, reminder_time: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['IPA', 'General'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewTask({...newTask, category: c})}
                      className={cn(
                        "py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                        newTask.category === c 
                          ? "bg-emerald-500 border-emerald-500 text-neutral-950" 
                          : "bg-white/5 border-white/10 text-neutral-500 hover:border-white/20"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Priority</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setNewTask({...newTask, priority: p})}
                      className={cn(
                        "py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all",
                        newTask.priority === p 
                          ? "bg-emerald-500 border-emerald-500 text-neutral-950" 
                          : "bg-white/5 border-white/10 text-neutral-500 hover:border-white/20"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all"
              >
                {editingTask ? 'Update Task' : 'Add to Stack'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Add Goal Modal */}
      {isAddingGoal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-md w-full space-y-6"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold tracking-tighter">Set New Goal</h2>
              <button onClick={() => setIsAddingGoal(false)} className="p-2 hover:bg-white/5 rounded-xl">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddGoal} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Goal Title</label>
                <input 
                  required
                  type="text" 
                  value={newGoal.title}
                  onChange={(e) => setNewGoal({...newGoal, title: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  placeholder="New Prospects..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Target</label>
                  <input 
                    required
                    type="number" 
                    value={newGoal.target}
                    onChange={(e) => setNewGoal({...newGoal, target: Number(e.target.value)})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Unit</label>
                  <input 
                    required
                    type="text" 
                    value={newGoal.unit}
                    onChange={(e) => setNewGoal({...newGoal, unit: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                    placeholder="Calls, PV, etc."
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Category</label>
                <select 
                  value={newGoal.category}
                  onChange={(e) => setNewGoal({...newGoal, category: e.target.value as any})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50"
                >
                  <option value="prospecting">Prospecting</option>
                  <option value="sales">Sales</option>
                  <option value="team">Team Growth</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-emerald-500 text-neutral-950 hover:bg-emerald-400 rounded-2xl font-bold transition-all"
              >
                Set Goal
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Clear Completed Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full space-y-6 shadow-2xl"
          >
            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold tracking-tighter">Clear Completed?</h3>
              <p className="text-neutral-400 text-sm">
                This will permanently remove all completed tasks from your Daily Action Stack.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={clearCompletedTasks}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-400 transition-all"
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
