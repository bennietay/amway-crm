import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  Network, 
  Library, 
  LogOut,
  User as UserIcon,
  UserCheck,
  Calendar,
  Settings as SettingsIcon,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { auth } from '../firebase';
import { UserProfile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  profile: UserProfile | null;
  systemName: string;
  onOpenHelp: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, profile, systemName, onOpenHelp }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'crm', label: 'Growth CRM', icon: Users },
    { id: 'customers', label: 'Customers', icon: UserCheck },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'pv', label: 'PV Intelligence', icon: TrendingUp },
    { id: 'team', label: 'Team Hub', icon: Network },
    { id: 'vault', label: 'Vault', icon: Library },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <aside className="w-20 md:w-64 bg-white/5 border-r border-white/10 flex flex-col h-screen sticky top-0">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
          <TrendingUp className="text-neutral-950 w-5 h-5" />
        </div>
        <span className="hidden md:block font-bold text-xl tracking-tighter truncate max-w-[160px]">{systemName}</span>
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all group",
              activeTab === item.id 
                ? "bg-emerald-500 text-neutral-950 font-bold" 
                : "text-neutral-400 hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-neutral-950" : "group-hover:text-white")} />
            <span className="hidden md:block">{item.label}</span>
          </motion.button>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/20">
            {profile?.name ? (
              <span className="text-sm font-bold">{profile.name[0]}</span>
            ) : (
              <UserIcon className="w-5 h-5 text-neutral-400" />
            )}
          </div>
          <div className="hidden md:block overflow-hidden">
            <p className="text-sm font-bold truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-neutral-500 truncate">{profile?.pin_level || '3%'}</p>
          </div>
        </div>
        <button
          onClick={onOpenHelp}
          className="w-full flex items-center gap-4 px-4 py-3 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-2xl transition-all mb-2"
        >
          <BookOpen className="w-5 h-5" />
          <span className="hidden md:block">User Guide</span>
        </button>
        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center gap-4 px-4 py-3 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="hidden md:block">Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
