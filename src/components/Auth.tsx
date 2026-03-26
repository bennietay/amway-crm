import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, ArrowRight, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        await updateProfile(user, { displayName: name });
        
        // Create initial profile
        const uplineId = localStorage.getItem('referral_upline_id');
        const newProfile: UserProfile = {
          uid: user.uid,
          name: name || 'New User',
          email: email,
          pin_level: '3%',
          goal_pv: 100,
          goal_bv: 300,
          current_pv: 0,
          current_bv: 0,
          role: email.toLowerCase() === 'bennietay.agency@gmail.com' ? 'admin' : 'user',
        };
        
        if (uplineId) {
          newProfile.upline_id = uplineId;
        }
        
        await setDoc(doc(db, 'users', user.uid), newProfile);
        
        // Log signup activity
        await addDoc(collection(db, 'team_activities'), {
          user_id: user.uid,
          user_name: name || 'New User',
          action: 'joined the team!',
          timestamp: new Date().toISOString(),
          type: 'signup'
        });
        
        if (uplineId) {
          localStorage.removeItem('referral_upline_id');
        }
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Accents */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 mb-4">
            <Sparkles className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-white">Unified Business OS</h1>
          <p className="text-neutral-400 font-medium">Unified platform for your Amway business.</p>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[2.5rem] p-8 md:p-12 shadow-2xl">
          <div className="flex p-1 bg-white/5 rounded-2xl mb-8">
            <button 
              onClick={() => setIsLogin(true)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                isLogin ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={cn(
                "flex-1 py-3 text-sm font-bold rounded-xl transition-all",
                !isLogin ? "bg-white/10 text-white shadow-lg" : "text-neutral-500 hover:text-neutral-300"
              )}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Full Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input 
                      required={!isLogin}
                      type="text" 
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-emerald-500/50 transition-all text-white placeholder:text-neutral-600"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  required
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-emerald-500/50 transition-all text-white placeholder:text-neutral-600"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Password</label>
                {isLogin && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] hover:text-emerald-400 transition-colors"
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  required
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-emerald-500/50 transition-all text-white placeholder:text-neutral-600"
                />
              </div>
            </div>

            {resetSent && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-500 text-xs font-bold"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <p>Password reset email sent! Check your inbox.</p>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-xs font-bold"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}

            <button 
              disabled={loading}
              type="submit"
              className="w-full py-5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 shadow-xl shadow-emerald-500/20"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-neutral-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-500 font-medium">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
