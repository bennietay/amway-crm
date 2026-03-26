import React from 'react';
import Markdown from 'react-markdown';
import { X, BookOpen, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HelpGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

const guideContent = `
# Amway CRM Pro - User Guide

Welcome to **Amway CRM Pro**, your ultimate companion for managing your Amway business, tracking leads, and growing your team with the power of AI.

---

## 1. Getting Started
- **Login/Signup**: Use your Google account for a seamless and secure login experience.
- **First Time Setup**: Your data is securely stored in Firebase and synced across all your devices.

## 2. Dashboard & Metrics
- **PV Tracker**: Monitor your Personal Volume (PV) and Business Volume (BV) in real-time.
- **Quick Stats**: Track Total Leads, Conversion Rate, and Active Appointments.
- **Lead Pipeline**: A visual breakdown of your leads by status.

## 3. Lead Management (CRM)
- **Adding a Lead**: Click "Add Lead" to store prospect details.
- **Lead Scoring**: Assign a score (1-100) based on interest level.
- **Lead Status**: Track progress from 'New' to 'Converted'.

## 4. AI-Powered Icebreakers
- **Personalized Messages**: Click "Generate Icebreaker" in Lead Details.
- **Tone Selection**: Choose between Friendly, Professional, or Curious.
- **Compliance**: AI ensures messages follow professional standards.

## 5. Appointments & Follow-ups
- **Scheduling**: Set follow-up dates directly from lead details.
- **Calendar**: View all upcoming meetings in the Appointments tab.

## 6. Team Hub & Downline
- **Hierarchy**: Visualize your organization structure.
- **Team Stats**: Monitor collective PV/BV of your organization.

## 7. Resource Vault
- **Sales Scripts**: Access proven scripts for various scenarios.
- **Marketing Materials**: View and share official product brochures.

## 8. Settings & Profile
- **Profile**: Update your name, contact info, and business goals.
- **Security**: Manage your account preferences.

---

## Best Practices
1. **Daily Updates**: Log your PV and update lead statuses daily.
2. **Personalize AI**: Always review and add your personal touch to AI icebreakers.
3. **Consistent Follow-up**: Ensure you follow up with every lead within 24-48 hours.
`;

export default function HelpGuide({ isOpen, onClose }: HelpGuideProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                  <BookOpen className="text-emerald-500 w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">User Guide</h2>
                  <p className="text-xs text-neutral-500 font-medium">Master your Unified Business OS</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl transition-colors text-neutral-400 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 prose prose-invert prose-emerald max-w-none">
              <div className="markdown-body">
                <Markdown>{guideContent}</Markdown>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-neutral-900/50 flex items-center justify-between">
              <p className="text-sm text-neutral-500">Version 1.0.0 • Built for Amway Entrepreneurs</p>
              <button
                onClick={() => window.open('https://www.amway.com', '_blank')}
                className="flex items-center gap-2 text-sm text-emerald-500 hover:text-emerald-400 font-bold transition-colors"
              >
                Official Amway Site
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
