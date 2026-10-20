import React from 'react';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { toastMessage, showToast } = useApp();

  if (!toastMessage) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#285E56] text-[#FFFDF7] px-4 py-3 rounded-xl shadow-xl border border-[#B8E4D3]/30 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <CheckCircle2 className="w-5 h-5 text-[#B8E4D3] shrink-0" />
      <p className="text-xs sm:text-sm font-medium flex-1">{toastMessage}</p>
      <button
        onClick={() => showToast('')}
        className="text-white/60 hover:text-white p-1 rounded-md"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
