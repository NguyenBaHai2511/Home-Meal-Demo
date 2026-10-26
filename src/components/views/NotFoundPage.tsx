import React from 'react';
import { useApp } from '../../context/AppContext';
import { Utensils, Home, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const { navigateTo } = useApp();

  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
      <div className="w-20 h-20 rounded-3xl bg-[#F0FFF6] text-[#481620] flex items-center justify-center mx-auto">
        <Utensils className="w-10 h-10" />
      </div>

      <div className="space-y-2">
        <span className="text-sm font-bold text-[#735444] uppercase tracking-wider">Lỗi 404</span>
        <h1 className="text-3xl font-extrabold text-[#333333]">Trang này chưa được bày món!</h1>
        <p className="text-xs sm:text-sm text-[#62625C] leading-relaxed">
          Địa chỉ bạn đang tìm kiếm không tồn tại hoặc đã được chuyển sang thực đơn khác.
        </p>
      </div>

      <div className="flex items-center justify-center gap-3 pt-4">
        <button
          onClick={() => navigateTo('/')}
          className="px-6 py-2.5 bg-[#481620] hover:bg-[#361018] text-white font-bold text-xs sm:text-sm rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <Home className="w-4 h-4 text-[#60D5AE]" />
          <span>Về trang chủ HomeMeal</span>
        </button>
      </div>
    </div>
  );
};
