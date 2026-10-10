import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Filter,
} from 'lucide-react';
import { getTodayISO, useLifeOS } from '../context/LifeOSContext';
import { CalendarEvent, Task } from '../types/lifeos';
import { TaskDetailModal } from '../components/QuickAddModal';

export const PlannerView: React.FC = () => {
  const {
    tasks,
    events,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    toggleTaskCompletion,
    updateTask,
    openQuickAdd,
    showToast,
  } = useLifeOS();

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'agenda'>('day');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());
  const [inspectTask, setInspectTask] = useState<Task | null>(null);
  const [taskFilter, setTaskFilter] = useState<
    'unscheduled' | 'today' | 'upcoming' | 'overdue' | 'high_priority' | 'completed'
  >('unscheduled');

  // Time-block modal for scheduling an unscheduled task
  const [schedulingTask, setSchedulingTask] = useState<Task | null>(null);
  const [slotDate, setSlotDate] = useState(getTodayISO());
  const [slotStart, setSlotStart] = useState('09:00');
  const [slotEnd, setSlotEnd] = useState('10:00');

  // Edit CalendarEvent modal
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const shiftDate = (days: number) => {
    const d = new Date(`${selectedDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  // Events & Timeblocks for selectedDate (including recurring matches)
  const eventsForDate = (dateStr: string): CalendarEvent[] => {
    const targetDayOfWeek = new Date(`${dateStr}T12:00:00`).getDay();
    return events
      .filter((e) => {
        if (e.date === dateStr) return true;
        if (e.date > dateStr) return false;
        if (e.recurrence === 'daily') return true;
        if (e.recurrence === 'weekdays') return targetDayOfWeek >= 1 && targetDayOfWeek <= 5;
        if (e.recurrence === 'weekly') {
          const origDay = new Date(`${e.date}T12:00:00`).getDay();
          return origDay === targetDayOfWeek;
        }
        if (e.recurrence === 'monthly') {
          return e.date.slice(8, 10) === dateStr.slice(8, 10);
        }
        return false;
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const dayEvents = useMemo(() => eventsForDate(selectedDate), [events, selectedDate]);

  // Detect overlapping blocks on selectedDate
  const overlappingEventIds = useMemo(() => {
    const ids = new Set<string>();
    const toMins = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(Number);
      return h * 60 + (m || 0);
    };
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const a = dayEvents[i];
        const b = dayEvents[j];
        if (toMins(a.startTime) < toMins(b.endTime) && toMins(a.endTime) > toMins(b.startTime)) {
          ids.add(a.id);
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [dayEvents]);

  // Week dates (7 days around selectedDate)
  const weekDates = useMemo(() => {
    const base = new Date(`${selectedDate}T12:00:00`);
    const day = base.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    base.setDate(base.getDate() + diffToMonday);
    const arr: string[] = [];
    for (let i = 0; i < 7; i++) {
      arr.push(base.toISOString().slice(0, 10));
      base.setDate(base.getDate() + 1);
    }
    return arr;
  }, [selectedDate]);

  // Month grid dates
  const monthDates = useMemo(() => {
    const [y, m] = selectedDate.split('-').map(Number);
    const firstDay = new Date(y, m - 1, 1);
    const lastDay = new Date(y, m, 0);
    const days: string[] = [];
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return { firstWeekday: firstDay.getDay(), days };
  }, [selectedDate]);

  const today = getTodayISO();

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.archived) return false;
      if (taskFilter === 'unscheduled') return !t.completed && !t.scheduledStart;
      if (taskFilter === 'today') return !t.completed && t.dueDate === today;
      if (taskFilter === 'upcoming') return !t.completed && t.dueDate > today;
      if (taskFilter === 'overdue') return !t.completed && t.dueDate && t.dueDate < today;
      if (taskFilter === 'high_priority')
        return !t.completed && (t.priority === 'high' || t.priority === 'urgent');
      if (taskFilter === 'completed') return t.completed;
      return true;
    });
  }, [tasks, taskFilter, today]);

  const handleAssignTimeBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedulingTask) return;
    await updateTask(schedulingTask.id, {
      dueDate: slotDate,
      scheduledStart: slotStart,
      scheduledEnd: slotEnd,
    });
    await createCalendarEvent({
      title: schedulingTask.title,
      kind: 'timeblock',
      date: slotDate,
      startTime: slotStart,
      endTime: slotEnd,
      taskId: schedulingTask.id,
      projectId: schedulingTask.projectId,
      category: schedulingTask.category || 'Time Block',
      isFixed: false,
      completed: schedulingTask.completed,
    });
    setSchedulingTask(null);
    showToast(`Scheduled "${schedulingTask.title}" for ${slotDate} ${slotStart}–${slotEnd}`);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#F0F4F0]">
            Planner & Time Blocking
          </h1>
          <p className="text-xs text-[#99A69C]">
            Schedule tasks into concrete time slots and manage fixed commitments
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#171E19] border border-[#29342C] p-1 rounded-xl">
            {(['day', 'week', 'month', 'agenda'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                  viewMode === m
                    ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                    : 'text-[#99A69C] hover:text-[#F0F4F0]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <button
            onClick={() => openQuickAdd('event')}
            className="min-h-[40px] px-3.5 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Event</span>
          </button>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#171E19] border border-[#29342C]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftDate(viewMode === 'week' ? -7 : viewMode === 'month' ? -30 : -1)}
            className="min-w-[38px] min-h-[38px] rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-center text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value || getTodayISO())}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-mono tabular-nums text-[#F0F4F0]"
          />
          <button
            onClick={() => shiftDate(viewMode === 'week' ? 7 : viewMode === 'month' ? 30 : 1)}
            className="min-w-[38px] min-h-[38px] rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-center text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setSelectedDate(getTodayISO())}
          className="min-h-[36px] px-3 rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#79D99A]"
        >
          Today
        </button>
      </div>

      {/* Main Split: Calendar View (7 cols) + Task Queue & Unscheduled Tasks (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          {overlappingEventIds.size > 0 && viewMode === 'day' && (
            <div className="p-3.5 rounded-xl bg-[#E8B86D]/10 border border-[#E8B86D]/40 flex items-center gap-2.5 text-xs text-[#E8B86D]">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Schedule Overlap Detected: {overlappingEventIds.size} entries on {selectedDate} share overlapping times. Tap an entry to reschedule.
              </span>
            </div>
          )}

          {/* DAY VIEW */}
          {viewMode === 'day' && (
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-[#F0F4F0] font-mono tabular-nums">
                  Schedule for {selectedDate}
                </h2>
                <span className="text-xs text-[#99A69C]">
                  {dayEvents.length} scheduled blocks
                </span>
              </div>

              {dayEvents.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#111713] border border-[#29342C] text-center space-y-2">
                  <CalendarIcon className="w-6 h-6 text-[#68766D] mx-auto" />
                  <p className="text-sm font-medium text-[#F0F4F0]">
                    No blocks scheduled for {selectedDate}
                  </p>
                  <p className="text-xs text-[#99A69C]">
                    Assign an unscheduled task from the queue or create a calendar event.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {dayEvents.map((ev) => {
                    const isConflict = overlappingEventIds.has(ev.id);
                    return (
                      <div
                        key={ev.id}
                        className={`p-3.5 rounded-xl bg-[#111713] border transition-colors flex items-center justify-between gap-3 ${
                          isConflict
                            ? 'border-[#E8B86D]'
                            : ev.isFixed
                            ? 'border-[#29342C]'
                            : 'border-[#79D99A]/30'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            onClick={() =>
                              updateCalendarEvent(ev.id, { completed: !ev.completed })
                            }
                            className="text-[#79D99A] shrink-0"
                          >
                            {ev.completed ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Circle className="w-5 h-5 text-[#68766D]" />
                            )}
                          </button>
                          <div
                            onClick={() => setEditingEvent(ev)}
                            className="min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono tabular-nums text-[#79D99A] font-semibold">
                                {ev.startTime}–{ev.endTime}
                              </span>
                              <span className="text-xs text-[#99A69C]">
                                · {ev.isFixed ? 'Fixed Event' : 'Flexible Task Block'}
                                {ev.recurrence !== 'none' ? ` · ${ev.recurrence}` : ''}
                              </span>
                            </div>
                            <p
                              className={`text-sm font-semibold truncate mt-0.5 ${
                                ev.completed ? 'line-through text-[#68766D]' : 'text-[#F0F4F0]'
                              }`}
                            >
                              {ev.title}
                            </p>
                            {ev.notes && (
                              <p className="text-xs text-[#99A69C] truncate">{ev.notes}</p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setEditingEvent(ev)}
                            className="min-h-[34px] px-2.5 rounded-lg bg-[#1D2620] text-xs text-[#F0F4F0]"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteCalendarEvent(ev.id)}
                            className="min-w-[34px] min-h-[34px] rounded-lg bg-[#171E19] text-[#E87979] flex items-center justify-center"
                            title="Delete block"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === 'week' && (
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Week Overview ({weekDates[0]} to {weekDates[6]})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
                {weekDates.map((dStr) => {
                  const evs = eventsForDate(dStr);
                  const dayTasks = tasks.filter((t) => t.dueDate === dStr && !t.archived);
                  const isSelected = dStr === selectedDate;
                  return (
                    <div
                      key={dStr}
                      onClick={() => {
                        setSelectedDate(dStr);
                        setViewMode('day');
                      }}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-colors min-h-[110px] ${
                        isSelected
                          ? 'bg-[#1D2620] border-[#79D99A]'
                          : 'bg-[#111713] border-[#29342C] hover:border-[#79D99A]/40'
                      }`}
                    >
                      <p className="text-xs font-mono tabular-nums font-semibold text-[#F0F4F0] mb-1.5">
                        {dStr.slice(5)}
                      </p>
                      <div className="space-y-1">
                        {evs.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="text-[11px] text-[#79D99A] truncate font-mono tabular-nums"
                          >
                            {e.startTime} {e.title}
                          </div>
                        ))}
                        {dayTasks.slice(0, 2).map((t) => (
                          <div key={t.id} className="text-[11px] text-[#99A69C] truncate">
                            • {t.title}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === 'month' && (
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <h2 className="text-sm font-semibold text-[#F0F4F0] font-mono">
                Month View · {selectedDate.slice(0, 7)}
              </h2>
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs text-[#99A69C] pb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: monthDates.firstWeekday }).map((_, idx) => (
                  <div key={`pad_${idx}`} className="h-14 rounded-lg bg-transparent" />
                ))}
                {monthDates.days.map((dStr) => {
                  const count =
                    events.filter((e) => e.date === dStr).length +
                    tasks.filter((t) => t.dueDate === dStr && !t.archived).length;
                  const isToday = dStr === today;
                  const isSelected = dStr === selectedDate;
                  return (
                    <button
                      key={dStr}
                      onClick={() => {
                        setSelectedDate(dStr);
                        setViewMode('day');
                      }}
                      className={`h-14 rounded-xl border p-1.5 flex flex-col items-start justify-between transition-colors ${
                        isSelected
                          ? 'bg-[#1D2620] border-[#79D99A]'
                          : isToday
                          ? 'bg-[#111713] border-[#79D99A]/50'
                          : 'bg-[#111713] border-[#29342C]'
                      }`}
                    >
                      <span className="text-xs font-mono tabular-nums text-[#F0F4F0]">
                        {dStr.slice(8)}
                      </span>
                      {count > 0 && (
                        <span className="text-[10px] font-mono tabular-nums text-[#79D99A]">
                          {count} items
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AGENDA VIEW */}
          {viewMode === 'agenda' && (
            <div className="p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-3">
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Upcoming Agenda (All Scheduled Events & Blocks)
              </h2>
              {events.length === 0 ? (
                <p className="text-xs text-[#99A69C] p-4 bg-[#111713] rounded-xl">
                  No upcoming events in agenda.
                </p>
              ) : (
                <div className="space-y-2">
                  {[...events]
                    .sort((a, b) =>
                      `${a.date}_${a.startTime}`.localeCompare(`${b.date}_${b.startTime}`)
                    )
                    .map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setEditingEvent(ev)}
                        className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div>
                          <p className="text-sm font-medium text-[#F0F4F0]">{ev.title}</p>
                          <p className="text-xs text-[#99A69C] font-mono tabular-nums">
                            {ev.date} · {ev.startTime}–{ev.endTime} ·{' '}
                            {ev.isFixed ? 'Fixed' : 'Time Block'}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCalendarEvent(ev.id);
                          }}
                          className="text-[#99A69C] hover:text-[#E87979] p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Unscheduled & Filtered Task Queue */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-[#171E19] border border-[#29342C] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#79D99A]" />
              <h2 className="text-sm font-semibold text-[#F0F4F0]">
                Task Queue ({filteredTasks.length})
              </h2>
            </div>
            <button
              onClick={() => openQuickAdd('task')}
              className="text-xs font-medium text-[#79D99A] hover:underline"
            >
              + New Task
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {(
              [
                { id: 'unscheduled', label: 'Unscheduled' },
                { id: 'today', label: 'Today' },
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'high_priority', label: 'High Priority' },
                { id: 'completed', label: 'Completed' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                onClick={() => setTaskFilter(f.id)}
                className={`min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  taskFilter === f.id
                    ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                    : 'bg-[#111713] text-[#99A69C] hover:text-[#F0F4F0]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTasks.length === 0 ? (
            <div className="p-6 rounded-xl bg-[#111713] border border-[#29342C] text-center text-xs text-[#99A69C]">
              No tasks in "{taskFilter.replace('_', ' ')}" filter.
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredTasks.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-[#111713] border border-[#29342C] flex items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <button
                      onClick={() => toggleTaskCompletion(t.id)}
                      className="text-[#79D99A] shrink-0"
                    >
                      {t.completed ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4 text-[#68766D]" />
                      )}
                    </button>
                    <button
                      onClick={() => setInspectTask(t)}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="text-xs font-semibold text-[#F0F4F0] truncate">
                        {t.title}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-[#99A69C] truncate">
                        {t.priority} · {t.estimatedMinutes}m · {t.dueDate || 'No date'}
                      </p>
                    </button>
                  </div>

                  {!t.completed && (
                    <button
                      onClick={() => {
                        setSchedulingTask(t);
                        setSlotDate(selectedDate);
                        setSlotStart(t.scheduledStart || '10:00');
                        setSlotEnd(t.scheduledEnd || '11:00');
                      }}
                      className="min-h-[34px] px-2.5 rounded-lg bg-[#1D2620] text-xs font-medium text-[#79D99A] flex items-center gap-1 shrink-0"
                    >
                      <Clock className="w-3 h-3" />
                      <span>Block Time</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Assign Time Block Modal */}
      {schedulingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171E19] border border-[#29342C] p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#F0F4F0]">
              Assign Time Block: {schedulingTask.title}
            </h3>
            <form onSubmit={handleAssignTimeBlock} className="space-y-3">
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Date</label>
                <input
                  type="date"
                  value={slotDate}
                  onChange={(e) => setSlotDate(e.target.value)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-[#99A69C] mb-1">Start Time</label>
                  <input
                    type="time"
                    value={slotStart}
                    onChange={(e) => setSlotStart(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#99A69C] mb-1">End Time</label>
                  <input
                    type="time"
                    value={slotEnd}
                    onChange={(e) => setSlotEnd(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSchedulingTask(null)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                >
                  Save Time Block
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Calendar Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#171E19] border border-[#29342C] p-5 space-y-4">
            <h3 className="text-base font-semibold text-[#F0F4F0]">
              Edit Schedule Block
            </h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await updateCalendarEvent(editingEvent.id, editingEvent);
                setEditingEvent(null);
                showToast('Updated schedule block');
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-[#99A69C] mb-1">Title</label>
                <input
                  type="text"
                  value={editingEvent.title}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, title: e.target.value })
                  }
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-[#99A69C] mb-1">Date</label>
                  <input
                    type="date"
                    value={editingEvent.date}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, date: e.target.value })
                    }
                    className="w-full min-h-[40px] px-2 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#99A69C] mb-1">Start</label>
                  <input
                    type="time"
                    value={editingEvent.startTime}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, startTime: e.target.value })
                    }
                    className="w-full min-h-[40px] px-2 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[#99A69C] mb-1">End</label>
                  <input
                    type="time"
                    value={editingEvent.endTime}
                    onChange={(e) =>
                      setEditingEvent({ ...editingEvent, endTime: e.target.value })
                    }
                    className="w-full min-h-[40px] px-2 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] font-mono"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#99A69C] pt-1">
                <input
                  type="checkbox"
                  checked={editingEvent.isFixed}
                  onChange={(e) =>
                    setEditingEvent({ ...editingEvent, isFixed: e.target.checked })
                  }
                  className="accent-[#79D99A]"
                />
                <span>Fixed Appointment (Protected during Plan Recovery)</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <TaskDetailModal task={inspectTask} onClose={() => setInspectTask(null)} />
    </div>
  );
};
