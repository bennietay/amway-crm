import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, addDoc, collection } from 'firebase/firestore';
import { UserProfile } from './types';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CRM from './components/CRM';
import PVTracker from './components/PVTracker';
import TeamHub from './components/TeamHub';
import ResourceVault from './components/ResourceVault';
import Customers from './components/Customers';
import Appointments from './components/Appointments';
import Settings from './components/Settings';
import Auth from './components/Auth';
import HelpGuide from './components/HelpGuide';
import ProductConsultant from './components/ProductConsultant';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemName, setSystemName] = useState('Unified Business OS');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    // Handle referral link
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      localStorage.setItem('referral_upline_id', ref);
    }

    let unsubProfile: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      
      // Clean up previous listeners if they exist
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubSettings) {
        unsubSettings();
        unsubSettings = null;
      }

      if (u) {
        // Fetch system settings with real-time updates
        const settingsRef = doc(db, 'settings', 'system');
        unsubSettings = onSnapshot(settingsRef, (snap) => {
          if (snap.exists()) {
            setSystemName(snap.data().name || 'Unified Business OS');
          } else {
            setDoc(settingsRef, { name: 'Unified Business OS' });
          }
        });

        const docRef = doc(db, 'users', u.uid);
        // Use onSnapshot for real-time profile updates
        unsubProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            // Force admin role for the mentor email if it's not set
            if (u.email?.toLowerCase() === 'bennietay.agency@gmail.com' && data.role !== 'admin') {
              await setDoc(docRef, { ...data, role: 'admin' }, { merge: true });
              setProfile({ ...data, role: 'admin' });
            } else {
              setProfile(data);
            }
          } else {
            // Fallback profile creation if not handled by Auth.tsx
            const uplineId = localStorage.getItem('referral_upline_id');
            const newProfile: UserProfile = {
              uid: u.uid,
              name: u.displayName || 'New User',
              email: u.email || '',
              pin_level: '3%',
              goal_pv: 100,
              goal_bv: 300,
              current_pv: 0,
              current_bv: 0,
              role: u.email?.toLowerCase() === 'bennietay.agency@gmail.com' ? 'admin' : 'user',
            };
            
            if (uplineId) {
              newProfile.upline_id = uplineId;
              // Log activity for the upline
              try {
                await addDoc(collection(db, 'team_activities'), {
                  user_id: uplineId,
                  user_name: u.displayName || 'New Partner',
                  action: 'joined your team via referral link!',
                  timestamp: new Date().toISOString(),
                  type: 'signup'
                });
              } catch (err) {
                console.error("Error logging signup activity:", err);
              }
            }
            
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
            if (uplineId) {
              localStorage.removeItem('referral_upline_id');
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to profile:", error);
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubSettings) unsubSettings();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex">
      <Toaster position="top-right" theme="dark" richColors />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        profile={profile} 
        systemName={systemName}
        onOpenHelp={() => setIsHelpOpen(true)}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto"
          >
            {activeTab === 'dashboard' && <Dashboard profile={profile} setActiveTab={setActiveTab} />}
            {activeTab === 'crm' && <CRM />}
            {activeTab === 'customers' && <Customers />}
            {activeTab === 'appointments' && <Appointments />}
            {activeTab === 'pv' && <PVTracker profile={profile} />}
            {activeTab === 'team' && <TeamHub profile={profile} />}
            {activeTab === 'vault' && <ResourceVault profile={profile} />}
            {activeTab === 'settings' && <Settings profile={profile} />}
          </motion.div>
        </AnimatePresence>
      </main>
      <ProductConsultant />
      <HelpGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
