import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  signInWithGoogle,
  signOutUser,
  testFirestoreConnection,
} from '../firebase';
import {
  CalendarEvent,
  HabitOrLog,
  KnowledgeItem,
  PrimaryNavTab,
  ProjectOrGoal,
  Subtask,
  Task,
  UserPreferences,
} from '../types/lifeos';

const STORAGE_KEY = 'lifeos_persistent_state_v1';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function serializeSubtasks(subtasks: Subtask[]): string[] {
  return (subtasks || []).slice(0, 50).map((s) => {
    const cleanId = (s.id || generateId('sub')).replace(/\|/g, '');
    const cleanTitle = (s.title || 'Subtask').replace(/\|/g, ' ').slice(0, 260);
    return `${s.completed ? '1' : '0'}|${cleanId}|${cleanTitle}`;
  });
}

function deserializeSubtasks(raw: unknown): Subtask[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') {
      const parts = item.split('|');
      if (parts.length >= 3) {
        return {
          completed: parts[0] === '1',
          id: parts[1],
          title: parts.slice(2).join('|'),
        };
      }
      return { id: generateId('sub'), title: item, completed: false };
    }
    if (item && typeof item === 'object') {
      const obj = item as any;
      return {
        id: String(obj.id || generateId('sub')),
        title: String(obj.title || ''),
        completed: Boolean(obj.completed),
      };
    }
    return { id: generateId('sub'), title: '', completed: false };
  });
}

function tsToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val?.toDate === 'function') return val.toDate().toISOString();
  return new Date().toISOString();
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  ownerId: 'local_user',
  theme: 'dark',
  energyLevel: 'moderate',
  energyNote: '',
  focusDuration: 50,
  shortBreakDuration: 10,
  longBreakDuration: 20,
  workStartHour: '09:00',
  workEndHour: '18:00',
  weekStartsOn: 'monday',
  gamificationEnabled: true,
  remindersEnabled: false,
  topPriorities: [],
  visibleSections: ['due_today', 'overdue', 'habits', 'projects', 'ideas', 'deadlines'],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

interface LocalStorageBundle {
  preferences: UserPreferences;
  tasks: Task[];
  events: CalendarEvent[];
  knowledge: KnowledgeItem[];
  projectsGoals: ProjectOrGoal[];
  habitsLogs: HabitOrLog[];
}

function loadLocalBundle(): LocalStorageBundle {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        preferences: DEFAULT_PREFERENCES,
        tasks: [],
        events: [],
        knowledge: [],
        projectsGoals: [],
        habitsLogs: [],
      };
    }
    const parsed = JSON.parse(raw);
    return {
      preferences: { ...DEFAULT_PREFERENCES, ...(parsed.preferences || {}) },
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      knowledge: Array.isArray(parsed.knowledge) ? parsed.knowledge : [],
      projectsGoals: Array.isArray(parsed.projectsGoals) ? parsed.projectsGoals : [],
      habitsLogs: Array.isArray(parsed.habitsLogs) ? parsed.habitsLogs : [],
    };
  } catch {
    return {
      preferences: DEFAULT_PREFERENCES,
      tasks: [],
      events: [],
      knowledge: [],
      projectsGoals: [],
      habitsLogs: [],
    };
  }
}

interface LifeOSContextValue {
  user: User | null;
  authReady: boolean;
  syncStatus: 'local' | 'syncing' | 'synced' | 'error';
  activeTab: PrimaryNavTab;
  setActiveTab: (tab: PrimaryNavTab) => void;
  preferences: UserPreferences;
  tasks: Task[];
  events: CalendarEvent[];
  knowledge: KnowledgeItem[];
  projectsGoals: ProjectOrGoal[];
  habitsLogs: HabitOrLog[];
  // Auth & Cloud actions
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  syncLocalToCloud: () => Promise<void>;
  // Preferences
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  toggleTopPriority: (taskId: string) => Promise<void>;
  // Tasks
  createTask: (input: Partial<Task> & { title: string }) => Promise<Task>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  toggleTaskCompletion: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  duplicateTask: (id: string) => Promise<Task | null>;
  // Calendar & Time Blocks
  createCalendarEvent: (input: Partial<CalendarEvent> & { title: string }) => Promise<CalendarEvent>;
  updateCalendarEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteCalendarEvent: (id: string) => Promise<void>;
  // Second Brain (Inbox, Notes, Ideas, Brain Dump)
  createKnowledgeItem: (input: Partial<KnowledgeItem> & { title: string }) => Promise<KnowledgeItem>;
  updateKnowledgeItem: (id: string, patch: Partial<KnowledgeItem>) => Promise<void>;
  deleteKnowledgeItem: (id: string) => Promise<void>;
  convertIdeaToProject: (
    ideaId: string,
    milestonesInput: { name: string; tasks: string[] }[]
  ) => Promise<string | null>;
  // Projects, Milestones & Goals
  createProjectOrGoal: (input: Partial<ProjectOrGoal> & { name: string }) => Promise<ProjectOrGoal>;
  updateProjectOrGoal: (id: string, patch: Partial<ProjectOrGoal>) => Promise<void>;
  deleteProjectOrGoal: (id: string) => Promise<void>;
  // Habits, Focus, Reviews, XP
  createHabitOrLog: (input: Partial<HabitOrLog> & { title: string }) => Promise<HabitOrLog>;
  updateHabitOrLog: (id: string, patch: Partial<HabitOrLog>) => Promise<void>;
  deleteHabitOrLog: (id: string) => Promise<void>;
  toggleHabitOccurrence: (
    habitId: string,
    date: string,
    status: 'completed' | 'skipped' | 'none'
  ) => Promise<void>;
  recordFocusSession: (taskId: string, taskTitle: string, durationMinutes: number) => Promise<void>;
  // Computed helpers
  getProjectProgress: (projectId: string) => number;
  getHabitStreak: (habitId: string) => number;
  totalXP: number;
  currentLevel: number;
  xpInLevel: number;
  xpForNextLevel: number;
  // Data Export, Backup & Restore
  exportFullJSON: () => string;
  exportTasksCSV: () => string;
  importBackupJSON: (rawJson: string, mode: 'merge' | 'replace') => Promise<{ importedCount: number }>;
  clearAllData: () => Promise<void>;
  // Global modals state
  isQuickAddOpen: boolean;
  setIsQuickAddOpen: (v: boolean) => void;
  quickAddDefaultType: 'task' | 'note' | 'idea' | 'project' | 'goal' | 'event' | 'habit' | 'brain_dump';
  openQuickAdd: (type?: 'task' | 'note' | 'idea' | 'project' | 'goal' | 'event' | 'habit' | 'brain_dump') => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isWhatNowOpen: boolean;
  setIsWhatNowOpen: (v: boolean) => void;
  isPlanRecoveryOpen: boolean;
  setIsPlanRecoveryOpen: (v: boolean) => void;
  activeFocusTaskId: string | null;
  isFocusModalOpen: boolean;
  startFocusForTask: (taskId?: string | null) => void;
  setIsFocusModalOpen: (v: boolean) => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
}

const LifeOSContext = createContext<LifeOSContextValue | null>(null);

