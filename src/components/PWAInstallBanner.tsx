import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#79D99A] hover:bg-[#1D2620] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        title="Install LifeOS App"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowIOSGuide(true)}
        className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#171E19] border border-[#29342C] text-xs font-medium text-[#99A69C] hover:text-[#F0F4F0] hover:bg-[#1D2620] transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
        title="Add LifeOS to iPhone Home Screen"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#79D99A]" />
        <span className="hidden sm:inline">{isIOS ? 'Add to Home Screen' : 'iPhone App'}</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#171E19] border border-[#29342C] p-6 text-[#F0F4F0] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1D2620] border border-[#29342C] flex items-center justify-center text-[#79D99A]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold">Install on iPhone</h3>
                  <p className="text-xs text-[#99A69C]">Standalone iOS Home Screen App</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#99A69C] hover:text-[#F0F4F0] hover:bg-[#1D2620]"
                aria-label="Close iOS install guide"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-[#99A69C] bg-[#111713] border border-[#29342C] rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-[#79D99A] font-semibold mt-0.5">01.</span>
                <p>
                  Open LifeOS in <strong className="text-[#F0F4F0]">Safari</strong> on your iPhone and tap the{' '}
                  <span className="inline-flex items-center gap-1 text-[#F0F4F0] font-medium">
                    <Share className="w-3.5 h-3.5 text-[#79D99A]" /> Share
                  </span>{' '}
                  button in the bottom toolbar.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-[#79D99A] font-semibold mt-0.5">02.</span>
                <p>
                  Scroll down and tap <strong className="text-[#F0F4F0]">Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="font-mono text-xs text-[#79D99A] font-semibold mt-0.5">03.</span>
                <p>
                  Launch <strong className="text-[#F0F4F0]">LifeOS</strong> from your Home Screen for full-screen standalone mode and cloud sync across your iPhone and computer.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-[#79D99A] text-[#0B0F0D] font-semibold text-sm hover:bg-[#B5DDBF] transition-colors"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl bg-[#1D2620] border border-[#E8B86D]/50 px-3.5 py-2 text-xs font-medium text-[#E8B86D] shadow-lg">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Changes are saved locally and will sync when online.</span>
    </div>
  );
};
