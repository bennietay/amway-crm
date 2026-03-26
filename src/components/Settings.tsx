import React, { useState, useEffect } from 'react';
import { 
  User, 
  Settings as SettingsIcon, 
  Save, 
  LogOut, 
  Shield, 
  Target, 
  Award,
  Mail,
  CheckCircle2,
  Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { cn } from '../lib/utils';

interface SettingsProps {
  profile: UserProfile | null;
}

export default function Settings({ profile }: SettingsProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSystem, setIsSavingSystem] = useState(false);
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(profile);
  const [systemName, setSystemName] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showSystemSuccess, setShowSystemSuccess] = useState(false);

  useEffect(() => {
    const fetchSystemName = async () => {
      const snap = await getDoc(doc(db, 'settings', 'system'));
      if (snap.exists()) {
        setSystemName(snap.data().name);
      }
    };
    fetchSystemName();
  }, []);

  if (!editedProfile) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !editedProfile) return;

    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        name: editedProfile.name,
        pin_level: editedProfile.pin_level,
        goal_pv: editedProfile.goal_pv,
        goal_bv: editedProfile.goal_bv,
        amway_id: editedProfile.amway_id || '',
      });
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!systemName.trim()) return;

    setIsSavingSystem(true);
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        name: systemName.trim()
      });
      setShowSystemSuccess(true);
      setTimeout(() => setShowSystemSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSavingSystem(false);
    }
  };

  const pinLevels = ["3%", "6%", "9%", "12%", "15%", "18%", "Silver", "Gold", "Platinum", "Ruby", "Emerald", "Diamond"];

  return (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">Settings</h1>
        <p className="text-neutral-500 text-sm font-medium">Manage your profile and business goals</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 flex items-center justify-center mx-auto mb-4 overflow-hidden">
              {editedProfile.name ? (
                <span className="text-3xl font-black text-emerald-500">{editedProfile.name[0]}</span>
              ) : (
                <User className="w-10 h-10 text-emerald-500" />
              )}
            </div>
            <h2 className="text-xl font-bold">{editedProfile.name}</h2>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mt-1">{editedProfile.pin_level} Level</p>
            
            <div className="mt-8 pt-8 border-t border-white/5 space-y-2">
              <button 
                onClick={() => auth.signOut()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all text-sm font-bold"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Account Info</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-300">{editedProfile.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Shield className="w-4 h-4 text-neutral-500" />
                <span className="text-neutral-300 capitalize">{editedProfile.role} Account</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:col-span-2">
          <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl">
                  <SettingsIcon className="w-5 h-5 text-emerald-500" />
                </div>
                <h3 className="font-bold">Profile Details</h3>
              </div>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-widest"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Saved Successfully
                </motion.div>
              )}
            </div>

            <div className="p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <User className="w-3 h-3" /> Full Name
                  </label>
                  <input 
                    type="text" 
                    value={editedProfile.name}
                    onChange={(e) => setEditedProfile({...editedProfile, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <Award className="w-3 h-3" /> Pin Level
                  </label>
                  <select 
                    value={editedProfile.pin_level}
                    onChange={(e) => setEditedProfile({...editedProfile, pin_level: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  >
                    {pinLevels.map(level => (
                      <option key={level} value={level} className="bg-neutral-900">{level}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Amway IBO ID (Optional)</label>
                <input 
                  type="text" 
                  value={editedProfile.amway_id || ''}
                  onChange={(e) => setEditedProfile({...editedProfile, amway_id: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="Enter your IBO ID"
                />
              </div>

              <div className="pt-8 border-t border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-6 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Monthly Business Goals
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Personal PV Goal</label>
                    <input 
                      type="number" 
                      value={editedProfile.goal_pv}
                      onChange={(e) => setEditedProfile({...editedProfile, goal_pv: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Group BV Goal</label>
                    <input 
                      type="number" 
                      value={editedProfile.goal_bv}
                      onChange={(e) => setEditedProfile({...editedProfile, goal_bv: parseInt(e.target.value) || 0})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
              >
                {isSaving ? (
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full"
                  />
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    SAVE CHANGES
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Admin System Settings */}
          {profile?.role === 'admin' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-white/5 border border-emerald-500/20 rounded-[2.5rem] overflow-hidden"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-xl">
                    <Globe className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="font-bold">System Configuration</h3>
                    <p className="text-[10px] text-emerald-500/60 uppercase font-black tracking-widest">Admin Only</p>
                  </div>
                </div>
                {showSystemSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-emerald-500 text-xs font-bold uppercase tracking-widest"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    System Updated
                  </motion.div>
                )}
              </div>

              <form onSubmit={handleSaveSystem} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">System Name</label>
                  <input 
                    type="text" 
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-emerald-500/50 transition-all"
                    placeholder="e.g. Unified Business OS"
                  />
                  <p className="text-[10px] text-neutral-500 italic">This name will appear in the sidebar and throughout the platform.</p>
                </div>

                <button 
                  type="submit"
                  disabled={isSavingSystem}
                  className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-2xl hover:bg-emerald-400 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {isSavingSystem ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-5 h-5 border-2 border-neutral-950 border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      UPDATE SYSTEM NAME
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
