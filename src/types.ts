export interface Goal {
  id: string;
  owner_id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  category: 'prospecting' | 'sales' | 'team' | 'other';
  created_at: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  amway_id?: string;
  upline_id?: string;
  pin_level: string;
  goal_pv: number;
  goal_bv: number;
  current_pv: number;
  current_bv: number;
  role: 'admin' | 'user';
}

export interface Lead {
  id: string;
  owner_id: string;
  name: string;
  email?: string;
  phone?: string;
  source: string;
  status: 'Prospect' | 'Invited' | 'Presented' | 'Follow-up' | 'Onboarded';
  linkedin_url?: string;
  ai_score?: number;
  last_contacted?: string;
  bio?: string;
  interest?: 'Product' | 'Business' | 'Both';
  opp_video_url?: string;
  product_demo_url?: string;
  notes?: string;
  tags?: string[];
  icebreaker?: string;
  created_at?: string;
}

export interface Customer {
  id: string;
  owner_id: string;
  lead_id?: string;
  name: string;
  email?: string;
  phone?: string;
  interest?: 'Product' | 'Business' | 'Both';
  onboarded_at: string;
  notes?: string;
  tags?: string[];
}

export interface Activity {
  id: string;
  lead_id?: string;
  owner_id: string;
  type: 'Call' | 'Message' | 'Meeting' | 'Training' | 'Note' | 'Milestone' | 'New Lead' | 'Sale' | 'Onboarding';
  content: string;
  timestamp: string;
  user_name?: string;
}

export interface Expense {
  id: string;
  owner_id: string;
  amount: number;
  category: 'Samples & Demos' | 'Travel' | 'Subscriptions';
  description: string;
  date: string;
}

export interface Task {
  id: string;
  owner_id: string;
  title: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  category?: 'IPA' | 'General';
  reminder_time?: string | null;
  created_at?: string;
}

export interface Resource {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  url: string;
  type: 'PDF' | 'Video' | 'Link';
  category: 'Product Demo' | 'Training Video' | 'Opp' | 'PDF Materials' | 'Other';
  created_at: string;
}

export interface Appointment {
  id: string;
  owner_id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  lead_id?: string;
  customer_id?: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'No Show';
  created_at: string;
}

export interface TeamActivity {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  timestamp: string;
}

