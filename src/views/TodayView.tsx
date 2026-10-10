import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Compass,
  Play,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Calendar,
  ChevronRight,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
} from 'lucide-react';
import { getTodayISO, useLifeOS } from '../context/LifeOSContext';
import { EnergyLevel, Task } from '../types/lifeos';
import { TaskDetailModal } from '../components/QuickAddModal';

export const TodayView: React.FC = () => {
  const {
    tasks,
    events,
    knowledge,
    projectsGoals,
    habitsLogs,
    preferences,
    updatePreferences,
    createTask,
    createKnowledgeItem,
    toggleTaskCompletion,
    toggleTopPriority,
    toggleHabitOccurrence,
    startFocusForTask,
    setIsWhatNowOpen,
    setIsPlanRecoveryOpen,
    setActiveTab,
    openQuickAdd,
    getProjectProgress,
    getHabitStreak,
    createCalendarEvent,
    updateTask,
    showToast,
  } = useLifeOS();

  const today = getTodayISO();
  const [quickInput, setQuickInput] = useState('');
  const [quickMode, setQuickMode] = useState<'task' | 'note'>('task');
  const [inspectTask, setInspectTask] = useState<Task | null>(null);
  const [showCustomizeSections, setShowCustomizeSections] = useState(false);

  // AI Daily Plan Proposal state
  const [aiPlanLoading, setAiPlanLoading] = useState(false);
  const [aiProposal, setAiProposal] = useState<{
    summary: string;
    proposedBlocks: {
      taskId: string;
      title: string;
      startTime: string;
      endTime: string;
      category: string;
      rationale: string;
    }[];
    deferredTasks: { taskId: string; title: string; reason: string }[];
    aiMeta?: { model: string; thinkingLevel: string; usedFallback: boolean };
  } | null>(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const formattedDate = useMemo(() => {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date());
  }, []);

  // Real derived statistics for Today
  const dueTodayTasks = useMemo(
    () => tasks.filter((t) => !t.archived && t.dueDate === today),
    [tasks, today]
  );

  const overdueTasks = useMemo(
    () => tasks.filter((t) => !t.archived && !t.completed && t.dueDate && t.dueDate < today),
    [tasks, today]
  );

  const upcomingDeadlines = useMemo(
    () =>
      tasks
        .filter((t) => !t.archived && !t.completed && t.dueDate && t.dueDate > today)
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        .slice(0, 5),
    [tasks, today]
  );

  const topPriorityTasks = useMemo(
    () =>
      preferences.topPriorities
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is Task => Boolean(t)),
    [preferences.topPriorities, tasks]
  );

  const activeHabits = useMemo(
    () => habitsLogs.filter((h) => h.logType === 'habit' && !h.archived),
    [habitsLogs]
  );

  const todayHabitOccurrences = useMemo(
    () =>
      habitsLogs.filter(
        (h) => h.logType === 'habit_occurrence' && h.date === today
      ),
    [habitsLogs, today]
  );

  const todayFocusMinutes = useMemo(
    () =>
      habitsLogs
        .filter((h) => h.logType === 'focus_session' && h.date === today)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0),
    [habitsLogs, today]
  );

  const todayXP = useMemo(
    () =>
      habitsLogs
        .filter((h) => h.logType === 'xp_transaction' && h.date === today)
        .reduce((sum, x) => sum + (x.xpAmount || 0), 0),
    [habitsLogs, today]
  );

  // Chronological timeline entries for today (events + time-blocked tasks)
  const timelineEntries = useMemo(() => {
    const todayEvents = events.filter((e) => e.date === today);
    const items: {
      id: string;
      startTime: string;
      endTime: string;
      title: string;
      category: string;
      isFixed: boolean;
      completed: boolean;
      taskId: string;
      location: string;
    }[] = todayEvents.map((e) => ({
      id: e.id,
      startTime: e.startTime,
      endTime: e.endTime,
      title: e.title,
      category: e.category || (e.isFixed ? 'Appointment' : 'Time Block'),
      isFixed: e.isFixed,
      completed: e.completed,
      taskId: e.taskId,
      location: e.location,
    }));

    // Also include tasks due today that have scheduledStart/End but no separate event record
    for (const t of dueTodayTasks) {
      if (
        t.scheduledStart &&
        t.scheduledEnd &&
        !items.some((i) => i.taskId === t.id)
      ) {
        items.push({
          id: `task_tl_${t.id}`,
          startTime: t.scheduledStart,
          endTime: t.scheduledEnd,
          title: t.title,
          category: t.category || 'Task',
          isFixed: false,
          completed: t.completed,
          taskId: t.id,
          location: '',
        });
      }
    }

    return items.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [events, dueTodayTasks, today]);

  const unscheduledTodayTasks = useMemo(
    () => dueTodayTasks.filter((t) => !t.scheduledStart),
    [dueTodayTasks]
  );

  const scheduledMinutesToday = useMemo(() => {
    return timelineEntries.reduce((sum, item) => {
      const [sh, sm] = (item.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (item.endTime || '10:00').split(':').map(Number);
      const diff = eh * 60 + em - (sh * 60 + sm);
      return sum + (diff > 0 ? diff : 0);
    }, 0);
  }, [timelineEntries]);

  const completedTodayCount = dueTodayTasks.filter((t) => t.completed).length;
  const totalTodayCount = dueTodayTasks.length;
  const dailyCompletionPct =
    totalTodayCount > 0 ? Math.round((completedTodayCount / totalTodayCount) * 100) : 0;

  const completedHabitsToday = todayHabitOccurrences.filter(
    (o) => o.occurrenceStatus === 'completed'
  ).length;

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    if (quickMode === 'task') {
      await createTask({
        title: quickInput.trim(),
        dueDate: today,
        priority: 'normal',
        energyRequired: preferences.energyLevel,
      });
      showToast('Added task to Today');
    } else {
      await createKnowledgeItem({
        itemType: 'inbox',
        title: quickInput.trim(),
        content: '',
      });
      showToast('Captured to Second Brain Inbox');
    }
    setQuickInput('');
  };

  const generateAIDailyPlan = async () => {
    setAiPlanLoading(true);
    try {
      const candidateTasks = tasks.filter(
        (t) =>
          !t.completed &&
          !t.archived &&
          (t.dueDate === today || !t.dueDate || t.dueDate < today)
      );
      const todayFixed = events.filter((e) => e.date === today && e.isFixed);
      const res = await fetch('/api/ai/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: today,
          tasks: candidateTasks,
          events: todayFixed,
          preferences,
        }),
      });
      const data = await res.json();
      setAiProposal(data);
    } catch {
      showToast('Could not generate daily plan proposal');
    } finally {
      setAiPlanLoading(false);
    }
  };

  const applyAIProposal = async () => {
    if (!aiProposal) return;
    for (const block of aiProposal.proposedBlocks) {
      if (block.taskId) {
        await updateTask(block.taskId, {
          dueDate: today,
          scheduledStart: block.startTime,
          scheduledEnd: block.endTime,
        });
      }
      await createCalendarEvent({
        title: block.title,
        kind: 'timeblock',
        date: today,
        startTime: block.startTime,
        endTime: block.endTime,
        taskId: block.taskId || '',
        category: block.category || 'Planned',
        notes: block.rationale,
        isFixed: false,
      });
    }
    setAiProposal(null);
    showToast('Applied proposed daily schedule');
  };

  const toggleSectionVisibility = (secId: string) => {
    const current = preferences.visibleSections || [];
    const next = current.includes(secId)
      ? current.filter((x) => x !== secId)
      : [...current, secId];
    updatePreferences({ visibleSections: next });
  };

  const isSectionVisible = (secId: string) =>
    (preferences.visibleSections || []).includes(secId);

  // Energy-matched task suggestions
  const energyMatchedTasks = useMemo(() => {
    return tasks
      .filter(
        (t) =>
          !t.completed &&
          !t.archived &&
          (t.energyRequired === preferences.energyLevel || t.energyRequired === 'any')
      )
      .slice(0, 3);
  }, [tasks, preferences.energyLevel]);

  return (
    <div className="space-y-6 pb-8">
      {/* Top Greeting & Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#99A69C]">{formattedDate}</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F0F4F0] mt-0.5">
            {greeting}
          </h1>
        </div>

        {/* Action Strip */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsWhatNowOpen(true)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#B5DDBF] transition-colors whitespace-nowrap shrink-0"
          >
            <Compass className="w-4 h-4" />
            <span>What Should I Do Now?</span>
          </button>

          <button
            onClick={() => startFocusForTask(topPriorityTasks[0]?.id || null)}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#F0F4F0] hover:border-[#79D99A] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Play className="w-3.5 h-3.5 text-[#79D99A]" />
            <span>Focus Timer</span>
          </button>

          <button
            onClick={generateAIDailyPlan}
            disabled={aiPlanLoading}
            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#F0F4F0] hover:border-[#79D99A] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#79D99A]" />
            <span>{aiPlanLoading ? 'Planning...' : 'AI Plan Day'}</span>
          </button>

          <button
            onClick={() => setIsPlanRecoveryOpen(true)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#E8B86D]" />
            <span>Plan Recovery</span>
          </button>

          <button
            onClick={() => setShowCustomizeSections((v) => !v)}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] flex items-center gap-1.5"
            title="Customize Today Dashboard Sections"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Customize Sections Panel */}
      {showCustomizeSections && (
        <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-2.5">
          <p className="text-xs font-semibold text-[#F0F4F0]">
            Customize Visible Dashboard Sections
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'due_today', label: 'Due Today' },
              { id: 'overdue', label: 'Overdue Tasks' },
              { id: 'habits', label: 'Habits for Today' },
              { id: 'projects', label: 'Active Projects' },
              { id: 'ideas', label: 'Recent Ideas' },
              { id: 'deadlines', label: 'Upcoming Deadlines' },
            ].map((sec) => {
              const active = isSectionVisible(sec.id);
              return (
                <button
                  key={sec.id}
                  onClick={() => toggleSectionVisibility(sec.id)}
                  className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                    active
                      ? 'bg-[#79D99A]/15 border-[#79D99A] text-[#79D99A]'
                      : 'bg-[#111713] border-[#29342C] text-[#99A69C]'
                  }`}
                >
                  {sec.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Daily Plan Proposal Review Card */}
      {aiProposal && (
        <div className="p-5 rounded-2xl bg-[#171E19] border border-[#79D99A]/50 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#79D99A] flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Proposed Daily Schedule (Review Before Applying)
              </h2>
              <p className="text-xs text-[#99A69C] mt-0.5">{aiProposal.summary}</p>
            </div>
            <span className="text-[11px] font-mono text-[#99A69C]">
              {aiProposal.aiMeta?.model}
            </span>
          </div>

          {aiProposal.proposedBlocks.length === 0 ? (
            <p className="text-xs text-[#99A69C]">
              No open tasks to time-block for today. Add tasks first and try again.
            </p>
          ) : (
            <div className="space-y-2">
              {aiProposal.proposedBlocks.map((b, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#F0F4F0] truncate">{b.title}</p>
                    <p className="text-[11px] text-[#99A69C]">{b.rationale}</p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#79D99A] shrink-0">
                    {b.startTime}–{b.endTime}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={() => setAiProposal(null)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
            >
              Discard Proposal
            </button>
            {aiProposal.proposedBlocks.length > 0 && (
              <button
                onClick={applyAIProposal}
                className="min-h-[38px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
              >
                Approve & Apply to Today’s Timeline
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Capture Bar */}
      <form
        onSubmit={handleQuickSubmit}
        className="flex items-center gap-2 p-2 rounded-2xl bg-[#171E19] border border-[#29342C]"
      >
        <div className="flex items-center bg-[#111713] rounded-xl p-1 shrink-0">
          <button
            type="button"
            onClick={() => setQuickMode('task')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              quickMode === 'task'
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'text-[#99A69C]'
            }`}
          >
            Task
          </button>
          <button
            type="button"
            onClick={() => setQuickMode('note')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              quickMode === 'note'
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'text-[#99A69C]'
            }`}
          >
            Inbox
          </button>
        </div>

        <input
          type="text"
          value={quickInput}
          onChange={(e) => setQuickInput(e.target.value)}
          placeholder={
            quickMode === 'task'
              ? 'Quick capture a task for today...'
              : 'Capture a quick thought or note to Inbox...'
          }
          className="flex-1 min-w-0 bg-transparent px-2 py-2 text-sm text-[#F0F4F0] placeholder-[#68766D] focus:outline-none"
        />

        <button
          type="submit"
          className="min-h-[40px] px-3.5 rounded-xl bg-[#1D2620] text-[#79D99A] text-xs font-semibold hover:bg-[#79D99A] hover:text-[#0B0F0D] transition-colors flex items-center gap-1 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>

      {/* Today's Progress Stat Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Tasks Done</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
            {completedTodayCount}/{totalTodayCount}
          </p>
          <p className="text-[11px] font-mono tabular-nums text-[#79D99A] mt-0.5">
            {dailyCompletionPct}% complete
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Top Priorities</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
            {topPriorityTasks.filter((t) => t.completed).length}/{topPriorityTasks.length}
          </p>
          <p className="text-[11px] text-[#99A69C] mt-0.5">Max 3 daily</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Scheduled Time</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
            {Math.floor(scheduledMinutesToday / 60)}h {scheduledMinutesToday % 60}m
          </p>
          <p className="text-[11px] text-[#99A69C] mt-0.5">
            {timelineEntries.length} blocks
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Focus Logged</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#79D99A] mt-1">
            {todayFocusMinutes}m
          </p>
          <p className="text-[11px] text-[#99A69C] mt-0.5">Deep work today</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Habits</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#F0F4F0] mt-1">
            {completedHabitsToday}/{activeHabits.length}
          </p>
          <p className="text-[11px] text-[#99A69C] mt-0.5">Daily routines</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
          <p className="text-xs text-[#99A69C]">Daily XP</p>
          <p className="text-xl font-bold font-mono tabular-nums text-[#79D99A] mt-1">
            +{todayXP} XP
          </p>
          <p className="text-[11px] text-[#99A69C] mt-0.5">Personal progress</p>
        </div>
      </div>

      {/* Energy-Aware Planning Strip */}
      <div className="p-4 rounded-2xl bg-[#171E19] border border-[#29342C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-center text-[#79D99A]">
            {preferences.energyLevel === 'low' && <BatteryLow className="w-5 h-5 text-[#E8B86D]" />}
            {preferences.energyLevel === 'moderate' && <BatteryMedium className="w-5 h-5 text-[#79D99A]" />}
            {preferences.energyLevel === 'high' && <BatteryFull className="w-5 h-5 text-[#79D99A]" />}
          </div>
          <div>
            <h2 className="text-xs font-semibold text-[#F0F4F0]">
              Daily Energy Capacity
            </h2>
            <p className="text-xs text-[#99A69C]">
              {preferences.energyLevel === 'high' &&
                'High Energy: Ideal for demanding cognitive work and complex milestones.'}
              {preferences.energyLevel === 'moderate' &&
                'Moderate Energy: Ideal for structured project progress and study blocks.'}
              {preferences.energyLevel === 'low' &&
                'Low Energy: Prioritize lighter admin, organizing notes, and quick wins.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-[#111713] p-1 rounded-xl border border-[#29342C] self-start sm:self-auto">
          {(['low', 'moderate', 'high'] as EnergyLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => updatePreferences({ energyLevel: lvl })}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                preferences.energyLevel === lvl
                  ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                  : 'text-[#99A69C] hover:text-[#F0F4F0]'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Top 3 Priorities + Due Today + Overdue */}
        <div className="lg:col-span-7 space-y-6">
          {/* Top 3 Priorities */}
          <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-[#79D99A]" />
                <h2 className="text-sm font-semibold text-[#F0F4F0]">
                  Top Three Priorities ({topPriorityTasks.length}/3)
                </h2>
              </div>
              <span className="text-xs text-[#99A69C]">
                Pin up to 3 critical tasks
              </span>
            </div>

            {topPriorityTasks.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#111713] border border-[#29342C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-xs text-[#99A69C]">
                  No Top 3 priorities pinned yet. Select up to three tasks to anchor your day.
                </p>
                <button
                  onClick={() => openQuickAdd('task')}
                  className="min-h-[38px] px-3.5 rounded-xl bg-[#1D2620] text-xs font-medium text-[#79D99A] shrink-0"
                >
                  + Create Priority Task
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {topPriorityTasks.map((t, idx) => (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => toggleTaskCompletion(t.id)}
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#79D99A] shrink-0"
                        aria-label={`Complete ${t.title}`}
                      >
                        {t.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-[#79D99A]" />
                        ) : (
                          <Circle className="w-5 h-5 text-[#68766D] hover:text-[#79D99A]" />
                        )}
                      </button>
                      <button
                        onClick={() => setInspectTask(t)}
                        className="text-left min-w-0 flex-1"
                      >
                        <p
                          className={`text-sm font-semibold truncate ${
                            t.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                          }`}
                        >
                          0{idx + 1}. {t.title}
                        </p>
                        <p className="text-xs text-[#99A69C] font-mono tabular-nums truncate">
                          {t.priority} · {t.estimatedMinutes}m est.
                          {t.scheduledStart ? ` · ${t.scheduledStart}–${t.scheduledEnd}` : ''}
                        </p>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => startFocusForTask(t.id)}
                        className="min-h-[36px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1"
                        title="Start Focus Session"
                      >
                        <Play className="w-3 h-3" /> Focus
                      </button>
                      <button
                        onClick={() => toggleTopPriority(t.id)}
                        className="min-h-[36px] px-2 rounded-lg bg-[#171E19] text-xs text-[#99A69C] hover:text-[#F0F4F0]"
                        title="Unpin from Top 3"
                      >
                        Unpin
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Overdue Tasks */}
          {isSectionVisible('overdue') && overdueTasks.length > 0 && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#E87979]/40 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#E87979]">
                  Overdue Tasks ({overdueTasks.length})
                </h2>
                <button
                  onClick={() => setIsPlanRecoveryOpen(true)}
                  className="text-xs font-medium text-[#E8B86D] hover:underline"
                >
                  Recover Plan →
                </button>
              </div>
              <div className="space-y-2">
                {overdueTasks.map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <button
                        onClick={() => toggleTaskCompletion(t.id)}
                        className="text-[#E87979] hover:text-[#79D99A]"
                      >
                        <Circle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setInspectTask(t)}
                        className="text-left min-w-0 flex-1"
                      >
                        <p className="text-sm font-medium text-[#F0F4F0] truncate">
                          {t.title}
                        </p>
                        <p className="text-xs text-[#E87979] font-mono tabular-nums">
                          Due {t.dueDate} · {t.priority}
                        </p>
                      </button>
                    </div>
                    <button
                      onClick={() => updateTask(t.id, { dueDate: today })}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#F0F4F0]"
                    >
                      Move to Today
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Due Today & Unscheduled Tasks */}
          {isSectionVisible('due_today') && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F0F4F0]">
                  Tasks for Today ({dueTodayTasks.length})
                </h2>
                <button
                  onClick={() => openQuickAdd('task')}
                  className="text-xs font-medium text-[#79D99A] hover:underline"
                >
                  + New Task
                </button>
              </div>

              {dueTodayTasks.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#111713] border border-[#29342C] text-center space-y-3">
                  <p className="text-sm font-medium text-[#F0F4F0]">
                    Your schedule for today is clear
                  </p>
                  <p className="text-xs text-[#99A69C] max-w-md mx-auto">
                    Start by adding your top priority task, dumping unstructured thoughts in Brain Dump, or reviewing your active projects.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <button
                      onClick={() => openQuickAdd('task')}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                    >
                      + Add First Task
                    </button>
                    <button
                      onClick={() => setActiveTab('inbox')}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#1D2620] border border-[#29342C] text-xs font-medium text-[#F0F4F0]"
                    >
                      Open Brain Dump
                    </button>
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="min-h-[38px] px-3.5 rounded-xl bg-[#1D2620] border border-[#29342C] text-xs font-medium text-[#99A69C]"
                    >
                      Review Projects
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {dueTodayTasks.map((t) => {
                    const isPinned = preferences.topPriorities.includes(t.id);
                    return (
                      <div
                        key={t.id}
                        className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3 hover:border-[#79D99A]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => toggleTaskCompletion(t.id)}
                            className="min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                          >
                            {t.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-[#79D99A]" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#68766D] hover:text-[#79D99A]" />
                            )}
                          </button>
                          <button
                            onClick={() => setInspectTask(t)}
                            className="text-left min-w-0 flex-1"
                          >
                            <p
                              className={`text-sm font-medium truncate ${
                                t.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                              }`}
                            >
                              {t.title}
                            </p>
                            <p className="text-xs text-[#99A69C] font-mono tabular-nums truncate">
                              {t.category} · {t.priority} · {t.estimatedMinutes}m
                              {t.scheduledStart
                                ? ` · Scheduled ${t.scheduledStart}–${t.scheduledEnd}`
                                : ' · Unscheduled'}
                            </p>
                          </button>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => toggleTopPriority(t.id)}
                            className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center ${
                              isPinned ? 'text-[#E8B86D]' : 'text-[#68766D] hover:text-[#F0F4F0]'
                            }`}
                            title={isPinned ? 'Unpin Priority' : 'Pin to Top 3'}
                          >
                            <Star className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => startFocusForTask(t.id)}
                            className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#79D99A] hover:bg-[#1D2620]"
                            title="Start Focus Session"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Energy-Matched Suggested Next Actions */}
          {energyMatchedTasks.length > 0 && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-[#99A69C]">
                  Matched to Your {preferences.energyLevel.toUpperCase()} Energy
                </h2>
                <button
                  onClick={() => setIsWhatNowOpen(true)}
                  className="text-xs text-[#79D99A] hover:underline"
                >
                  Full Advisor →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {energyMatchedTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setInspectTask(t)}
                    className="p-3 rounded-xl bg-[#111713] border border-[#29342C] text-left hover:border-[#79D99A]/40 transition-colors"
                  >
                    <p className="text-xs font-semibold text-[#F0F4F0] truncate">
                      {t.title}
                    </p>
                    <p className="text-[11px] font-mono tabular-nums text-[#99A69C] mt-1">
                      {t.estimatedMinutes}m · {t.priority}
                    </p>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column (5 cols): Daily Timeline + Habits + Projects + Ideas */}
        <div className="lg:col-span-5 space-y-6">
          {/* Chronological Daily Timeline */}
          <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#79D99A]" />
                <h2 className="text-sm font-semibold text-[#F0F4F0]">
                  Daily Timeline ({timelineEntries.length})
                </h2>
              </div>
              <button
                onClick={() => setActiveTab('planner')}
                className="text-xs text-[#79D99A] hover:underline flex items-center gap-0.5"
              >
                <span>Time Block</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {timelineEntries.length === 0 ? (
              <div className="p-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C] flex items-center justify-between">
                <span>No time-blocked events yet for today.</span>
                <button
                  onClick={() => openQuickAdd('event')}
                  className="text-[#79D99A] font-medium hover:underline"
                >
                  + Add Block
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {timelineEntries.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.taskId) {
                        const found = tasks.find((t) => t.id === item.taskId);
                        if (found) setInspectTask(found);
                      } else {
                        setActiveTab('planner');
                      }
                    }}
                    className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3 cursor-pointer hover:border-[#79D99A]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono tabular-nums text-[#79D99A] shrink-0">
                        {item.startTime}–{item.endTime}
                      </span>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${
                            item.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                          }`}
                        >
                          {item.title}
                        </p>
                        <p className="text-[11px] text-[#99A69C] truncate">
                          {item.category} · {item.isFixed ? 'Fixed Event' : 'Time Block'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unscheduledTodayTasks.length > 0 && (
              <div className="pt-2 border-t border-[#29342C]">
                <p className="text-[11px] text-[#99A69C] mb-1.5">
                  Unscheduled Today ({unscheduledTodayTasks.length}) — tap a task to assign a time slot
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unscheduledTodayTasks.slice(0, 4).map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setInspectTask(u)}
                      className="px-2.5 py-1 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#99A69C] hover:text-[#F0F4F0] truncate max-w-[200px]"
                    >
                      {u.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Habits for Today */}
          {isSectionVisible('habits') && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F0F4F0]">
                  Habits for Today ({completedHabitsToday}/{activeHabits.length})
                </h2>
                <button
                  onClick={() => openQuickAdd('habit')}
                  className="text-xs text-[#79D99A] hover:underline"
                >
                  + Habit
                </button>
              </div>

              {activeHabits.length === 0 ? (
                <p className="text-xs text-[#99A69C] bg-[#111713] border border-[#29342C] rounded-xl p-3">
                  No daily habits configured yet. Add a habit like Reading, Exercise, or Evening Review.
                </p>
              ) : (
                <div className="space-y-2">
                  {activeHabits.map((h) => {
                    const occ = todayHabitOccurrences.find(
                      (o) => o.sourceEntityId === h.id
                    );
                    const status = occ?.occurrenceStatus || 'none';
                    const streak = getHabitStreak(h.id);
                    return (
                      <div
                        key={h.id}
                        className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#F0F4F0] truncate">
                            {h.title}
                          </p>
                          <p className="text-[11px] font-mono tabular-nums text-[#99A69C]">
                            {h.scheduleType} · Streak: {streak}d
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() =>
                              toggleHabitOccurrence(
                                h.id,
                                today,
                                status === 'completed' ? 'none' : 'completed'
                              )
                            }
                            className={`min-h-[34px] px-2.5 rounded-lg text-xs font-medium transition-colors ${
                              status === 'completed'
                                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                                : 'bg-[#1D2620] text-[#F0F4F0]'
                            }`}
                          >
                            {status === 'completed' ? 'Done' : 'Complete'}
                          </button>
                          <button
                            onClick={() =>
                              toggleHabitOccurrence(
                                h.id,
                                today,
                                status === 'skipped' ? 'none' : 'skipped'
                              )
                            }
                            className={`min-h-[34px] px-2 rounded-lg text-xs ${
                              status === 'skipped'
                                ? 'bg-[#E8B86D]/20 text-[#E8B86D]'
                                : 'bg-[#171E19] text-[#99A69C]'
                            }`}
                          >
                            Skip
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Active Projects */}
          {isSectionVisible('projects') && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F0F4F0]">Active Projects</h2>
                <button
                  onClick={() => setActiveTab('projects')}
                  className="text-xs text-[#79D99A] hover:underline"
                >
                  All Projects →
                </button>
              </div>
              {projectsGoals.filter((p) => p.recordType === 'project' && p.status === 'active')
                .length === 0 ? (
                <p className="text-xs text-[#99A69C] bg-[#111713] border border-[#29342C] rounded-xl p-3">
                  No active projects yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {projectsGoals
                    .filter((p) => p.recordType === 'project' && p.status === 'active')
                    .slice(0, 3)
                    .map((proj) => {
                      const pct = getProjectProgress(proj.id);
                      return (
                        <button
                          key={proj.id}
                          onClick={() => setActiveTab('projects')}
                          className="w-full p-3 rounded-xl bg-[#111713] border border-[#29342C] text-left space-y-1.5 hover:border-[#79D99A]/40 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#F0F4F0] truncate">
                              {proj.name}
                            </span>
                            <span className="font-mono tabular-nums text-[#79D99A]">
                              {pct}%
                            </span>
                          </div>
                          <div className="w-full h-1.5 bg-[#1D2620] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#79D99A] origin-left transition-transform"
                              style={{ transform: `scaleX(${pct / 100})` }}
                            />
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </section>
          )}

          {/* Upcoming Deadlines & Recent Ideas */}
          {isSectionVisible('deadlines') && upcomingDeadlines.length > 0 && (
            <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-2.5">
              <h2 className="text-sm font-semibold text-[#F0F4F0] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#79D99A]" />
                Upcoming Deadlines
              </h2>
              <div className="space-y-1.5">
                {upcomingDeadlines.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setInspectTask(t)}
                    className="w-full p-2.5 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between text-xs text-left"
                  >
                    <span className="text-[#F0F4F0] truncate">{t.title}</span>
                    <span className="font-mono tabular-nums text-[#99A69C] shrink-0 ml-2">
                      {t.dueDate}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {isSectionVisible('ideas') &&
            knowledge.filter((k) => k.itemType === 'idea' && !k.archived).length > 0 && (
              <section className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[#F0F4F0]">
                    Recently Captured Ideas
                  </h2>
                  <button
                    onClick={() => setActiveTab('inbox')}
                    className="text-xs text-[#79D99A] hover:underline"
                  >
                    Second Brain →
                  </button>
                </div>
                <div className="space-y-1.5">
                  {knowledge
                    .filter((k) => k.itemType === 'idea' && !k.archived)
                    .slice(0, 3)
                    .map((idea) => (
                      <button
                        key={idea.id}
                        onClick={() => setActiveTab('inbox')}
                        className="w-full p-2.5 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between text-xs text-left"
                      >
                        <span className="text-[#F0F4F0] truncate">{idea.title}</span>
                        <span className="text-[#99A69C] capitalize shrink-0 ml-2">
                          {idea.ideaStatus}
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            )}
        </div>
      </div>

      <TaskDetailModal task={inspectTask} onClose={() => setInspectTask(null)} />
    </div>
  );
};
