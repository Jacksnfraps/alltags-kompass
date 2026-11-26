export type EntryKind = 'idea' | 'todo' | 'event' | 'medication';
export interface Capture { id: string; owner_id: string | null; original_text: string; created_at: string; sorting_status: 'pending' | 'reviewed'; }
export interface Entry { id: string; owner_id: string; capture_id: string; project_id: string | null; kind: EntryKind; title: string; details: string; minutes: 15 | 30 | 60 | null; energy: 'low' | 'medium' | 'high' | null; due_at: string | null; revisit_at: string | null; status: 'open' | 'done'; position: number; facts: Record<string,string>; missing_fields: string[]; contact: {who?: string; when?: string; why?: string}; recurrence: string | null; timezone: string; }
export interface Project { id: string; owner_id: string; title: string; }
export interface MedicationStock { id: string; owner_id: string; label: string; remaining: number; reminder_threshold: number; }
