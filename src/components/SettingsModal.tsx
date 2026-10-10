import React, { useEffect, useState } from 'react';
import {
  Settings,
  X,
  Cloud,
  Download,
  Upload,
  Trash2,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  LogIn,
} from 'lucide-react';
import { useLifeOS } from '../context/LifeOSContext';

export const SettingsModal: React.FC = () => {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    preferences,
    updatePreferences,
    user,
    syncStatus,
    loginWithGoogle,
    logout,
    syncLocalToCloud,
    exportFullJSON,
    exportTasksCSV,
    importBackupJSON,
    clearAllData,
    showToast,
  } = useLifeOS();

  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    primaryModel: string;
    thinkingLevel: string;
    message: string;
  } | null>(null);

  const [importText, setImportText] = useState('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      fetch('/api/ai/status')
        .then((r) => r.json())
        .then((d) => setAiStatus(d))
        .catch(() =>
          setAiStatus({
            configured: false,
            primaryModel: 'gemini-3.1-pro-preview',
            thinkingLevel: 'HIGH',
            message: 'Offline — using deterministic local planning engine.',
          })
        );
    }
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleDownloadJSON = () => {
    const data = exportFullJSON();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded full JSON backup');
  };

  const handleDownloadCSV = () => {
    const csv = exportTasksCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded Tasks CSV export');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    try {
      await importBackupJSON(importText, importMode);
      setImportText('');
      setConfirmRestore(false);
    } catch (err: any) {
      showToast(err?.message || 'Invalid backup JSON file');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-[#171E19] border border-[#29342C] p-5 sm:p-6 text-[#F0F4F0] shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        <div className="flex items-center justify-between pb-3 border-b border-[#29342C]">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-[#79D99A]" />
            <div>
              <h2 className="text-base font-semibold">Settings & Personalization</h2>
              <p className="text-xs text-[#99A69C]">Cloud sync, preferences, AI status & data backup</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1. Cloud Account & Real-time Sync */}
        <section className="p-4 rounded-2xl bg-[#111713] border border-[#29342C] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cloud className="w-4 h-4 text-[#79D99A]" />
              <h3 className="text-sm font-semibold">Cross-Device Cloud Synchronization (iPhone & Desktop)</h3>
            </div>
            <span className="text-xs font-mono text-[#79D99A] capitalize">
              Status: {syncStatus}
            </span>
          </div>

          {user ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-[#99A69C]">
                Signed in as <strong className="text-[#F0F4F0]">{user.email || user.displayName}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={syncLocalToCloud}
                  className="min-h-[38px] px-3 rounded-xl bg-[#1D2620] border border-[#79D99A]/40 text-xs font-medium text-[#79D99A] flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Sync All Now
                </button>
                <button
                  onClick={logout}
                  className="min-h-[38px] px-3 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] flex items-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-[#99A69C] flex-1">
                Sign in with your Google account to synchronize tasks, Second Brain notes, projects, habits, and calendar blocks across your iPhone and computer.
              </p>
              <button
                onClick={loginWithGoogle}
                className="min-h-[40px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" /> Sign In with Google
              </button>
            </div>
          )}
        </section>

        {/* 2. Preferences & Working Hours */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold text-[#99A69C]">Schedule, Focus & Display Preferences</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Theme</label>
              <select
                value={preferences.theme}
                onChange={(e) =>
                  updatePreferences({ theme: e.target.value as 'dark' | 'light' })
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="dark">Dark Forest (Default)</option>
                <option value="light">Daylight Minimal</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Work Start</label>
              <input
                type="time"
                value={preferences.workStartHour}
                onChange={(e) => updatePreferences({ workStartHour: e.target.value })}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Work End</label>
              <input
                type="time"
                value={preferences.workEndHour}
                onChange={(e) => updatePreferences({ workEndHour: e.target.value })}
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Focus Duration (m)</label>
              <input
                type="number"
                min={5}
                max={240}
                value={preferences.focusDuration}
                onChange={(e) =>
                  updatePreferences({ focusDuration: Number(e.target.value) || 50 })
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Short Break (m)</label>
              <input
                type="number"
                min={1}
                max={60}
                value={preferences.shortBreakDuration}
                onChange={(e) =>
                  updatePreferences({ shortBreakDuration: Number(e.target.value) || 10 })
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0] tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs text-[#99A69C] mb-1">Week Starts On</label>
              <select
                value={preferences.weekStartsOn}
                onChange={(e) =>
                  updatePreferences({ weekStartsOn: e.target.value as 'monday' | 'sunday' })
                }
                className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-[#111713] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="monday">Monday</option>
                <option value="sunday">Sunday</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111713] border border-[#29342C] cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#F0F4F0]">Personal Progress (RPG XP & Levels)</p>
                <p className="text-[11px] text-[#99A69C]">Earn XP for tasks, focus sessions & habits</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.gamificationEnabled}
                onChange={(e) => updatePreferences({ gamificationEnabled: e.target.checked })}
                className="accent-[#79D99A] w-4 h-4"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-[#111713] border border-[#29342C] cursor-pointer">
              <div>
                <p className="text-xs font-medium text-[#F0F4F0]">Browser Reminders & Notifications</p>
                <p className="text-[11px] text-[#99A69C]">Notify when focus sessions or deadlines hit</p>
              </div>
              <input
                type="checkbox"
                checked={preferences.remindersEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  if (enabled && 'Notification' in window) {
                    Notification.requestPermission();
                  }
                  updatePreferences({ remindersEnabled: enabled });
                }}
                className="accent-[#79D99A] w-4 h-4"
              />
            </label>
          </div>
        </section>

        {/* 3. AI Assistant Configuration Status */}
        <section className="p-4 rounded-2xl bg-[#111713] border border-[#29342C] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#79D99A]" />
              <h3 className="text-xs font-semibold">AI Planning Assistant Status</h3>
            </div>
            <span className="text-xs font-mono text-[#79D99A] flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {aiStatus?.configured ? `${aiStatus.primaryModel} (Thinking: ${aiStatus.thinkingLevel})` : 'Local Engine Fallback'}
            </span>
          </div>
          <p className="text-xs text-[#99A69C]">
            {aiStatus?.message ||
              'Server-side Gemini API integration with automatic deterministic fallback when offline.'}
          </p>
        </section>

        {/* 4. Data Export, Backup & Restore */}
        <section className="p-4 rounded-2xl bg-[#111713] border border-[#29342C] space-y-4">
          <h3 className="text-xs font-semibold text-[#99A69C]">Data Export, Backup & Restoration</h3>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={handleDownloadJSON}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#1D2620] border border-[#29342C] text-xs font-medium text-[#F0F4F0] hover:border-[#79D99A] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#79D99A]" /> Export Full Backup (JSON)
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#1D2620] border border-[#29342C] text-xs font-medium text-[#F0F4F0] hover:border-[#79D99A] flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-[#79D99A]" /> Export Tasks (CSV)
            </button>
          </div>

          <div className="pt-2 border-t border-[#29342C] space-y-2.5">
            <label className="block text-xs text-[#99A69C]">Restore from JSON Backup File</label>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileUpload}
                className="text-xs text-[#99A69C] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[#1D2620] file:text-[#79D99A]"
              />
              <select
                value={importMode}
                onChange={(e) => setImportMode(e.target.value as 'merge' | 'replace')}
                className="min-h-[36px] px-2.5 rounded-lg bg-[#171E19] border border-[#29342C] text-xs text-[#F0F4F0]"
              >
                <option value="merge">Merge (Deduplicate by ID)</option>
                <option value="replace">Replace All Current Records</option>
              </select>
            </div>

            {importText && !confirmRestore && (
              <button
                type="button"
                onClick={() => setConfirmRestore(true)}
                className="min-h-[38px] px-4 rounded-xl bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" /> Review & Restore Backup
              </button>
            )}

            {confirmRestore && (
              <div className="p-3 rounded-xl bg-[#171E19] border border-[#E8B86D]/50 space-y-2">
                <p className="text-xs text-[#E8B86D]">
                  Confirm Backup Restore: Mode is set to <strong>{importMode.toUpperCase()}</strong>.{' '}
                  {importMode === 'replace'
                    ? 'This will overwrite your current local records with the backup file.'
                    : 'Existing records with matching IDs will be updated and new records added.'}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={executeImport}
                    className="min-h-[36px] px-3.5 rounded-lg bg-[#79D99A] text-[#0B0F0D] text-xs font-semibold"
                  >
                    Confirm Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmRestore(false)}
                    className="min-h-[36px] px-3.5 rounded-lg bg-[#111713] border border-[#29342C] text-xs text-[#99A69C]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 5. Danger Zone */}
        <section className="p-4 rounded-2xl bg-[#111713] border border-[#E87979]/30 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-semibold text-[#E87979] flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Reset & Clear Data
            </h3>
            <p className="text-xs text-[#99A69C]">
              Permanently remove all tasks, notes, projects, and logs.
            </p>
          </div>

          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#E87979]/15 border border-[#E87979]/40 text-xs font-medium text-[#E87979] flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await clearAllData();
                  setConfirmClear(false);
                }}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#E87979] text-[#0B0F0D] text-xs font-semibold"
              >
                Confirm Permanent Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="min-h-[38px] px-3 rounded-xl bg-[#171E19] border border-[#29342C] text-xs text-[#99A69C]"
              >
                Cancel
              </button>
            </div>
          )}
        </section>

        <div className="text-center text-[11px] text-[#68766D] pt-1">
          LifeOS v1.0.0 · Personal Operating System · Offline-First PWA + Firestore Cloud Sync
        </div>
      </div>
    </div>
  );
};
