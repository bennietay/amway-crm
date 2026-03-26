import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import { Task } from '../types';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Plus, Trophy, Target, Zap } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_IPA = [
  "Contact 2 new prospects",
  "Follow up with 1 existing lead",
  "Listen to 1 training audio",
  "Read 15 minutes of personal growth",
  "Review PV/BV goals"
];

export default function IPAChecklist() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const q = query(
      collection(db, 'tasks'),
      where('owner_id', '==', auth.currentUser.uid),
      where('category', '==', 'IPA')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      
      // Filter for today's tasks
      const todayTasks = taskData.filter(t => t.created_at?.startsWith(today));
      
      if (todayTasks.length === 0 && taskData.length === 0) {
        // Initialize default IPA for the day if none exist
        for (const title of DEFAULT_IPA) {
          await addDoc(collection(db, 'tasks'), {
            owner_id: auth.currentUser?.uid,
            title,
            completed: false,
            category: 'IPA',
            created_at: new Date().toISOString()
          });
        }
      } else {
        setTasks(todayTasks);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleTask = async (task: Task) => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        completed: !task.completed
      });
      if (!task.completed) {
        toast.success('IPA Milestone Reached!', {
          description: `Completed: ${task.title}`,
          icon: <Zap className="w-4 h-4 text-amber-500" />
        });
      }
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">Daily IPA</h3>
            <p className="text-xs text-neutral-500">Income Producing Activities</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-amber-500">{completedCount}/{tasks.length}</p>
          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Completed</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-amber-500"
        />
      </div>

      <div className="space-y-3">
        {tasks.map((task, i) => (
          <motion.div 
            key={task.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => toggleTask(task)}
            className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all border ${
              task.completed 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                : 'bg-white/5 border-white/5 hover:bg-white/10 text-neutral-300'
            }`}
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <Circle className="w-5 h-5 shrink-0" />
            )}
            <span className={`text-sm font-medium ${task.completed ? 'line-through opacity-70' : ''}`}>
              {task.title}
            </span>
          </motion.div>
        ))}
      </div>

      {progress === 100 && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3"
        >
          <Trophy className="w-5 h-5 text-emerald-500" />
          <p className="text-xs font-bold text-emerald-500">All IPAs completed! You're crushing it today.</p>
        </motion.div>
      )}
    </div>
  );
}
