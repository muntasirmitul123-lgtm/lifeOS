import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  FileText,
  Lightbulb,
  FolderKanban,
  Target,
  Calendar,
  Repeat,
  X,
  Plus,
  Trash2,
  Copy,
  Play,
  Star,
} from 'lucide-react';
import { useLifeOS, getTodayISO, generateId } from '../context/LifeOSContext';
import {
  PriorityLevel,
  RecurrencePattern,
  Subtask,
  Task,
  TaskEnergyRequirement,
} from '../types/lifeos';

export const QuickAddModal: React.FC = () => {
  const {
    isQuickAddOpen,
    setIsQuickAddOpen,
    quickAddDefaultType,
    createTask,
    createKnowledgeItem,
    createProjectOrGoal,
    createCalendarEvent,
    createHabitOrLog,
    projectsGoals,
    showToast,
    setActiveTab,
  } = useLifeOS();

  const [mode, setMode] = useState<
    'task' | 'note' | 'idea' | 'project' | 'goal' | 'event' | 'habit'
  >('task');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [dueDate, setDueDate] = useState(getTodayISO());
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [category, setCategory] = useState('General');
  const [projectId, setProjectId] = useState('');
  const [energyRequired, setEnergyRequired] = useState<TaskEnergyRequirement>('any');
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('none');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [measurableOutcome, setMeasurableOutcome] = useState('');
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekdays' | 'weekly'>('daily');

  useEffect(() => {
    if (isQuickAddOpen) {
      if (quickAddDefaultType === 'brain_dump') {
        setIsQuickAddOpen(false);
        setActiveTab('inbox');
        return;
      }
      setMode(quickAddDefaultType);
      setTitle('');
      setDescription('');
      setPriority('normal');
      setDueDate(getTodayISO());
    }
  }, [isQuickAddOpen, quickAddDefaultType]);

  if (!isQuickAddOpen) return null;

  const projects = projectsGoals.filter((p) => p.recordType === 'project' && p.status !== 'archived');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (mode === 'task') {
      await createTask({
        title: title.trim(),
        description,
        priority,
        dueDate,
        estimatedMinutes,
        category,
        projectId,
        energyRequired,
        recurrence,
      });
      showToast('Task created');
    } else if (mode === 'note') {
      await createKnowledgeItem({
        itemType: 'note',
        title: title.trim(),
        content: description,
        category,
        linkedProjectId: projectId,
      });
      showToast('Note saved to Second Brain');
    } else if (mode === 'idea') {
      await createKnowledgeItem({
        itemType: 'idea',
        title: title.trim(),
        content: description,
        ideaStatus: 'raw',
        whyItMatters,
        category,
        linkedProjectId: projectId,
      });
      showToast('Idea captured');
    } else if (mode === 'project') {
      await createProjectOrGoal({
        recordType: 'project',
        name: title.trim(),
        description,
        priority,
        targetDate: dueDate,
        category,
        status: 'active',
      });
      showToast('Project created');
    } else if (mode === 'goal') {
      await createProjectOrGoal({
        recordType: 'goal',
        name: title.trim(),
        description,
        targetDate: dueDate,
        measurableOutcome: measurableOutcome || 'Complete all linked milestones',
        category,
        status: 'active',
      });
      showToast('Goal created');
    } else if (mode === 'event') {
      await createCalendarEvent({
        title: title.trim(),
        kind: 'event',
        date: dueDate || getTodayISO(),
        startTime,
        endTime,
        category,
        notes: description,
        recurrence,
        isFixed: true,
      });
      showToast('Calendar event scheduled');
    } else if (mode === 'habit') {
      await createHabitOrLog({
        logType: 'habit',
        title: title.trim(),
        description,
        category,
        scheduleType,
        targetFrequency: scheduleType === 'weekdays' ? 5 : scheduleType === 'weekly' ? 1 : 7,
      });
      showToast('Habit added');
    }

    setIsQuickAddOpen(false);
  };

  const tabs: { id: typeof mode; label: string; icon: React.ReactNode }[] = [
    { id: 'task', label: 'Task', icon: <CheckSquare className="w-3.5 h-3.5" /> },
    { id: 'note', label: 'Note', icon: <FileText className="w-3.5 h-3.5" /> },
    { id: 'idea', label: 'Idea', icon: <Lightbulb className="w-3.5 h-3.5" /> },
    { id: 'event', label: 'Event', icon: <Calendar className="w-3.5 h-3.5" /> },
    { id: 'project', label: 'Project', icon: <FolderKanban className="w-3.5 h-3.5" /> },
    { id: 'goal', label: 'Goal', icon: <Target className="w-3.5 h-3.5" /> },
    { id: 'habit', label: 'Habit', icon: <Repeat className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-[#171E19] border border-[#29342C] p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="w-10 h-1.5 bg-[#29342C] rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-[#F0F4F0]">Quick Capture</h2>
          <button
            onClick={() => setIsQuickAddOpen(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0] hover:bg-[#1D2620]"
            aria-label="Close Quick Capture"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                mode === t.id
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'bg-[#111713] text-[#99A69C] hover:text-[#F0F4F0] border border-[#29342C]'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs text-[#99A69C] mb-1">
              {mode === 'project' || mode === 'goal' ? 'Name' : 'Title'} *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Enter ${mode} title...`}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] placeholder-[#68766D] focus:outline-none focus:border-[#79D99A]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#99A69C] mb-1">
              {mode === 'note' ? 'Content (Markdown / Checklist supported)' : 'Description / Details'}
            </label>
            <textarea
              rows={mode === 'note' ? 4 : 2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional context, notes, or details..."
              className="w-full px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] placeholder-[#68766D] focus:outline-none focus:border-[#79D99A]"
            />
          </div>

          {mode === 'idea' && (
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Why It Matters</label>
              <input
                type="text"
                value={whyItMatters}
                onChange={(e) => setWhyItMatters(e.target.value)}
                placeholder="What problem does this solve or why is it worth exploring?"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] focus:outline-none focus:border-[#79D99A]"
              />
            </div>
          )}

          {mode === 'goal' && (
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Measurable Outcome</label>
              <input
                type="text"
                value={measurableOutcome}
                onChange={(e) => setMeasurableOutcome(e.target.value)}
                placeholder="e.g., Launch MVP to 50 users or score 90%+ on exam"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] focus:outline-none focus:border-[#79D99A]"
              />
            </div>
          )}

          {(mode === 'task' || mode === 'project') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Due / Target Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] tabular-nums"
                />
              </div>
            </div>
          )}

          {mode === 'task' && (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Est. Mins</label>
                <input
                  type="number"
                  min={5}
                  max={480}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Energy</label>
                <select
                  value={energyRequired}
                  onChange={(e) => setEnergyRequired(e.target.value as TaskEnergyRequirement)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
                >
                  <option value="any">Any</option>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Repeat</label>
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrencePattern)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
            </div>
          )}

          {mode === 'event' && (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Start</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">End</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full min-h-[42px] px-2.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
                />
              </div>
            </div>
          )}

          {mode === 'habit' && (
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Schedule Frequency</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as any)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
              >
                <option value="daily">Every Day (7x / week)</option>
                <option value="weekdays">Weekdays Only (Mon–Fri)</option>
                <option value="weekly">Weekly Routine</option>
              </select>
            </div>
          )}

          {(mode === 'task' || mode === 'note' || mode === 'idea') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Work, Study, Health..."
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Link to Project</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
                >
                  <option value="">No Project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsQuickAddOpen(false)}
              className="flex-1 min-h-[44px] rounded-xl bg-[#111713] border border-[#29342C] text-sm font-medium text-[#99A69C] hover:text-[#F0F4F0]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-h-[44px] rounded-xl bg-[#79D99A] text-[#0B0F0D] text-sm font-semibold hover:bg-[#B5DDBF] transition-colors"
            >
              Save {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Reusable Task Detail & Edit Sheet
export const TaskDetailModal: React.FC<{
  task: Task | null;
  onClose: () => void;
}> = ({ task, onClose }) => {
  const {
    updateTask,
    deleteTask,
    duplicateTask,
    toggleTaskCompletion,
    toggleTopPriority,
    preferences,
    projectsGoals,
    startFocusForTask,
    createCalendarEvent,
  } = useLifeOS();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('normal');
  const [dueDate, setDueDate] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState(30);
  const [category, setCategory] = useState('');
  const [projectId, setProjectId] = useState('');
  const [energyRequired, setEnergyRequired] = useState<TaskEnergyRequirement>('any');
  const [recurrence, setRecurrence] = useState<RecurrencePattern>('none');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setPriority(task.priority);
      setDueDate(task.dueDate);
      setScheduledStart(task.scheduledStart);
      setScheduledEnd(task.scheduledEnd);
      setEstimatedMinutes(task.estimatedMinutes || 30);
      setCategory(task.category || 'General');
      setProjectId(task.projectId || '');
      setEnergyRequired(task.energyRequired || 'any');
      setRecurrence(task.recurrence || 'none');
      setSubtasks(task.subtasks || []);
      setTagsInput((task.tags || []).join(', '));
    }
  }, [task]);

  if (!task) return null;

  const isTopPriority = preferences.topPriorities.includes(task.id);
  const projects = projectsGoals.filter((p) => p.recordType === 'project');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const parsedTags = tagsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    await updateTask(task.id, {
      title: title.trim(),
      description,
      priority,
      dueDate,
      scheduledStart,
      scheduledEnd,
      estimatedMinutes: Number(estimatedMinutes) || 30,
      category,
      projectId,
      energyRequired,
      recurrence,
      subtasks,
      tags: parsedTags,
    });

    if (scheduledStart && scheduledEnd && dueDate) {
      await createCalendarEvent({
        title: title.trim(),
        kind: 'timeblock',
        date: dueDate,
        startTime: scheduledStart,
        endTime: scheduledEnd,
        taskId: task.id,
        projectId,
        category,
        isFixed: false,
        completed: task.completed,
      });
    }
    onClose();
  };

  const addSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const next: Subtask[] = [
      ...subtasks,
      { id: generateId('sub'), title: newSubtaskTitle.trim(), completed: false },
    ];
    setSubtasks(next);
    setNewSubtaskTitle('');
  };

  const toggleSubtask = (subId: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    );
  };

  const removeSubtask = (subId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-xl rounded-t-3xl sm:rounded-2xl bg-[#171E19] border border-[#29342C] p-5 sm:p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleTaskCompletion(task.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                task.completed
                  ? 'bg-[#79D99A]/20 text-[#79D99A] border border-[#79D99A]/40'
                  : 'bg-[#111713] text-[#F0F4F0] border border-[#29342C]'
              }`}
            >
              {task.completed ? 'Completed' : 'Mark Complete'}
            </button>
            <button
              type="button"
              onClick={() => toggleTopPriority(task.id)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 border transition-colors ${
                isTopPriority
                  ? 'bg-[#E8B86D]/15 border-[#E8B86D]/40 text-[#E8B86D]'
                  : 'bg-[#111713] border-[#29342C] text-[#99A69C]'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>{isTopPriority ? 'Top 3 Priority' : 'Pin to Top 3'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                startFocusForTask(task.id);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#79D99A] flex items-center gap-1"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Focus</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs text-[#99A69C] mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm font-medium text-[#F0F4F0]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#99A69C] mb-1">Description & Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-sm text-[#F0F4F0]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Start Block</label>
              <input
                type="time"
                value={scheduledStart}
                onChange={(e) => setScheduledStart(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">End Block</label>
              <input
                type="time"
                value={scheduledEnd}
                onChange={(e) => setScheduledEnd(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Est. Mins</label>
              <input
                type="number"
                min={5}
                max={1440}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Energy</label>
              <select
                value={energyRequired}
                onChange={(e) => setEnergyRequired(e.target.value as TaskEnergyRequirement)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="any">Any</option>
                <option value="low">Low</option>
                <option value="moderate">Moderate</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Recurrence</label>
              <select
                value={recurrence}
                onChange={(e) => setRecurrence(e.target.value as RecurrencePattern)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="study, deep-work"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
            </div>
          </div>

          {/* Subtasks */}
          <div className="bg-[#111713] border border-[#29342C] rounded-xl p-3.5">
            <label className="block text-xs font-medium text-[#99A69C] mb-2">
              Subtasks ({subtasks.filter((s) => s.completed).length}/{subtasks.length})
            </label>
            <div className="space-y-1.5 mb-2.5">
              {subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between gap-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={sub.completed}
                      onChange={() => toggleSubtask(sub.id)}
                      className="rounded border-[#29342C] accent-[#79D99A]"
                    />
                    <span className={sub.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'}>
                      {sub.title}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removeSubtask(sub.id)}
                    className="text-[#68766D] hover:text-[#E87979] p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addSubtask();
                  }
                }}
                placeholder="Add a subtask..."
                className="flex-1 min-h-[36px] px-3 py-1 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#F0F4F0]"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="min-h-[36px] px-3 rounded-lg bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#29342C]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await duplicateTask(task.id);
                  onClose();
                }}
                className="min-h-[40px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Duplicate
              </button>
              <button
                type="button"
                onClick={async () => {
                  await deleteTask(task.id);
                  onClose();
                }}
                className="min-h-[40px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#E87979] hover:bg-[#E87979]/10 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>

            <button
              type="submit"
              className="min-h-[42px] px-5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-sm font-semibold hover:bg-[#B5DDBF] transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
