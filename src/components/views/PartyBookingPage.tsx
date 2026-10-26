import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatVND } from '../../utils/pricing';
import { ImageWithFallback } from '../common/ImageWithFallback';
import menuBanquet from '../../assets/food/menu-banquet.webp';
import { 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldCheck, 
  Sparkles,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { 
  validateDeliveryDateTime, 
  formatDateForInput, 
  getNow 
} from '../../utils/dateTimeValidation';

export const PartyBookingPage: React.FC = () => {
  const { updateDraftOrder, cooks, dishes, submitDraftOrder, navigateTo } = useApp();

  const [eventType, setEventType] = useState('Tiệc sinh nhật');
  const [guests, setGuests] = useState(25);
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0]);
  const [time, setTime] = useState('17:30');
  const [address, setAddress] = useState('Biệt thự Palm Residence, P. An Phú, TP. Thủ Đức');
  const [servingStyle, setServingStyle] = useState('Dọn mâm tròn truyền thống');
  const [needAssistants, setNeedAssistants] = useState(true);
  const [assistantCount, setAssistantCount] = useState(2);
  const [needEquipment, setNeedEquipment] = useState(true);
  const [targetGroceryBudget, setTargetGroceryBudget] = useState(4000000);
  const [selectedCookId, setSelectedCookId] = useState(cooks[1]?.id || cooks[0]?.id);
  const [specialNotes, setSpecialNotes] = useState('Tiệc có trẻ em và người già, cần 1 bàn nướng BBQ và chuẩn bị chén đĩa tươm tất.');

  const timeValidation = validateDeliveryDateTime(date, time);

  const handleSubmitQuotationRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!timeValidation.isValid) {
      alert(`Quy định đặt món: ${timeValidation.message}`);
      return;
    }

    // Select suitable party dishes
    const partyDishes = dishes.slice(4, 9);

    updateDraftOrder({
      serviceType: 'party_at_home',
      guestCount: guests,
      date,
      servingTime: time,
      mealOccasion: `${eventType} (${guests} khách)`,
      customerAddress: address,
      estimatedGroceryBudget: targetGroceryBudget,
      cookId: selectedCookId,
      items: partyDishes.map((dish) => ({ dish, quantity: Math.ceil(guests / 6) })),
      generalPreferences: [
        'Hình thức: ' + servingStyle + '.',
        needAssistants ? 'Cần ' + assistantCount + ' phụ bếp.' : 'Không cần phụ bếp.',
        needEquipment ? 'Yêu cầu dụng cụ chuyên dụng.' : 'Không cần dụng cụ chuyên dụng.',
        'Ghi chú: ' + specialNotes,
      ].join(' '),
    });

    const newOrderId = await submitDraftOrder();
    if (newOrderId) navigateTo(`/orders/${newOrderId}`);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Hero Banner */}
      <div className="grid overflow-hidden rounded-3xl bg-accent text-white shadow-lg md:grid-cols-2">
        <div className="space-y-4 p-6 sm:p-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-brand">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Dành cho tiệc từ 10 đến hơn 50 khách</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Đặt đầu bếp nấu tiệc & Mâm cỗ tại gia theo yêu cầu
          </h1>
          <p className="text-xs sm:text-sm text-white/80 leading-relaxed">
            Không ép combo tiệc sẵn có. Đầu bếp sẽ khảo sát thực đơn, số lượng món và quy mô khách để gửi <strong>bảng báo giá nấu tiệc trực tiếp tại gia, phụ bếp và dọn dẹp chi tiết</strong>. Khách hàng duyệt báo giá trước khi đầu bếp tiến hành.
          </p>
        </div>
        <figure className="relative min-h-56 overflow-hidden bg-surface-alt">
          <img src={menuBanquet} alt="Mâm cỗ gia đình với heo quay bánh hỏi, tôm và gà" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
          <figcaption className="absolute bottom-3 right-3 rounded-full bg-canvas/95 px-3 py-1 text-[10px] text-accent">Ảnh minh họa</figcaption>
        </figure>
      </div>

      {/* Booking Form */}
      <form onSubmit={handleSubmitQuotationRequest} className="bg-white rounded-3xl border border-border-soft p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-ink">1. Thông tin quy mô sự kiện</h2>
          <p className="text-xs text-muted mt-0.5">Thời gian, địa điểm và số lượng khách tham dự tiệc.</p>
        </div>

        {/* 4-hour advance booking rule banner */}
        {!timeValidation.isValid ? (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{timeValidation.message}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setDate(timeValidation.earliestDateStr);
                setTime(timeValidation.earliestTimeStr);
              }}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg shrink-0"
            >
              Chọn giờ sớm nhất ({timeValidation.earliestTimeStr})
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Thời gian hợp lệ: Khai tiệc lúc <strong>{time} ngày {date}</strong> (cách hiện tại {Math.floor(timeValidation.hoursUntilDelivery)} giờ - Đạt chuẩn tối thiểu 4 tiếng chuẩn bị).
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5">Loại hình sự kiện:</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-accent"
            >
              <option value="Tiệc sinh nhật">Tiệc sinh nhật tại gia</option>
              <option value="Đám giỗ họ / Cúng gia tiên">Đám giỗ / Mâm cỗ cúng họ</option>
              <option value="Tiệc tân gia nhà mới">Tiệc tân gia nhà mới</option>
              <option value="Tiệc thôi nôi / Đầy tháng">Tiệc thôi nôi / Đầy tháng</option>
              <option value="Tiệc BBQ sân vườn cuối tuần">Tiệc nướng BBQ ngoài trời</option>
              <option value="Tiệc liên hoan công ty">Họp mặt công ty / Nhóm bạn</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-accent" /> Số lượng khách:
            </label>
            <input
              type="number"
              min={10}
              max={150}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm font-bold text-accent focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-accent" /> Ngày tổ chức:
            </label>
            <input
              type="date"
              min={formatDateForInput(getNow())}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-surface border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-accent ${
                !timeValidation.isValid ? 'border-rose-400 bg-rose-50/30' : 'border-border-soft'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-accent" /> Giờ khai tiệc:
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className={`w-full px-3.5 py-2.5 bg-surface border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-accent ${
                !timeValidation.isValid ? 'border-rose-400 bg-rose-50/30 text-rose-900' : 'border-border-soft'
              }`}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-ink mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-accent" /> Địa điểm tổ chức:
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Nhập địa chỉ nhà riêng hoặc sảnh tiệc..."
              className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-accent"
              required
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border-soft">
          <h2 className="text-lg sm:text-xl font-bold text-ink">2. Phong cách phục vụ & Nhân sự</h2>
          <p className="text-xs text-muted mt-0.5">Tiêu chuẩn phục vụ bàn và hỗ trợ dọn dẹp.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
          <div>
            <label className="block font-semibold text-ink mb-1.5">Hình thức dọn tiệc:</label>
            <select
              value={servingStyle}
              onChange={(e) => setServingStyle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-accent"
            >
              <option value="Dọn mâm tròn truyền thống">Dọn mâm tròn truyền thống (6-10 người/mâm)</option>
              <option value="Tiệc nướng BBQ trực tiếp tại bàn">Tiệc nướng BBQ trực tiếp tại bàn</option>
              <option value="Buffet tự chọn đứng">Buffet tự chọn đứng</option>
              <option value="Set món từng đợt theo trình tự">Phục vụ từng đợt (Khai vị - Món chính - Tráng miệng)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink mb-1.5">Ngân sách đi chợ dự kiến (VNĐ):</label>
            <input
              type="number"
              step="500000"
              min="1000000"
              value={targetGroceryBudget}
              onChange={(e) => setTargetGroceryBudget(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm font-bold text-accent focus:ring-2 focus:ring-accent"
            />
            <p className="text-[11px] text-muted mt-1">
              Khoảng {formatVND(Math.round(targetGroceryBudget / guests))} / khách
            </p>
          </div>
        </div>

        {/* Staff & Equipment check */}
        <div className="bg-surface p-5 rounded-2xl border border-border-soft space-y-4 text-xs sm:text-sm">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={needAssistants}
              onChange={(e) => setNeedAssistants(e.target.checked)}
              className="w-4 h-4 text-accent rounded focus:ring-accent"
            />
            <span className="font-semibold text-ink">
              Cần nhân sự phụ bếp hỗ trợ nướng & bưng bê ({assistantCount} người)
            </span>
          </label>

          {needAssistants && (
            <div className="pl-7 flex items-center gap-3">
              <span className="text-xs text-muted">Số lượng phụ bếp:</span>
              <select
                value={assistantCount}
                onChange={(e) => setAssistantCount(Number(e.target.value))}
                className="px-3 py-1.5 bg-white border border-border-soft rounded-lg text-xs font-bold text-accent"
              >
                <option value={1}>1 người (Tiệc 10-15 khách)</option>
                <option value={2}>2 người (Tiệc 20-30 khách)</option>
                <option value={3}>3 người (Tiệc 35-50 khách)</option>
                <option value={4}>4 người (Tiệc trên 50 khách)</option>
              </select>
            </div>
          )}

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={needEquipment}
              onChange={(e) => setNeedEquipment(e.target.checked)}
              className="w-4 h-4 text-accent rounded focus:ring-accent"
            />
            <span className="font-semibold text-ink">
              Yêu cầu đầu bếp mang theo dụng cụ chuyên dụng (bếp nướng than, nồi lẩu tiệc, vỉ nướng...)
            </span>
          </label>
        </div>

        {/* Cook selector for party */}
        <div className="pt-4 border-t border-border-soft">
          <h2 className="text-lg sm:text-xl font-bold text-ink mb-2">3. Chọn đầu bếp nhận yêu cầu</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cooks.map((c) => (
              <label
                key={c.id}
                className={`p-4 rounded-2xl border-2 flex items-center gap-3.5 cursor-pointer transition-all ${
                  selectedCookId === c.id
                    ? 'border-accent bg-surface-alt/40 shadow-xs'
                    : 'border-border-soft hover:border-brand'
                }`}
              >
                <input
                  type="radio"
                  name="partyCook"
                  value={c.id}
                  checked={selectedCookId === c.id}
                  onChange={() => setSelectedCookId(c.id)}
                  className="w-4 h-4 text-accent focus:ring-accent"
                />
                <div className="w-12 h-12 rounded-full overflow-hidden border border-brand shrink-0">
                  <ImageWithFallback src={c.avatar} alt={c.name} fallbackType="cook" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-ink">{c.name}</h4>
                  <p className="text-xs text-muted line-clamp-1">{c.title}</p>
                  <p className="text-[11px] text-accent font-medium">Sức chứa: {c.maxGuests} khách</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink mb-1.5">
            Ghi chú thêm về yêu cầu món ăn & không gian:
          </label>
          <textarea
            rows={3}
            value={specialNotes}
            onChange={(e) => setSpecialNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-surface border border-border-soft rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-border-soft flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs text-muted flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent" />
            <span>Đầu bếp sẽ gửi báo giá cụ thể. Bạn xem và duyệt trước khi chốt đơn.</span>
          </div>

          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3.5 bg-accent hover:bg-accent-hover text-white font-bold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Gửi yêu cầu & Nhận báo giá chi tiết</span>
          </button>
        </div>
      </form>
    </div>
  );
};
