import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { Activity } from '../types';
import { motion } from 'motion/react';
import { 
  History, 
  UserPlus, 
  TrendingUp, 
  Award, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Zap,
  ShoppingBag,
  UserCheck
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ACTIVITY_ICONS = {
  'Call': { icon: Phone, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'Message': { icon: MessageSquare, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Meeting': { icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  'Training': { icon: Award, color: 'text-purple-500', bg: 'bg-purple-500/10' },
  'Note': { icon: History, color: 'text-neutral-500', bg: 'bg-neutral-500/10' },
  'Milestone': { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-500/10' },
  'New Lead': { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  'Sale': { icon: ShoppingBag, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  'Onboarding': { icon: UserCheck, color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
};

export default function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'activities'),
      where('owner_id', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(activityData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <div className="animate-pulse h-64 bg-white/5 rounded-3xl" />;

  return (
    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold tracking-tight">Recent Activity</h3>
            <p className="text-xs text-neutral-500">Real-time updates from your business</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-neutral-500">No recent activity logged.</p>
          </div>
        ) : (
          activities.map((activity, i) => {
            const config = ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS['Note'];
            const Icon = config.icon;

            return (
              <motion.div 
                key={activity.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-4 p-3 rounded-2xl hover:bg-white/5 transition-all group"
              >
                <div className={`p-2.5 rounded-xl ${config.bg} ${config.color} shrink-0`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold truncate">
                      {activity.content}
                    </p>
                    <span className="text-[10px] font-bold text-neutral-500 whitespace-nowrap">
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                    {activity.type}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