export const LifeOSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(() => loadLocalBundle(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'error'>('local');
  const [activeTab, setActiveTab] = useState<PrimaryNavTab>('today');

  const [preferences, setPreferences] = useState<UserPreferences>(initial.preferences);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [events, setEvents] = useState<CalendarEvent[]>(initial.events);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>(initial.knowledge);
  const [projectsGoals, setProjectsGoals] = useState<ProjectOrGoal[]>(initial.projectsGoals);
  const [habitsLogs, setHabitsLogs] = useState<HabitOrLog[]>(initial.habitsLogs);

  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddDefaultType, setQuickAddDefaultType] = useState<
    'task' | 'note' | 'idea' | 'project' | 'goal' | 'event' | 'habit' | 'brain_dump'
  >('task');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWhatNowOpen, setIsWhatNowOpen] = useState(false);
  const [isPlanRecoveryOpen, setIsPlanRecoveryOpen] = useState(false);
  const [activeFocusTaskId, setActiveFocusTaskId] = useState<string | null>(null);
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const prefsExistsInCloudRef = useRef<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 3200);
  };

  const openQuickAdd = (
    type: 'task' | 'note' | 'idea' | 'project' | 'goal' | 'event' | 'habit' | 'brain_dump' = 'task'
  ) => {
    setQuickAddDefaultType(type);
    setIsQuickAddOpen(true);
  };

  const startFocusForTask = (taskId: string | null = null) => {
    setActiveFocusTaskId(taskId);
    setIsFocusModalOpen(true);
  };

  // Apply dark/light theme class to <html>
  useEffect(() => {
    const html = document.documentElement;
    if (preferences.theme === 'light') {
      html.classList.add('light');
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
      html.classList.remove('light');
    }
  }, [preferences.theme]);

  // Persist to localStorage on every state update for offline resilience
  useEffect(() => {
    try {
      const bundle: LocalStorageBundle = {
        preferences,
        tasks,
        events,
        knowledge,
        projectsGoals,
        habitsLogs,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
    } catch (e) {
      console.error('Failed to save local state:', e);
    }
  }, [preferences, tasks, events, knowledge, projectsGoals, habitsLogs]);

  // Test Firestore connection on boot
  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);
      if (!fbUser) {
        setSyncStatus('local');
        prefsExistsInCloudRef.current = false;
      }
    });
    return () => unsub();
  }, []);

  // Attach real-time Firestore listeners when authenticated
  useEffect(() => {
    if (!authReady || !user) return;

    setSyncStatus('syncing');
    const uid = user.uid;

    const unsubPrefs = onSnapshot(
      doc(db, 'user_preferences', uid),
      (snap) => {
        if (snap.exists()) {
          prefsExistsInCloudRef.current = true;
          const d = snap.data();
          setPreferences({
            ownerId: d.ownerId || uid,
            theme: d.theme === 'light' ? 'light' : 'dark',
            energyLevel: d.energyLevel || 'moderate',
            energyNote: d.energyNote || '',
            focusDuration: Number(d.focusDuration) || 50,
            shortBreakDuration: Number(d.shortBreakDuration) || 10,
            longBreakDuration: Number(d.longBreakDuration) || 20,
            workStartHour: d.workStartHour || '09:00',
            workEndHour: d.workEndHour || '18:00',
            weekStartsOn: d.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
            gamificationEnabled: Boolean(d.gamificationEnabled ?? true),
            remindersEnabled: Boolean(d.remindersEnabled ?? false),
            topPriorities: Array.isArray(d.topPriorities) ? d.topPriorities : [],
            visibleSections: Array.isArray(d.visibleSections)
              ? d.visibleSections
              : DEFAULT_PREFERENCES.visibleSections,
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          });
        } else {
          prefsExistsInCloudRef.current = false;
        }
        setSyncStatus('synced');
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.GET, `user_preferences/${uid}`);
      }
    );

    const unsubTasks = onSnapshot(
      query(collection(db, 'tasks'), where('ownerId', '==', uid)),
      (snap) => {
        const list: Task[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: d.ownerId,
            title: d.title || '',
            description: d.description || '',
            completed: Boolean(d.completed),
            priority: d.priority || 'normal',
            dueDate: d.dueDate || '',
            startDate: d.startDate || '',
            scheduledStart: d.scheduledStart || '',
            scheduledEnd: d.scheduledEnd || '',
            estimatedMinutes: Number(d.estimatedMinutes) || 0,
            actualMinutes: Number(d.actualMinutes) || 0,
            category: d.category || '',
            projectId: d.projectId || '',
            milestoneId: d.milestoneId || '',
            tags: Array.isArray(d.tags) ? d.tags : [],
            subtasks: deserializeSubtasks(d.subtasks),
            dependencyIds: Array.isArray(d.dependencyIds) ? d.dependencyIds : [],
            recurrence: d.recurrence || 'none',
            energyRequired: d.energyRequired || 'any',
            archived: Boolean(d.archived),
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          };
        });
        setTasks(list);
        setSyncStatus('synced');
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.LIST, 'tasks');
      }
    );

    const unsubEvents = onSnapshot(
      query(collection(db, 'calendar_events'), where('ownerId', '==', uid)),
      (snap) => {
        const list: CalendarEvent[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: d.ownerId,
            title: d.title || '',
            kind: d.kind === 'timeblock' ? 'timeblock' : 'event',
            date: d.date || getTodayISO(),
            startTime: d.startTime || '09:00',
            endTime: d.endTime || '10:00',
            taskId: d.taskId || '',
            projectId: d.projectId || '',
            category: d.category || '',
            location: d.location || '',
            notes: d.notes || '',
            recurrence: d.recurrence || 'none',
            isFixed: Boolean(d.isFixed),
            completed: Boolean(d.completed),
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          };
        });
        setEvents(list);
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.LIST, 'calendar_events');
      }
    );

    const unsubKnowledge = onSnapshot(
      query(collection(db, 'knowledge_items'), where('ownerId', '==', uid)),
      (snap) => {
        const list: KnowledgeItem[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: d.ownerId,
            itemType: d.itemType || 'inbox',
            title: d.title || '',
            content: d.content || '',
            ideaStatus: d.ideaStatus || 'none',
            whyItMatters: d.whyItMatters || '',
            nextAction: d.nextAction || '',
            relatedLinks: Array.isArray(d.relatedLinks) ? d.relatedLinks : [],
            linkedProjectId: d.linkedProjectId || '',
            linkedGoalId: d.linkedGoalId || '',
            category: d.category || '',
            tags: Array.isArray(d.tags) ? d.tags : [],
            pinned: Boolean(d.pinned),
            archived: Boolean(d.archived),
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          };
        });
        setKnowledge(list);
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.LIST, 'knowledge_items');
      }
    );

    const unsubProjects = onSnapshot(
      query(collection(db, 'projects_goals'), where('ownerId', '==', uid)),
      (snap) => {
        const list: ProjectOrGoal[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: d.ownerId,
            recordType: d.recordType || 'project',
            name: d.name || '',
            description: d.description || '',
            status: d.status || 'active',
            category: d.category || '',
            priority: d.priority || 'normal',
            startDate: d.startDate || '',
            targetDate: d.targetDate || '',
            parentProjectId: d.parentProjectId || '',
            linkedGoalId: d.linkedGoalId || '',
            measurableOutcome: d.measurableOutcome || '',
            progress: Number(d.progress) || 0,
            isManualProgress: Boolean(d.isManualProgress),
            nextAction: d.nextAction || '',
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          };
        });
        setProjectsGoals(list);
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.LIST, 'projects_goals');
      }
    );

    const unsubHabits = onSnapshot(
      query(collection(db, 'habits_logs'), where('ownerId', '==', uid)),
      (snap) => {
        const list: HabitOrLog[] = snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            ownerId: d.ownerId,
            logType: d.logType || 'habit',
            title: d.title || '',
            description: d.description || '',
            category: d.category || '',
            icon: d.icon || 'check',
            scheduleType: d.scheduleType || 'daily',
            scheduleDays: Array.isArray(d.scheduleDays) ? d.scheduleDays : [],
            targetFrequency: Number(d.targetFrequency) || 7,
            date: d.date || '',
            occurrenceStatus: d.occurrenceStatus || 'none',
            durationMinutes: Number(d.durationMinutes) || 0,
            xpAmount: Number(d.xpAmount) || 0,
            sourceEntityId: d.sourceEntityId || '',
            archived: Boolean(d.archived),
            entries: Array.isArray(d.entries) ? d.entries : [],
            createdAt: tsToISO(d.createdAt),
            updatedAt: tsToISO(d.updatedAt),
          };
        });
        setHabitsLogs(list);
      },
      (err) => {
        setSyncStatus('error');
        handleFirestoreError(err, OperationType.LIST, 'habits_logs');
      }
    );

    return () => {
      unsubPrefs();
      unsubTasks();
      unsubEvents();
      unsubKnowledge();
      unsubProjects();
      unsubHabits();
    };
  }, [authReady, user]);

  // Helper to build sanitized Firestore payloads adhering to firebase-blueprint.json & firestore.rules
  const buildTaskCloudPayload = (t: Task, uid: string, isCreate: boolean) => {
    const validProjectExists =
      t.projectId && projectsGoals.some((p) => p.id === t.projectId);
    const base = {
      ownerId: uid,
      title: (t.title || 'Untitled Task').slice(0, 300),
      description: (t.description || '').slice(0, 5000),
      completed: Boolean(t.completed),
      priority: ['low', 'normal', 'high', 'urgent'].includes(t.priority) ? t.priority : 'normal',
      dueDate: (t.dueDate || '').slice(0, 40),
      startDate: (t.startDate || '').slice(0, 40),
      scheduledStart: (t.scheduledStart || '').slice(0, 40),
      scheduledEnd: (t.scheduledEnd || '').slice(0, 40),
      estimatedMinutes: Math.min(Math.max(Number(t.estimatedMinutes) || 0, 0), 1440),
      actualMinutes: Math.min(Math.max(Number(t.actualMinutes) || 0, 0), 10000),
      category: (t.category || '').slice(0, 100),
      projectId: validProjectExists ? t.projectId : '',
      milestoneId: (t.milestoneId || '').slice(0, 128),
      tags: (t.tags || []).slice(0, 20).map((s) => String(s).slice(0, 64)),
      subtasks: serializeSubtasks(t.subtasks),
      dependencyIds: (t.dependencyIds || []).slice(0, 20).map((s) => String(s).slice(0, 128)),
      recurrence: ['none', 'daily', 'weekdays', 'weekly', 'monthly'].includes(t.recurrence)
        ? t.recurrence
        : 'none',
      energyRequired: ['low', 'moderate', 'high', 'any'].includes(t.energyRequired)
        ? t.energyRequired
        : 'any',
      archived: Boolean(t.archived),
      updatedAt: serverTimestamp(),
    };
    if (isCreate) {
      return { ...base, createdAt: serverTimestamp() };
    }
    const { ownerId, ...mutableFields } = base;
    return mutableFields;
  };

  const loginWithGoogle = async () => {
    await signInWithGoogle();
    showToast('Signed in to LifeOS Cloud Sync');
  };

  const logout = async () => {
    await signOutUser();
    showToast('Signed out — using local offline storage');
  };

  // Sync any local records to Firestore
  const syncLocalToCloud = async () => {
    if (!user) {
      showToast('Sign in with Google first to sync to cloud.');
      return;
    }
    setSyncStatus('syncing');
    const uid = user.uid;
    try {
      // 1. Preferences
      const prefPath = `user_preferences/${uid}`;
      const prefPayload = {
        ownerId: uid,
        theme: preferences.theme === 'light' ? 'light' : 'dark',
        energyLevel: ['low', 'moderate', 'high'].includes(preferences.energyLevel)
          ? preferences.energyLevel
          : 'moderate',
        energyNote: (preferences.energyNote || '').slice(0, 500),
        focusDuration: Math.min(Math.max(Number(preferences.focusDuration) || 50, 1), 240),
        shortBreakDuration: Math.min(Math.max(Number(preferences.shortBreakDuration) || 10, 1), 60),
        longBreakDuration: Math.min(Math.max(Number(preferences.longBreakDuration) || 20, 1), 120),
        workStartHour: (preferences.workStartHour || '09:00').slice(0, 10),
        workEndHour: (preferences.workEndHour || '18:00').slice(0, 10),
        weekStartsOn: preferences.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
        gamificationEnabled: Boolean(preferences.gamificationEnabled),
        remindersEnabled: Boolean(preferences.remindersEnabled),
        topPriorities: (preferences.topPriorities || []).slice(0, 3),
        visibleSections: (preferences.visibleSections || []).slice(0, 15),
        updatedAt: serverTimestamp(),
      };
      if (!prefsExistsInCloudRef.current) {
        await setDoc(doc(db, 'user_preferences', uid), {
          ...prefPayload,
          createdAt: serverTimestamp(),
        });
        prefsExistsInCloudRef.current = true;
      } else {
        const { ownerId, ...mutablePref } = prefPayload;
        await updateDoc(doc(db, 'user_preferences', uid), mutablePref);
      }

      // 2. Projects & Goals first (so tasks referencing projectId pass relational exists() check)
      for (const pg of projectsGoals) {
        await setDoc(doc(db, 'projects_goals', pg.id), {
          ownerId: uid,
          recordType: pg.recordType,
          name: (pg.name || 'Untitled').slice(0, 300),
          description: (pg.description || '').slice(0, 5000),
          status: pg.status || 'active',
          category: (pg.category || '').slice(0, 100),
          priority: pg.priority || 'normal',
          startDate: (pg.startDate || '').slice(0, 40),
          targetDate: (pg.targetDate || '').slice(0, 40),
          parentProjectId: (pg.parentProjectId || '').slice(0, 128),
          linkedGoalId: (pg.linkedGoalId || '').slice(0, 128),
          measurableOutcome: (pg.measurableOutcome || '').slice(0, 1000),
          progress: Math.min(Math.max(Number(pg.progress) || 0, 0), 100),
          isManualProgress: Boolean(pg.isManualProgress),
          nextAction: (pg.nextAction || '').slice(0, 500),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 3. Tasks
      for (const t of tasks) {
        await setDoc(doc(db, 'tasks', t.id), buildTaskCloudPayload(t, uid, true));
      }

      // 4. Calendar Events
      for (const ev of events) {
        await setDoc(doc(db, 'calendar_events', ev.id), {
          ownerId: uid,
          title: (ev.title || 'Event').slice(0, 300),
          kind: ev.kind === 'timeblock' ? 'timeblock' : 'event',
          date: (ev.date || getTodayISO()).slice(0, 40),
          startTime: (ev.startTime || '09:00').slice(0, 20),
          endTime: (ev.endTime || '10:00').slice(0, 20),
          taskId: (ev.taskId || '').slice(0, 128),
          projectId: (ev.projectId || '').slice(0, 128),
          category: (ev.category || '').slice(0, 100),
          location: (ev.location || '').slice(0, 300),
          notes: (ev.notes || '').slice(0, 3000),
          recurrence: ev.recurrence || 'none',
          isFixed: Boolean(ev.isFixed),
          completed: Boolean(ev.completed),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 5. Knowledge Items
      for (const k of knowledge) {
        await setDoc(doc(db, 'knowledge_items', k.id), {
          ownerId: uid,
          itemType: k.itemType || 'inbox',
          title: (k.title || 'Untitled').slice(0, 300),
          content: (k.content || '').slice(0, 20000),
          ideaStatus: k.ideaStatus || 'none',
          whyItMatters: (k.whyItMatters || '').slice(0, 2000),
          nextAction: (k.nextAction || '').slice(0, 500),
          relatedLinks: (k.relatedLinks || []).slice(0, 20).map((s) => String(s).slice(0, 500)),
          linkedProjectId: (k.linkedProjectId || '').slice(0, 128),
          linkedGoalId: (k.linkedGoalId || '').slice(0, 128),
          category: (k.category || '').slice(0, 100),
          tags: (k.tags || []).slice(0, 20).map((s) => String(s).slice(0, 64)),
          pinned: Boolean(k.pinned),
          archived: Boolean(k.archived),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // 6. Habits & Logs
      for (const h of habitsLogs) {
        await setDoc(doc(db, 'habits_logs', h.id), {
          ownerId: uid,
          logType: h.logType,
          title: (h.title || 'Record').slice(0, 300),
          description: (h.description || '').slice(0, 10000),
          category: (h.category || '').slice(0, 100),
          icon: (h.icon || 'check').slice(0, 50),
          scheduleType: h.scheduleType || 'daily',
          scheduleDays: (h.scheduleDays || []).slice(0, 10).map((s) => String(s).slice(0, 20)),
          targetFrequency: Math.min(Math.max(Number(h.targetFrequency) || 0, 0), 365),
          date: (h.date || '').slice(0, 40),
          occurrenceStatus: h.occurrenceStatus || 'none',
          durationMinutes: Math.min(Math.max(Number(h.durationMinutes) || 0, 0), 1440),
          xpAmount: Math.min(Math.max(Number(h.xpAmount) || 0, -10000), 10000),
          sourceEntityId: (h.sourceEntityId || '').slice(0, 128),
          archived: Boolean(h.archived),
          entries: (h.entries || []).slice(0, 30).map((s) => String(s).slice(0, 2000)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setSyncStatus('synced');
      showToast('Synchronized all records with Cloud Database');
    } catch (err) {
      setSyncStatus('error');
      handleFirestoreError(err, OperationType.WRITE, 'batch_sync');
    }
  };

  // Award or revoke XP deterministically (anti-farming)
  const grantOrRevokeXP = async (
    deterministicXpId: string,
    title: string,
    xpAmount: number,
    sourceEntityId: string,
    grant: boolean
  ) => {
    const cleanId = deterministicXpId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    const exists = habitsLogs.find((h) => h.id === cleanId && h.logType === 'xp_transaction');

    if (grant && !exists) {
      const xpLog: HabitOrLog = {
        id: cleanId,
        ownerId: user?.uid || 'local_user',
        logType: 'xp_transaction',
        title: title.slice(0, 300),
        description: `Earned ${xpAmount} XP`,
        category: 'XP',
        icon: 'zap',
        scheduleType: 'none',
        scheduleDays: [],
        targetFrequency: 0,
        date: getTodayISO(),
        occurrenceStatus: 'completed',
        durationMinutes: 0,
        xpAmount,
        sourceEntityId,
        archived: false,
        entries: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setHabitsLogs((prev) => [...prev.filter((x) => x.id !== cleanId), xpLog]);
      if (user) {
        try {
          await setDoc(doc(db, 'habits_logs', cleanId), {
            ownerId: user.uid,
            logType: 'xp_transaction',
            title: xpLog.title,
            description: xpLog.description,
            category: 'XP',
            icon: 'zap',
            scheduleType: 'none',
            scheduleDays: [],
            targetFrequency: 0,
            date: xpLog.date,
            occurrenceStatus: 'completed',
            durationMinutes: 0,
            xpAmount,
            sourceEntityId: sourceEntityId.slice(0, 128),
            archived: false,
            entries: [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `habits_logs/${cleanId}`);
        }
      }
    } else if (!grant && exists) {
      setHabitsLogs((prev) => prev.filter((x) => x.id !== cleanId));
      if (user) {
        try {
          await deleteDoc(doc(db, 'habits_logs', cleanId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `habits_logs/${cleanId}`);
        }
      }
    }
  };

  // Preferences CRUD
  const updatePreferences = async (patch: Partial<UserPreferences>) => {
    const next: UserPreferences = {
      ...preferences,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setPreferences(next);

    if (user) {
      const uid = user.uid;
      const payload = {
        theme: next.theme === 'light' ? 'light' : 'dark',
        energyLevel: ['low', 'moderate', 'high'].includes(next.energyLevel)
          ? next.energyLevel
          : 'moderate',
        energyNote: (next.energyNote || '').slice(0, 500),
        focusDuration: Math.min(Math.max(Number(next.focusDuration) || 50, 1), 240),
        shortBreakDuration: Math.min(Math.max(Number(next.shortBreakDuration) || 10, 1), 60),
        longBreakDuration: Math.min(Math.max(Number(next.longBreakDuration) || 20, 1), 120),
        workStartHour: (next.workStartHour || '09:00').slice(0, 10),
        workEndHour: (next.workEndHour || '18:00').slice(0, 10),
        weekStartsOn: next.weekStartsOn === 'sunday' ? 'sunday' : 'monday',
        gamificationEnabled: Boolean(next.gamificationEnabled),
        remindersEnabled: Boolean(next.remindersEnabled),
        topPriorities: (next.topPriorities || []).slice(0, 3),
        visibleSections: (next.visibleSections || []).slice(0, 15),
        updatedAt: serverTimestamp(),
      };
      try {
        if (!prefsExistsInCloudRef.current) {
          await setDoc(doc(db, 'user_preferences', uid), {
            ownerId: uid,
            ...payload,
            createdAt: serverTimestamp(),
          });
          prefsExistsInCloudRef.current = true;
        } else {
          await updateDoc(doc(db, 'user_preferences', uid), payload);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `user_preferences/${uid}`);
      }
    }
  };

  const toggleTopPriority = async (taskId: string) => {
    const current = preferences.topPriorities || [];
    let next: string[];
    if (current.includes(taskId)) {
      next = current.filter((id) => id !== taskId);
      showToast('Removed from Today’s Top 3 Priorities');
    } else {
      if (current.length >= 3) {
        showToast('Maximum 3 Top Priorities allowed — remove one first');
        return;
      }
      next = [...current, taskId];
      showToast('Added to Today’s Top 3 Priorities');
    }
    await updatePreferences({ topPriorities: next });
  };

  // Tasks CRUD
  const createTask = async (input: Partial<Task> & { title: string }): Promise<Task> => {
    const now = new Date().toISOString();
    const id = input.id || generateId('task');
    const newTask: Task = {
      id,
      ownerId: user?.uid || 'local_user',
      title: input.title.trim().slice(0, 300),
      description: (input.description || '').slice(0, 5000),
      completed: Boolean(input.completed ?? false),
      priority: input.priority || 'normal',
      dueDate: input.dueDate ?? getTodayISO(),
      startDate: input.startDate || '',
      scheduledStart: input.scheduledStart || '',
      scheduledEnd: input.scheduledEnd || '',
      estimatedMinutes: Number(input.estimatedMinutes) || 30,
      actualMinutes: Number(input.actualMinutes) || 0,
      category: input.category || 'General',
      projectId: input.projectId || '',
      milestoneId: input.milestoneId || '',
      tags: input.tags || [],
      subtasks: input.subtasks || [],
      dependencyIds: input.dependencyIds || [],
      recurrence: input.recurrence || 'none',
      energyRequired: input.energyRequired || 'any',
      archived: Boolean(input.archived ?? false),
      createdAt: now,
      updatedAt: now,
    };

    setTasks((prev) => [newTask, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'tasks', id), buildTaskCloudPayload(newTask, user.uid, true));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tasks/${id}`);
      }
    }
    return newTask;
  };

  const updateTask = async (id: string, patch: Partial<Task>) => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;
    const updated: Task = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));

    // Keep linked timeblocks in sync if scheduledStart/End or completed changed
    if (
      patch.scheduledStart !== undefined ||
      patch.scheduledEnd !== undefined ||
      patch.completed !== undefined ||
      patch.title !== undefined
    ) {
      const linkedBlock = events.find((e) => e.taskId === id && e.kind === 'timeblock');
      if (linkedBlock) {
        await updateCalendarEvent(linkedBlock.id, {
          title: updated.title,
          startTime: updated.scheduledStart || linkedBlock.startTime,
          endTime: updated.scheduledEnd || linkedBlock.endTime,
          completed: updated.completed,
        });
      }
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'tasks', id), buildTaskCloudPayload(updated, user.uid, false));
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
      }
    }
  };

  const toggleTaskCompletion = async (id: string) => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return;
    const nextCompleted = !existing.completed;
    await updateTask(id, { completed: nextCompleted });

    // Award or revoke XP deterministically
    const xpVal = existing.priority === 'urgent' || existing.priority === 'high' ? 15 : 10;
    await grantOrRevokeXP(
      `xp_task_${id}`,
      `Completed task: ${existing.title}`,
      xpVal,
      id,
      nextCompleted
    );

    // If recurring task is completed, spawn next occurrence without mutating past occurrence
    if (nextCompleted && existing.recurrence !== 'none' && existing.dueDate) {
      const baseDate = new Date(`${existing.dueDate}T12:00:00`);
      if (!isNaN(baseDate.getTime())) {
        if (existing.recurrence === 'daily') baseDate.setDate(baseDate.getDate() + 1);
        else if (existing.recurrence === 'weekdays') {
          do {
            baseDate.setDate(baseDate.getDate() + 1);
          } while (baseDate.getDay() === 0 || baseDate.getDay() === 6);
        } else if (existing.recurrence === 'weekly') baseDate.setDate(baseDate.getDate() + 7);
        else if (existing.recurrence === 'monthly') baseDate.setMonth(baseDate.getMonth() + 1);

        const nextDateStr = baseDate.toISOString().slice(0, 10);
        const alreadySpawned = tasks.some(
          (t) => t.title === existing.title && t.dueDate === nextDateStr && !t.completed
        );
        if (!alreadySpawned) {
          await createTask({
            ...existing,
            id: generateId('task'),
            completed: false,
            dueDate: nextDateStr,
          });
          showToast(`Completed & scheduled next ${existing.recurrence} occurrence (${nextDateStr})`);
          return;
        }
      }
    }
    showToast(nextCompleted ? `Task completed (+${xpVal} XP)` : 'Task reopened');
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (preferences.topPriorities.includes(id)) {
      await updatePreferences({
        topPriorities: preferences.topPriorities.filter((pid) => pid !== id),
      });
    }
    if (user) {
      try {
        await deleteDoc(doc(db, 'tasks', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
      }
    }
    showToast('Task deleted');
  };

  const duplicateTask = async (id: string): Promise<Task | null> => {
    const existing = tasks.find((t) => t.id === id);
    if (!existing) return null;
    const copy = await createTask({
      ...existing,
      id: generateId('task'),
      title: `${existing.title} (Copy)`,
      completed: false,
    });
    showToast('Task duplicated');
    return copy;
  };

  // Calendar Events & Time Blocks CRUD
  const createCalendarEvent = async (
    input: Partial<CalendarEvent> & { title: string }
  ): Promise<CalendarEvent> => {
    const now = new Date().toISOString();
    const id = input.id || generateId('evt');
    const ev: CalendarEvent = {
      id,
      ownerId: user?.uid || 'local_user',
      title: input.title.trim().slice(0, 300),
      kind: input.kind || 'event',
      date: input.date || getTodayISO(),
      startTime: input.startTime || '09:00',
      endTime: input.endTime || '10:00',
      taskId: input.taskId || '',
      projectId: input.projectId || '',
      category: input.category || 'Schedule',
      location: input.location || '',
      notes: input.notes || '',
      recurrence: input.recurrence || 'none',
      isFixed: Boolean(input.isFixed ?? (input.kind !== 'timeblock')),
      completed: Boolean(input.completed ?? false),
      createdAt: now,
      updatedAt: now,
    };

    setEvents((prev) => [...prev, ev]);

    // If linked to a task, update task's scheduledStart/scheduledEnd
    if (ev.taskId) {
      const linkedTask = tasks.find((t) => t.id === ev.taskId);
      if (linkedTask) {
        await updateTask(ev.taskId, {
          dueDate: ev.date,
          scheduledStart: ev.startTime,
          scheduledEnd: ev.endTime,
        });
      }
    }

    if (user) {
      try {
        await setDoc(doc(db, 'calendar_events', id), {
          ownerId: user.uid,
          title: ev.title,
          kind: ev.kind,
          date: ev.date.slice(0, 40),
          startTime: ev.startTime.slice(0, 20),
          endTime: ev.endTime.slice(0, 20),
          taskId: ev.taskId.slice(0, 128),
          projectId: ev.projectId.slice(0, 128),
          category: ev.category.slice(0, 100),
          location: ev.location.slice(0, 300),
          notes: ev.notes.slice(0, 3000),
          recurrence: ev.recurrence,
          isFixed: ev.isFixed,
          completed: ev.completed,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `calendar_events/${id}`);
      }
    }
    return ev;
  };

  const updateCalendarEvent = async (id: string, patch: Partial<CalendarEvent>) => {
    const existing = events.find((e) => e.id === id);
    if (!existing) return;
    const updated: CalendarEvent = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)));

    if (user) {
      try {
        await updateDoc(doc(db, 'calendar_events', id), {
          title: updated.title.slice(0, 300),
          kind: updated.kind,
          date: updated.date.slice(0, 40),
          startTime: updated.startTime.slice(0, 20),
          endTime: updated.endTime.slice(0, 20),
          taskId: updated.taskId.slice(0, 128),
          projectId: updated.projectId.slice(0, 128),
          category: updated.category.slice(0, 100),
          location: updated.location.slice(0, 300),
          notes: updated.notes.slice(0, 3000),
          recurrence: updated.recurrence,
          isFixed: updated.isFixed,
          completed: updated.completed,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `calendar_events/${id}`);
      }
    }
  };

  const deleteCalendarEvent = async (id: string) => {
    const existing = events.find((e) => e.id === id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
    if (existing?.taskId) {
      await updateTask(existing.taskId, { scheduledStart: '', scheduledEnd: '' });
    }
    if (user) {
      try {
        await deleteDoc(doc(db, 'calendar_events', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `calendar_events/${id}`);
      }
    }
    showToast('Removed from schedule');
  };

  // Knowledge Items (Inbox, Notes, Ideas, Brain Dump) CRUD
  const createKnowledgeItem = async (
    input: Partial<KnowledgeItem> & { title: string }
  ): Promise<KnowledgeItem> => {
    const now = new Date().toISOString();
    const id = input.id || generateId('know');
    const itemType = input.itemType || 'inbox';
    const item: KnowledgeItem = {
      id,
      ownerId: user?.uid || 'local_user',
      itemType,
      title: input.title.trim().slice(0, 300),
      content: (input.content || '').slice(0, 20000),
      ideaStatus: itemType === 'idea' ? input.ideaStatus || 'raw' : 'none',
      whyItMatters: (input.whyItMatters || '').slice(0, 2000),
      nextAction: (input.nextAction || '').slice(0, 500),
      relatedLinks: (input.relatedLinks || []).slice(0, 20),
      linkedProjectId: input.linkedProjectId || '',
      linkedGoalId: input.linkedGoalId || '',
      category: input.category || 'General',
      tags: (input.tags || []).slice(0, 20),
      pinned: Boolean(input.pinned ?? false),
      archived: Boolean(input.archived ?? false),
      createdAt: now,
      updatedAt: now,
    };

    setKnowledge((prev) => [item, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'knowledge_items', id), {
          ownerId: user.uid,
          itemType: item.itemType,
          title: item.title,
          content: item.content,
          ideaStatus: item.ideaStatus,
          whyItMatters: item.whyItMatters,
          nextAction: item.nextAction,
          relatedLinks: item.relatedLinks.map((s) => String(s).slice(0, 500)),
          linkedProjectId: item.linkedProjectId.slice(0, 128),
          linkedGoalId: item.linkedGoalId.slice(0, 128),
          category: item.category.slice(0, 100),
          tags: item.tags.map((s) => String(s).slice(0, 64)),
          pinned: item.pinned,
          archived: item.archived,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `knowledge_items/${id}`);
      }
    }
    return item;
  };

  const updateKnowledgeItem = async (id: string, patch: Partial<KnowledgeItem>) => {
    const existing = knowledge.find((k) => k.id === id);
    if (!existing) return;
    const updated: KnowledgeItem = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setKnowledge((prev) => prev.map((k) => (k.id === id ? updated : k)));

    if (user) {
      try {
        await updateDoc(doc(db, 'knowledge_items', id), {
          itemType: updated.itemType,
          title: updated.title.slice(0, 300),
          content: updated.content.slice(0, 20000),
          ideaStatus: updated.ideaStatus,
          whyItMatters: updated.whyItMatters.slice(0, 2000),
          nextAction: updated.nextAction.slice(0, 500),
          relatedLinks: updated.relatedLinks.slice(0, 20).map((s) => String(s).slice(0, 500)),
          linkedProjectId: updated.linkedProjectId.slice(0, 128),
          linkedGoalId: updated.linkedGoalId.slice(0, 128),
          category: updated.category.slice(0, 100),
          tags: updated.tags.slice(0, 20).map((s) => String(s).slice(0, 64)),
          pinned: updated.pinned,
          archived: updated.archived,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `knowledge_items/${id}`);
      }
    }
  };

  const deleteKnowledgeItem = async (id: string) => {
    setKnowledge((prev) => prev.filter((k) => k.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'knowledge_items', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `knowledge_items/${id}`);
      }
    }
    showToast('Item deleted');
  };

  // Projects, Milestones & Goals CRUD
  const createProjectOrGoal = async (
    input: Partial<ProjectOrGoal> & { name: string }
  ): Promise<ProjectOrGoal> => {
    const now = new Date().toISOString();
    const id = input.id || generateId(input.recordType || 'proj');
    const record: ProjectOrGoal = {
      id,
      ownerId: user?.uid || 'local_user',
      recordType: input.recordType || 'project',
      name: input.name.trim().slice(0, 300),
      description: (input.description || '').slice(0, 5000),
      status: input.status || 'active',
      category: input.category || 'General',
      priority: input.priority || 'normal',
      startDate: input.startDate || getTodayISO(),
      targetDate: input.targetDate || '',
      parentProjectId: input.parentProjectId || '',
      linkedGoalId: input.linkedGoalId || '',
      measurableOutcome: (input.measurableOutcome || '').slice(0, 1000),
      progress: Math.min(Math.max(Number(input.progress) || 0, 0), 100),
      isManualProgress: Boolean(input.isManualProgress ?? false),
      nextAction: (input.nextAction || '').slice(0, 500),
      createdAt: now,
      updatedAt: now,
    };

    setProjectsGoals((prev) => [record, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'projects_goals', id), {
          ownerId: user.uid,
          recordType: record.recordType,
          name: record.name,
          description: record.description,
          status: record.status,
          category: record.category.slice(0, 100),
          priority: record.priority,
          startDate: record.startDate.slice(0, 40),
          targetDate: record.targetDate.slice(0, 40),
          parentProjectId: record.parentProjectId.slice(0, 128),
          linkedGoalId: record.linkedGoalId.slice(0, 128),
          measurableOutcome: record.measurableOutcome,
          progress: record.progress,
          isManualProgress: record.isManualProgress,
          nextAction: record.nextAction,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `projects_goals/${id}`);
      }
    }
    return record;
  };

  const updateProjectOrGoal = async (id: string, patch: Partial<ProjectOrGoal>) => {
    const existing = projectsGoals.find((p) => p.id === id);
    if (!existing) return;
    const updated: ProjectOrGoal = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setProjectsGoals((prev) => prev.map((p) => (p.id === id ? updated : p)));

    // If a milestone status changed to/from completed, grant or revoke 30 XP
    if (existing.recordType === 'milestone' && patch.status !== undefined) {
      const isComplete = patch.status === 'completed';
      await grantOrRevokeXP(
        `xp_milestone_${id}`,
        `Completed milestone: ${updated.name}`,
        30,
        id,
        isComplete
      );
    }

    if (user) {
      try {
        await updateDoc(doc(db, 'projects_goals', id), {
          recordType: updated.recordType,
          name: updated.name.slice(0, 300),
          description: updated.description.slice(0, 5000),
          status: updated.status,
          category: updated.category.slice(0, 100),
          priority: updated.priority,
          startDate: updated.startDate.slice(0, 40),
          targetDate: updated.targetDate.slice(0, 40),
          parentProjectId: updated.parentProjectId.slice(0, 128),
          linkedGoalId: updated.linkedGoalId.slice(0, 128),
          measurableOutcome: updated.measurableOutcome.slice(0, 1000),
          progress: Math.min(Math.max(Number(updated.progress) || 0, 0), 100),
          isManualProgress: updated.isManualProgress,
          nextAction: updated.nextAction.slice(0, 500),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projects_goals/${id}`);
      }
    }
  };

  const deleteProjectOrGoal = async (id: string) => {
    setProjectsGoals((prev) => prev.filter((p) => p.id !== id && p.parentProjectId !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'projects_goals', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `projects_goals/${id}`);
      }
    }
    showToast('Deleted record');
  };

  // Convert an Idea into an actionable Project + Milestones + Tasks while preserving the Idea
  const convertIdeaToProject = async (
    ideaId: string,
    milestonesInput: { name: string; tasks: string[] }[]
  ): Promise<string | null> => {
    const idea = knowledge.find((k) => k.id === ideaId);
    if (!idea) return null;

    // 1. Create the Project first (required before creating linked tasks)
    const proj = await createProjectOrGoal({
      recordType: 'project',
      name: idea.title,
      description: `${idea.content}\n\nWhy it matters: ${idea.whyItMatters || 'Converted from Second Brain Idea'}`,
      status: 'active',
      category: idea.category || 'Execution',
      priority: 'high',
      nextAction: idea.nextAction || 'Execute Milestone 1',
    });

    // 2. Preserve original idea and link it to the newly created project
    await updateKnowledgeItem(ideaId, {
      ideaStatus: 'active',
      linkedProjectId: proj.id,
    });

    // 3. Create Milestones and their associated Tasks
    for (const msInput of milestonesInput) {
      if (!msInput.name.trim()) continue;
      const ms = await createProjectOrGoal({
        recordType: 'milestone',
        name: msInput.name.trim(),
        parentProjectId: proj.id,
        status: 'not_started',
      });
      for (const taskTitle of msInput.tasks) {
        if (!taskTitle.trim()) continue;
        await createTask({
          title: taskTitle.trim(),
          projectId: proj.id,
          milestoneId: ms.id,
          category: idea.category || 'Project',
          priority: 'normal',
        });
      }
    }

    showToast(`Converted "${idea.title}" into an active project`);
    return proj.id;
  };

  // Habits, Occurrences, Focus Sessions & Reviews CRUD
  const createHabitOrLog = async (
    input: Partial<HabitOrLog> & { title: string }
  ): Promise<HabitOrLog> => {
    const now = new Date().toISOString();
    const id = input.id || generateId(input.logType || 'log');
    const log: HabitOrLog = {
      id,
      ownerId: user?.uid || 'local_user',
      logType: input.logType || 'habit',
      title: input.title.trim().slice(0, 300),
      description: (input.description || '').slice(0, 10000),
      category: (input.category || 'Routine').slice(0, 100),
      icon: (input.icon || 'check').slice(0, 50),
      scheduleType: input.scheduleType || 'daily',
      scheduleDays: input.scheduleDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      targetFrequency: Number(input.targetFrequency) || 7,
      date: input.date || getTodayISO(),
      occurrenceStatus: input.occurrenceStatus || 'none',
      durationMinutes: Number(input.durationMinutes) || 0,
      xpAmount: Number(input.xpAmount) || 0,
      sourceEntityId: input.sourceEntityId || '',
      archived: Boolean(input.archived ?? false),
      entries: (input.entries || []).slice(0, 30),
      createdAt: now,
      updatedAt: now,
    };

    setHabitsLogs((prev) => [log, ...prev]);

    if (user) {
      try {
        await setDoc(doc(db, 'habits_logs', id), {
          ownerId: user.uid,
          logType: log.logType,
          title: log.title,
          description: log.description,
          category: log.category,
          icon: log.icon,
          scheduleType: log.scheduleType,
          scheduleDays: log.scheduleDays.slice(0, 10).map((s) => String(s).slice(0, 20)),
          targetFrequency: Math.min(Math.max(log.targetFrequency, 0), 365),
          date: log.date.slice(0, 40),
          occurrenceStatus: log.occurrenceStatus,
          durationMinutes: Math.min(Math.max(log.durationMinutes, 0), 1440),
          xpAmount: Math.min(Math.max(log.xpAmount, -10000), 10000),
          sourceEntityId: log.sourceEntityId.slice(0, 128),
          archived: log.archived,
          entries: log.entries.slice(0, 30).map((s) => String(s).slice(0, 2000)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `habits_logs/${id}`);
      }
    }

    if (log.logType === 'weekly_review') {
      await grantOrRevokeXP(
        `xp_weekly_${id}`,
        `Completed Weekly Review (${log.date})`,
        20,
        id,
        true
      );
    }

    return log;
  };

  const updateHabitOrLog = async (id: string, patch: Partial<HabitOrLog>) => {
    const existing = habitsLogs.find((h) => h.id === id);
    if (!existing) return;
    if (existing.logType === 'xp_transaction' || existing.logType === 'achievement') {
      return; // Terminal state locked
    }
    const updated: HabitOrLog = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setHabitsLogs((prev) => prev.map((h) => (h.id === id ? updated : h)));

    if (user) {
      try {
        await updateDoc(doc(db, 'habits_logs', id), {
          title: updated.title.slice(0, 300),
          description: updated.description.slice(0, 10000),
          category: updated.category.slice(0, 100),
          icon: updated.icon.slice(0, 50),
          scheduleType: updated.scheduleType,
          scheduleDays: updated.scheduleDays.slice(0, 10).map((s) => String(s).slice(0, 20)),
          targetFrequency: Math.min(Math.max(updated.targetFrequency, 0), 365),
          date: updated.date.slice(0, 40),
          occurrenceStatus: updated.occurrenceStatus,
          durationMinutes: Math.min(Math.max(updated.durationMinutes, 0), 1440),
          xpAmount: Math.min(Math.max(updated.xpAmount, -10000), 10000),
          sourceEntityId: updated.sourceEntityId.slice(0, 128),
          archived: updated.archived,
          entries: updated.entries.slice(0, 30).map((s) => String(s).slice(0, 2000)),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `habits_logs/${id}`);
      }
    }
  };

  const deleteHabitOrLog = async (id: string) => {
    setHabitsLogs((prev) => prev.filter((h) => h.id !== id));
    if (user) {
      try {
        await deleteDoc(doc(db, 'habits_logs', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `habits_logs/${id}`);
      }
    }
  };

  const toggleHabitOccurrence = async (
    habitId: string,
    date: string,
    status: 'completed' | 'skipped' | 'none'
  ) => {
    const habit = habitsLogs.find((h) => h.id === habitId && h.logType === 'habit');
    if (!habit) return;
    const occId = `occ_${habitId}_${date}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 120);
    const existingOcc = habitsLogs.find(
      (h) =>
        h.logType === 'habit_occurrence' &&
        (h.id === occId || (h.sourceEntityId === habitId && h.date === date))
    );

    if (status === 'none') {
      if (existingOcc) {
        await deleteHabitOrLog(existingOcc.id);
      }
      await grantOrRevokeXP(
        `xp_habit_${habitId}_${date}`,
        `Habit: ${habit.title} (${date})`,
        5,
        habitId,
        false
      );
      return;
    }

    if (existingOcc) {
      await updateHabitOrLog(existingOcc.id, { occurrenceStatus: status });
    } else {
      await createHabitOrLog({
        id: occId,
        logType: 'habit_occurrence',
        title: habit.title,
        sourceEntityId: habitId,
        date,
        occurrenceStatus: status,
      });
    }

    await grantOrRevokeXP(
      `xp_habit_${habitId}_${date}`,
      `Habit: ${habit.title} (${date})`,
      5,
      habitId,
      status === 'completed'
    );
  };

  const recordFocusSession = async (
    taskId: string,
    taskTitle: string,
    durationMinutes: number
  ) => {
    const mins = Math.max(1, Math.round(durationMinutes));
    const sess = await createHabitOrLog({
      logType: 'focus_session',
      title: taskTitle || 'Deep Focus Session',
      sourceEntityId: taskId || '',
      date: getTodayISO(),
      durationMinutes: mins,
      occurrenceStatus: 'completed',
    });

    if (taskId) {
      const t = tasks.find((x) => x.id === taskId);
      if (t) {
        await updateTask(taskId, { actualMinutes: (t.actualMinutes || 0) + mins });
      }
    }

    await grantOrRevokeXP(
      `xp_focus_${sess.id}`,
      `Focus session (${mins}m): ${taskTitle || 'Deep Work'}`,
      10,
      sess.id,
      true
    );
    showToast(`Logged ${mins}m focus session (+10 XP)`);
  };

  // Calculate Project Progress from linked tasks and milestones
  const getProjectProgress = (projectId: string): number => {
    const proj = projectsGoals.find((p) => p.id === projectId);
    if (!proj) return 0;
    if (proj.isManualProgress) return proj.progress;

    const projTasks = tasks.filter((t) => t.projectId === projectId && !t.archived);
    const projMilestones = projectsGoals.filter(
      (m) => m.recordType === 'milestone' && m.parentProjectId === projectId
    );

    const totalItems = projTasks.length + projMilestones.length;
    if (totalItems === 0) return proj.status === 'completed' ? 100 : 0;

    const completedTasks = projTasks.filter((t) => t.completed).length;
    const completedMilestones = projMilestones.filter((m) => m.status === 'completed').length;
    return Math.round(((completedTasks + completedMilestones) / totalItems) * 100);
  };

  // Calculate Habit Streak accurately respecting completed and skipped occurrences
  const getHabitStreak = (habitId: string): number => {
    const occs = habitsLogs.filter(
      (h) => h.logType === 'habit_occurrence' && h.sourceEntityId === habitId
    );
    if (occs.length === 0) return 0;
    const occMap = new Map<string, string>();
    for (const o of occs) {
      occMap.set(o.date, o.occurrenceStatus);
    }

    let streak = 0;
    const cursor = new Date();
    for (let i = 0; i < 365; i++) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;
      const status = occMap.get(dateStr);

      if (status === 'completed') {
        streak++;
      } else if (status === 'skipped') {
        // Skipped occurrence preserves streak without incrementing
      } else {
        // Allow today to be uncompleted without zeroing yesterday's streak
        if (i > 0) break;
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  };

  const totalXP = useMemo(() => {
    return habitsLogs
      .filter((h) => h.logType === 'xp_transaction')
      .reduce((acc, item) => acc + (Number(item.xpAmount) || 0), 0);
  }, [habitsLogs]);

  const currentLevel = Math.floor(Math.max(0, totalXP) / 100) + 1;
  const xpInLevel = Math.max(0, totalXP) % 100;
  const xpForNextLevel = 100;

  // Export & Backup
  const exportFullJSON = (): string => {
    return JSON.stringify(
      {
        app: 'LifeOS',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        preferences,
        tasks,
        events,
        knowledge,
        projectsGoals,
        habitsLogs,
      },
      null,
      2
    );
  };

  const exportTasksCSV = (): string => {
    const headers = [
      'id',
      'title',
      'completed',
      'priority',
      'dueDate',
      'scheduledStart',
      'scheduledEnd',
      'estimatedMinutes',
      'actualMinutes',
      'category',
      'energyRequired',
    ];
    const rows = tasks.map((t) =>
      [
        t.id,
        `"${(t.title || '').replace(/"/g, '""')}"`,
        t.completed,
        t.priority,
        t.dueDate,
        t.scheduledStart,
        t.scheduledEnd,
        t.estimatedMinutes,
        t.actualMinutes,
        `"${(t.category || '').replace(/"/g, '""')}"`,
        t.energyRequired,
      ].join(',')
    );
    return [headers.join(','), ...rows].join('\n');
  };

  const importBackupJSON = async (
    rawJson: string,
    mode: 'merge' | 'replace'
  ): Promise<{ importedCount: number }> => {
    const parsed = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid backup file format.');
    }

    const inTasks: Task[] = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    const inEvents: CalendarEvent[] = Array.isArray(parsed.events) ? parsed.events : [];
    const inKnowledge: KnowledgeItem[] = Array.isArray(parsed.knowledge) ? parsed.knowledge : [];
    const inPG: ProjectOrGoal[] = Array.isArray(parsed.projectsGoals) ? parsed.projectsGoals : [];
    const inHL: HabitOrLog[] = Array.isArray(parsed.habitsLogs) ? parsed.habitsLogs : [];

    const mergeById = <T extends { id: string }>(current: T[], incomingList: T[]) => {
      if (mode === 'replace') return incomingList;
      const map = new Map<string, T>();
      for (const item of current) map.set(item.id, item);
      for (const item of incomingList) {
        if (item && item.id) map.set(item.id, item);
      }
      return Array.from(map.values());
    };

    const nextTasks = mergeById(tasks, inTasks);
    const nextEvents = mergeById(events, inEvents);
    const nextKnowledge = mergeById(knowledge, inKnowledge);
    const nextPG = mergeById(projectsGoals, inPG);
    const nextHL = mergeById(habitsLogs, inHL);

    if (parsed.preferences) {
      setPreferences({ ...DEFAULT_PREFERENCES, ...parsed.preferences });
    }
    setProjectsGoals(nextPG);
    setTasks(nextTasks);
    setEvents(nextEvents);
    setKnowledge(nextKnowledge);
    setHabitsLogs(nextHL);

    const total =
      inTasks.length + inEvents.length + inKnowledge.length + inPG.length + inHL.length;
    showToast(`Restored ${total} records (${mode} mode)`);
    return { importedCount: total };
  };

  const clearAllData = async () => {
    if (user) {
      for (const t of tasks) await deleteDoc(doc(db, 'tasks', t.id));
      for (const e of events) await deleteDoc(doc(db, 'calendar_events', e.id));
      for (const k of knowledge) await deleteDoc(doc(db, 'knowledge_items', k.id));
      for (const p of projectsGoals) await deleteDoc(doc(db, 'projects_goals', p.id));
      for (const h of habitsLogs) await deleteDoc(doc(db, 'habits_logs', h.id));
    }
    setTasks([]);
    setEvents([]);
    setKnowledge([]);
    setProjectsGoals([]);
    setHabitsLogs([]);
    setPreferences(DEFAULT_PREFERENCES);
    localStorage.removeItem(STORAGE_KEY);
    showToast('All data cleared');
  };

  return (
    <LifeOSContext.Provider
      value={{
        user,
        authReady,
        syncStatus,
        activeTab,
        setActiveTab,
        preferences,
        tasks,
        events,
        knowledge,
        projectsGoals,
        habitsLogs,
        loginWithGoogle,
        logout,
        syncLocalToCloud,
        updatePreferences,
        toggleTopPriority,
        createTask,
        updateTask,
        toggleTaskCompletion,
        deleteTask,
        duplicateTask,
        createCalendarEvent,
        updateCalendarEvent,
        deleteCalendarEvent,
        createKnowledgeItem,
        updateKnowledgeItem,
        deleteKnowledgeItem,
        convertIdeaToProject,
        createProjectOrGoal,
        updateProjectOrGoal,
        deleteProjectOrGoal,
        createHabitOrLog,
        updateHabitOrLog,
        deleteHabitOrLog,
        toggleHabitOccurrence,
        recordFocusSession,
        getProjectProgress,
        getHabitStreak,
        totalXP,
        currentLevel,
        xpInLevel,
        xpForNextLevel,
        exportFullJSON,
        exportTasksCSV,
        importBackupJSON,
        clearAllData,
        isQuickAddOpen,
        setIsQuickAddOpen,
        quickAddDefaultType,
        openQuickAdd,
        isSearchOpen,
        setIsSearchOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isWhatNowOpen,
        setIsWhatNowOpen,
        isPlanRecoveryOpen,
        setIsPlanRecoveryOpen,
        activeFocusTaskId,
        isFocusModalOpen,
        startFocusForTask,
        setIsFocusModalOpen,
        toastMessage,
        showToast,
      }}
    >
      {children}
    </LifeOSContext.Provider>
  );
};

export function useLifeOS() {
  const ctx = useContext(LifeOSContext);
  if (!ctx) throw new Error('useLifeOS must be used within LifeOSProvider');
  return ctx;
}
