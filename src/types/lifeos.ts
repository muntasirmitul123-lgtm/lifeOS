export type PriorityLevel = 'low' | 'normal' | 'high' | 'urgent';
export type RecurrencePattern = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';
export type EnergyLevel = 'low' | 'moderate' | 'high';
export type TaskEnergyRequirement = 'low' | 'moderate' | 'high' | 'any';
export type IdeaStatus = 'raw' | 'exploring' | 'active' | 'archived' | 'none';
export type ProjectStatus = 'not_started' | 'active' | 'on_hold' | 'completed' | 'archived';
export type PrimaryNavTab = 'today' | 'planner' | 'inbox' | 'projects' | 'insights';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  completed: boolean;
  priority: PriorityLevel;
  dueDate: string; // YYYY-MM-DD or ''
  startDate: string; // YYYY-MM-DD or ''
  scheduledStart: string; // HH:mm or ''
  scheduledEnd: string; // HH:mm or ''
  estimatedMinutes: number;
  actualMinutes: number;
  category: string;
  projectId: string;
  milestoneId: string;
  tags: string[];
  subtasks: Subtask[];
  dependencyIds: string[];
  recurrence: RecurrencePattern;
  energyRequired: TaskEnergyRequirement;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  kind: 'event' | 'timeblock';
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  taskId: string;
  projectId: string;
  category: string;
  location: string;
  notes: string;
  recurrence: RecurrencePattern;
  isFixed: boolean;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  ownerId: string;
  itemType: 'inbox' | 'note' | 'idea' | 'brain_dump';
  title: string;
  content: string;
  ideaStatus: IdeaStatus;
  whyItMatters: string;
  nextAction: string;
  relatedLinks: string[];
  linkedProjectId: string;
  linkedGoalId: string;
  category: string;
  tags: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectOrGoal {
  id: string;
  ownerId: string;
  recordType: 'project' | 'milestone' | 'goal';
  name: string;
  description: string;
  status: ProjectStatus;
  category: string;
  priority: PriorityLevel;
  startDate: string;
  targetDate: string;
  parentProjectId: string; // used by milestones
  linkedGoalId: string; // used by projects
  measurableOutcome: string; // used by goals
  progress: number; // 0-100
  isManualProgress: boolean;
  nextAction: string;
  createdAt: string;
  updatedAt: string;
}

export interface HabitOrLog {
  id: string;
  ownerId: string;
  logType:
    | 'habit'
    | 'habit_occurrence'
    | 'focus_session'
    | 'daily_review'
    | 'weekly_review'
    | 'xp_transaction'
    | 'achievement';
  title: string;
  description: string;
  category: string;
  icon: string;
  scheduleType: 'daily' | 'weekdays' | 'weekly' | 'custom' | 'none';
  scheduleDays: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  targetFrequency: number;
  date: string; // YYYY-MM-DD
  occurrenceStatus: 'completed' | 'skipped' | 'missed' | 'none';
  durationMinutes: number;
  xpAmount: number;
  sourceEntityId: string; // habitId for occurrence, taskId for focus_session / xp_transaction
  archived: boolean;
  entries: string[]; // structured key-value lines for reviews/achievements
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  ownerId: string;
  theme: 'dark' | 'light';
  energyLevel: EnergyLevel;
  energyNote: string;
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  workStartHour: string;
  workEndHour: string;
  weekStartsOn: 'monday' | 'sunday';
  gamificationEnabled: boolean;
  remindersEnabled: boolean;
  topPriorities: string[]; // up to 3 task IDs
  visibleSections: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BrainDumpCandidate {
  id: string;
  type: 'task' | 'idea' | 'note' | 'project';
  title: string;
  description: string;
  priority: PriorityLevel;
  explicitDeadline: string;
  category: string;
  estimatedMinutes: number;
  suggestedSubtasks: string[];
  selected: boolean;
}
