import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Cook } from '../../types';
import { formatVND } from '../../utils/pricing';
import { Star, MapPin, Users, ChefHat, CheckCircle2, Search, Filter } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';

export const CooksPage: React.FC = () => {
  const { cooks, navigateTo, updateDraftOrder } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('all');
  const [selectedCapacity, setSelectedCapacity] = useState('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');

  // Filtered cooks
  const filteredCooks = cooks.filter((cook) => {
    if (selectedArea !== 'all' && !cook.serviceAreas.some((a) => a.includes(selectedArea))) return false;
    if (selectedCapacity === 'small' && cook.maxGuests > 15) return false;
    if (selectedCapacity === 'large' && cook.maxGuests < 25) return false;
    if (selectedSpecialty !== 'all' && !cook.specialties.some((s) => s.toLowerCase().includes(selectedSpecialty.toLowerCase()))) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = cook.name.toLowerCase().includes(q);
      const matchBio = cook.bio.toLowerCase().includes(q);
      const matchSpec = cook.specialties.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchBio && !matchSpec) return false;
    }
    return true;
  });

  const handleSelectCookForOrder = (cook: Cook) => {
    updateDraftOrder({ cookId: cook.id });
    navigateTo('/meal-planner');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E5ECE7]">
        <span className="text-xs font-bold text-[#285E56] uppercase tracking-wider">Đội ngũ tay nghề</span>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#263B35]">Đầu bếp gia đình & Chuyên gia nấu tiệc</h1>
        <p className="text-xs sm:text-sm text-[#738078] mt-1">
          100% đầu bếp được kiểm tra lý lịch, chứng chỉ vệ sinh an toàn thực phẩm và cam kết minh bạch chứng từ mua sắm tại chợ.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5ECE7] space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-[#738078] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc sở trường..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56]"
            />
          </div>

          <div>
            <select
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#285E56]"
            >
              <option value="all">Mọi khu vực phục vụ</option>
              <option value="Quận 1">Quận 1 & Trung tâm</option>
              <option value="Bình Thạnh">Bình Thạnh & Phú Nhuận</option>
              <option value="Quận 7">Quận 7 & Nhà Bè</option>
              <option value="Thủ Đức">TP. Thủ Đức & Quận 2, 9</option>
            </select>
          </div>

          <div>
            <select
              value={selectedCapacity}
              onChange={(e) => setSelectedCapacity(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#285E56]"
            >
              <option value="all">Mọi quy mô khách</option>
              <option value="small">Bữa ăn gia đình (dưới 15 khách)</option>
              <option value="large">Đại tiệc / Cỗ lớn (trên 25 khách)</option>
            </select>
          </div>

          <div>
            <select
              value={selectedSpecialty}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="w-full px-3 py-2 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#285E56]"
            >
              <option value="all">Mọi sở trường ẩm thực</option>
              <option value="canh chua">Món cơm Nam Bộ & Canh chua</option>
              <option value="hải sản">Hải sản tươi sống & BBQ</option>
              <option value="món bắc">Món Bắc & Ăn kiêng thanh đạm</option>
              <option value="cỗ">Cỗ giỗ chạp truyền thống</option>
            </select>
          </div>
        </div>
      </div>

      {/* Cooks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCooks.map((cook) => (
          <div
            key={cook.id}
            className="bg-white rounded-2xl border border-[#E5ECE7] p-6 hover:shadow-lg transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start gap-4 mb-4">
                <div className="w-18 h-18 rounded-2xl overflow-hidden border-2 border-[#B8E4D3] shrink-0 bg-stone-100">
                  <ImageWithFallback
                    src={cook.avatar}
                    alt={cook.name}
                    fallbackType="cook"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-lg text-[#263B35]">{cook.name}</h3>
                    {cook.verified && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-semibold border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Đã kiểm định
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#738078] font-medium mt-0.5">{cook.title}</p>
                  
                  <div className="flex items-center gap-3 text-xs text-[#738078] mt-1.5">
                    <div className="flex items-center gap-1 text-[#285E56] font-bold">
                      <Star className="w-3.5 h-3.5 fill-[#F2AD72] text-[#F2AD72]" />
                      <span>{cook.rating}</span>
                      <span className="text-[#738078] font-normal">({cook.reviewCount} đánh giá)</span>
                    </div>
                    <span>·</span>
                    <span>{cook.experienceYears} năm kinh nghiệm</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#738078] leading-relaxed line-clamp-3 mb-4">
                "{cook.bio}"
              </p>

              <div className="space-y-2 text-xs py-3 border-t border-[#E5ECE7] bg-[#FFFDF7] p-3 rounded-xl border">
                <div className="flex items-center gap-2 text-[#263B35]">
                  <MapPin className="w-3.5 h-3.5 text-[#285E56] shrink-0" />
                  <span>Khu vực nhận nấu: <strong>{cook.serviceAreas.join(', ')}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-[#263B35]">
                  <Users className="w-3.5 h-3.5 text-[#285E56] shrink-0" />
                  <span>Quy mô tối đa: <strong>{cook.maxGuests} khách</strong> (Có hỗ trợ phụ bếp cho tiệc lớn)</span>
                </div>
                <div className="flex items-start gap-2 text-[#263B35]">
                  <ChefHat className="w-3.5 h-3.5 text-[#285E56] shrink-0 mt-0.5" />
                  <span>Sở trường: <strong>{cook.specialties.join(', ')}</strong></span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-[#E5ECE7] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[#738078] block">Công nấu khởi điểm:</span>
                <span className="text-base font-bold text-[#285E56]">{formatVND(cook.baseLaborFee)}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigateTo(`/cooks/${cook.id}`)}
                  className="px-4 py-2 border border-[#E5ECE7] hover:border-[#B8E4D3] text-[#263B35] text-xs font-semibold rounded-xl hover:bg-stone-50"
                >
                  Xem chi tiết
                </button>
                <button
                  onClick={() => handleSelectCookForOrder(cook)}
                  className="px-4 py-2 bg-[#285E56] text-white text-xs font-semibold rounded-xl hover:bg-[#1f4b44] shadow-sm"
                >
                  Đặt đầu bếp này
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
