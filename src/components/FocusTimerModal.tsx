import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2, X, Clock, Coffee } from 'lucide-react';
import { useLifeOS } from '../context/LifeOSContext';

export const FocusTimerModal: React.FC = () => {
  const {
    isFocusModalOpen,
    setIsFocusModalOpen,
    activeFocusTaskId,
    tasks,
    preferences,
    recordFocusSession,
    habitsLogs,
  } = useLifeOS();

  const [selectedTaskId, setSelectedTaskId] = useState<string>(activeFocusTaskId || '');
  const [mode, setMode] = useState<'focus' | 'short_break' | 'long_break'>('focus');
  const [customMinutes, setCustomMinutes] = useState<number>(preferences.focusDuration || 50);
  const [secondsLeft, setSecondsLeft] = useState<number>((preferences.focusDuration || 50) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    if (activeFocusTaskId) {
      setSelectedTaskId(activeFocusTaskId);
    }
  }, [activeFocusTaskId]);

  const applyPreset = (newMode: 'focus' | 'short_break' | 'long_break', mins: number) => {
    setIsRunning(false);
    setSessionFinished(false);
    setMode(newMode);
    setCustomMinutes(mins);
    setSecondsLeft(mins * 60);
    setElapsedSeconds(0);
    lastTickRef.current = null;
  };

  useEffect(() => {
    if (!isRunning) {
      lastTickRef.current = null;
      return;
    }
    lastTickRef.current = Date.now();
    const interval = window.setInterval(() => {
      const now = Date.now();
      const delta = lastTickRef.current ? Math.max(1, Math.round((now - lastTickRef.current) / 1000)) : 1;
      lastTickRef.current = now;

      setSecondsLeft((prev) => {
        if (prev <= delta) {
          setIsRunning(false);
          setSessionFinished(true);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('LifeOS Focus Session Complete', {
              body: mode === 'focus' ? 'Time for a restorative break.' : 'Break finished. Ready to focus?',
            });
          }
          return 0;
        }
        return prev - delta;
      });
      if (mode === 'focus') {
        setElapsedSeconds((prev) => prev + delta);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isRunning, mode]);

  if (!isFocusModalOpen) return null;

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const totalSeconds = Math.max(1, customMinutes * 60);
  const progressPct = Math.min(100, Math.round(((totalSeconds - secondsLeft) / totalSeconds) * 100));

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  const handleFinishEarlyOrLog = async () => {
    const minsWorked = Math.max(1, Math.round(elapsedSeconds / 60) || customMinutes);
    await recordFocusSession(
      selectedTask?.id || '',
      selectedTask?.title || 'Deep Work Session',
      minsWorked
    );
    setIsRunning(false);
    setSessionFinished(false);
    setElapsedSeconds(0);
    setSecondsLeft(customMinutes * 60);
  };

  const recentSessions = habitsLogs
    .filter((h) => h.logType === 'focus_session')
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#171E19] border border-[#29342C] p-6 text-[#F0F4F0] shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#79D99A]" />
            <h2 className="text-base font-semibold">Focus Timer</h2>
          </div>
          <button
            onClick={() => setIsFocusModalOpen(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5 mb-5">
          <button
            type="button"
            onClick={() => applyPreset('focus', preferences.focusDuration || 50)}
            className={`min-h-[38px] rounded-xl text-xs font-medium transition-colors ${
              mode === 'focus' && customMinutes === (preferences.focusDuration || 50)
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'bg-[#111713] border border-[#29342C] text-[#99A69C]'
            }`}
          >
            {preferences.focusDuration || 50}m Deep
          </button>
          <button
            type="button"
            onClick={() => applyPreset('focus', 25)}
            className={`min-h-[38px] rounded-xl text-xs font-medium transition-colors ${
              mode === 'focus' && customMinutes === 25
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'bg-[#111713] border border-[#29342C] text-[#99A69C]'
            }`}
          >
            25m Pomo
          </button>
          <button
            type="button"
            onClick={() => applyPreset('short_break', preferences.shortBreakDuration || 10)}
            className={`min-h-[38px] rounded-xl text-xs font-medium transition-colors ${
              mode === 'short_break'
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'bg-[#111713] border border-[#29342C] text-[#99A69C]'
            }`}
          >
            {preferences.shortBreakDuration || 10}m Break
          </button>
          <button
            type="button"
            onClick={() => applyPreset('long_break', preferences.longBreakDuration || 20)}
            className={`min-h-[38px] rounded-xl text-xs font-medium transition-colors ${
              mode === 'long_break'
                ? 'bg-[#79D99A] text-[#0B0F0D] font-semibold'
                : 'bg-[#111713] border border-[#29342C] text-[#99A69C]'
            }`}
          >
            {preferences.longBreakDuration || 20}m Rest
          </button>
        </div>

        {/* Linked Task Selector */}
        <div className="mb-5">
          <label className="block text-xs text-[#99A69C] mb-1">Associated Task</label>
          <select
            value={selectedTaskId}
            onChange={(e) => setSelectedTaskId(e.target.value)}
            className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
          >
            <option value="">Unlinked Deep Work Session</option>
            {tasks
              .filter((t) => !t.completed)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.estimatedMinutes}m est.)
                </option>
              ))}
          </select>
        </div>

        {/* Circular Timer Display */}
        <div className="flex flex-col items-center justify-center py-6 bg-[#111713] border border-[#29342C] rounded-2xl mb-5">
          <div className="text-5xl font-bold font-mono tabular-nums tracking-tight text-[#F0F4F0] mb-2">
            {mm}:{ss}
          </div>
          <p className="text-xs text-[#99A69C] mb-4 px-4 text-center truncate max-w-full">
            {selectedTask ? selectedTask.title : mode === 'focus' ? 'Deep Focus Session' : 'Restorative Break'}
          </p>
          <div className="w-48 h-1.5 bg-[#1D2620] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#79D99A] transition-transform duration-200 origin-left"
              style={{ transform: `scaleX(${progressPct / 100})` }}
            />
          </div>
        </div>

        {/* Post-Session Completion Prompt */}
        {sessionFinished ? (
          <div className="space-y-2.5 mb-5 p-4 rounded-xl bg-[#1D2620] border border-[#79D99A]/40">
            <p className="text-xs font-semibold text-[#79D99A]">
              Session Completed! Note: Finishing a timer does not automatically mark your task done.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleFinishEarlyOrLog();
                  applyPreset('short_break', preferences.shortBreakDuration || 10);
                }}
                className="min-h-[42px] rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Coffee className="w-3.5 h-3.5" /> Log & Take Break
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleFinishEarlyOrLog();
                  applyPreset('focus', preferences.focusDuration || 50);
                }}
                className="min-h-[42px] rounded-xl bg-[#111713] border border-[#29342C] text-xs font-medium text-[#F0F4F0]"
              >
                Log & Another Session
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 mb-5">
            <button
              type="button"
              onClick={() => {
                if ('Notification' in window && Notification.permission === 'default') {
                  Notification.requestPermission();
                }
                setIsRunning((prev) => !prev);
              }}
              className="flex-1 min-h-[46px] rounded-xl bg-[#79D99A] text-[#0B0F0D] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#B5DDBF] transition-colors"
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? 'Pause' : elapsedSeconds > 0 ? 'Resume' : 'Start Focus'}</span>
            </button>

            {mode === 'focus' && elapsedSeconds >= 30 && (
              <button
                type="button"
                onClick={handleFinishEarlyOrLog}
                className="min-h-[46px] px-4 rounded-xl bg-[#1D2620] border border-[#79D99A]/40 text-xs font-semibold text-[#79D99A] flex items-center gap-1.5"
                title="Finish and log elapsed focus time"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finish & Log</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => applyPreset(mode, customMinutes)}
              className="min-w-[46px] min-h-[46px] rounded-xl bg-[#111713] border border-[#29342C] text-[#99A69C] hover:text-[#F0F4F0] flex items-center justify-center"
              title="Reset / Cancel Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Recent Focus History */}
        {recentSessions.length > 0 && (
          <div className="border-t border-[#29342C] pt-4">
            <h3 className="text-xs font-medium text-[#99A69C] mb-2">Recent Focus Sessions</h3>
            <div className="space-y-1.5">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-[#111713]"
                >
                  <span className="truncate text-[#F0F4F0]">{s.title}</span>
                  <span className="font-mono tabular-nums text-[#79D99A] shrink-0 ml-2">
                    {s.durationMinutes}m · {s.date}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
