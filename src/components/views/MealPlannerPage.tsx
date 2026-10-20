import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Dish, DishCategory } from '../../types';
import { calculateLaborFee, formatVND } from '../../utils/pricing';
import { 
  validateDeliveryDateTime, 
  getEarliestDeliveryDate, 
  formatDateForInput, 
  formatTimeForInput, 
  getNow 
} from '../../utils/dateTimeValidation';
import { 
  Users, 
  Calendar, 
  Clock, 
  MapPin, 
  Utensils, 
  AlertCircle, 
  Check, 
  ArrowRight, 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  ChefHat, 
  Star, 
  ShieldCheck, 
  Receipt, 
  Info,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Truck
} from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';

const STEPS = [
  'Thời gian & Địa chỉ giao',
  'Chọn món ăn',
  'Nguyên liệu & Kiêng khem',
  'Ngân sách đi chợ',
  'Tính công nấu & Phí giao',
  'Chọn đầu bếp',
  'Xác nhận đơn',
];

export const MealPlannerPage: React.FC = () => {
  const { dishes, cooks, draftOrder, updateDraftOrder, submitDraftOrder, navigateTo } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<DishCategory | 'all'>('all');
  const [newExcludedIngredient, setNewExcludedIngredient] = useState('');
  const [newAllergy, setNewAllergy] = useState('');

  // Validate date & time with 4-hour advance constraint
  const timeValidation = validateDeliveryDateTime(draftOrder.date, draftOrder.servingTime);

  // Auto-set earliest valid date & time if currently empty or invalid on first mount
  useEffect(() => {
    if (!draftOrder.date || !draftOrder.servingTime) {
      const earliest = getEarliestDeliveryDate();
      updateDraftOrder({
        date: formatDateForInput(earliest),
        servingTime: formatTimeForInput(earliest),
        serviceType: 'cook_and_deliver',
      });
    }
  }, []);

  const handleApplyEarliestTime = () => {
    const earliest = getEarliestDeliveryDate();
    updateDraftOrder({
      date: formatDateForInput(earliest),
      servingTime: formatTimeForInput(earliest),
    });
  };

  // Selected dishes
  const selectedItems = draftOrder.items || [];
  const selectedDishes = selectedItems.map((i) => i.dish);

  // Calculate estimated ingredient cost
  const estimatedIngredientTotal = selectedItems.reduce(
    (sum, item) => sum + (item.dish.estimatedCost || 0) * item.quantity,
    0
  );

  // Calculate labor fee (always cook_and_deliver)
  const guestCount = draftOrder.guestCount || 4;
  const feeCalc = calculateLaborFee(guestCount, selectedDishes, 'cook_and_deliver');

  // Add / remove dish
  const handleAddDish = (dish: Dish) => {
    const existing = selectedItems.find((i) => i.dish.id === dish.id);
    if (existing) {
      const updated = selectedItems.map((i) =>
        i.dish.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i
      );
      updateDraftOrder({ items: updated });
    } else {
      updateDraftOrder({ items: [...selectedItems, { dish, quantity: 1 }] });
    }
  };

  const handleUpdateQuantity = (dishId: string, delta: number) => {
    const updated = selectedItems
      .map((i) => {
        if (i.dish.id === dishId) {
          const newQty = i.quantity + delta;
          return newQty > 0 ? { ...i, quantity: newQty } : null;
        }
        return i;
      })
      .filter(Boolean) as typeof selectedItems;
    updateDraftOrder({ items: updated });
  };

  const handleRemoveDish = (dishId: string) => {
    const updated = selectedItems.filter((i) => i.dish.id !== dishId);
    updateDraftOrder({ items: updated });
  };

  // Allergies & excluded ingredients
  const handleAddAllergy = () => {
    if (newAllergy.trim() && !(draftOrder.allergies || []).includes(newAllergy.trim())) {
      updateDraftOrder({ allergies: [...(draftOrder.allergies || []), newAllergy.trim()] });
      setNewAllergy('');
    }
  };

  const handleRemoveAllergy = (idx: number) => {
    const updated = (draftOrder.allergies || []).filter((_, i) => i !== idx);
    updateDraftOrder({ allergies: updated });
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // Step 1: Validate 4-hour rule & address
      if (!timeValidation.isValid) {
        alert(`Quy định đặt món: ${timeValidation.message}`);
        return;
      }
      if (!draftOrder.customerAddress?.trim()) {
        alert('Vui lòng nhập địa chỉ nhận món ăn để đầu bếp giao đến.');
        return;
      }
    }
    if (currentStep === 2) {
      // Step 2: Validate at least 1 dish
      if (selectedItems.length === 0) {
        alert('Vui lòng chọn ít nhất 1 món ăn cho bữa cơm của bạn.');
        return;
      }
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      window.scrollTo({ top: 100, behavior: 'smooth' });
    }
  };

  const handleSubmit = () => {
    if (!timeValidation.isValid) {
      alert(`Quy định đặt món: ${timeValidation.message}`);
      setCurrentStep(1);
      return;
    }
    const newOrderId = submitDraftOrder();
    navigateTo(`/orders/${newOrderId}`);
  };

  // Filtered dishes
  const filteredDishes = selectedCategory === 'all'
    ? dishes
    : dishes.filter((d) => d.category === selectedCategory);

  const budget = draftOrder.estimatedGroceryBudget || 400000;
  const budgetDifference = budget - estimatedIngredientTotal;

  const minDateAllowed = formatDateForInput(getNow());

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Stepper */}
      <div className="bg-white rounded-2xl p-6 border border-[#E5ECE7] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-[#285E56] uppercase tracking-wider">
                Quy trình đặt nấu bữa ăn
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Truck className="w-3 h-3 text-emerald-600" />
                Giao món nóng sốt tận nơi
              </span>
            </div>
            <h1 className="text-2xl font-bold text-[#263B35]">
              {STEPS[currentStep - 1]}
            </h1>
          </div>
          <div className="text-xs text-[#738078] flex items-center gap-2">
            <span>Bước {currentStep} / {STEPS.length}</span>
            <span className="font-semibold text-[#285E56]">
              ({Math.round((currentStep / STEPS.length) * 100)}%)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#E7F5EF] h-2 rounded-full overflow-hidden mb-4">
          <div
            className="bg-[#285E56] h-full transition-all duration-300 rounded-full"
            style={{ width: `${(currentStep / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Step Pills on Desktop */}
        <div className="hidden lg:grid grid-cols-7 gap-2 text-[11px] font-medium text-center text-[#738078]">
          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className={`py-1.5 px-1 rounded-lg truncate ${
                currentStep === idx + 1
                  ? 'bg-[#285E56] text-white font-semibold'
                  : currentStep > idx + 1
                  ? 'bg-[#E7F5EF] text-[#285E56]'
                  : 'bg-stone-50'
              }`}
            >
              {idx + 1}. {step}
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: THỜI GIAN, ĐỊA CHỈ & QUY MÔ (ĐÃ LOẠI BỎ BƯỚC CHỌN HÌNH THỨC NẤU TẠI NHÀ, ÉP BUỘC CHỌN TRƯỚC 4 TIẾNG) */}
      {currentStep === 1 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5ECE7] shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[#E5ECE7]">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#263B35]">
                Thời gian giao món & Địa chỉ nhận hàng
              </h2>
              <p className="text-xs sm:text-sm text-[#738078] mt-0.5">
                Đầu bếp HomeMeal đi chợ tươi mới, nấu nướng tại gian bếp riêng đạt chuẩn vệ sinh và giao món nóng sốt đến tận nhà bạn.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold shrink-0">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>Yêu cầu đặt trước tối thiểu 4 tiếng</span>
            </div>
          </div>

          {/* 4-Hour Rule Live Verification Banner */}
          {!timeValidation.isValid ? (
            <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-900 space-y-2 animate-pulse">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm space-y-1">
                  <p className="font-bold text-rose-800">
                    ⚠️ Giờ giao không hợp lệ (Không được chọn cách giờ giao dưới 4 tiếng)
                  </p>
                  <p className="text-rose-700">
                    {timeValidation.message}
                  </p>
                </div>
              </div>
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleApplyEarliestTime}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-all flex items-center gap-1.5 shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Tự động chọn giờ sớm nhất khả dụng ({timeValidation.suggestedFormatted})</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Thời gian hợp lệ:</strong> Giao món lúc <strong>{draftOrder.servingTime} ngày {draftOrder.date}</strong> (cách hiện tại {Math.floor(timeValidation.hoursUntilDelivery)} giờ {Math.round((timeValidation.hoursUntilDelivery - Math.floor(timeValidation.hoursUntilDelivery)) * 60)} phút - Đảm bảo đủ tối thiểu 4 tiếng để đầu bếp chuẩn bị chu đáo).
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-semibold text-[#263B35] mb-1.5 flex items-center gap-1">
                <Calendar className="w-4 h-4 text-[#285E56]" /> Ngày giao món:
              </label>
              <input
                type="date"
                min={minDateAllowed}
                value={draftOrder.date || ''}
                onChange={(e) => updateDraftOrder({ date: e.target.value })}
                className={`w-full px-3.5 py-2.5 bg-[#FFFDF7] border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56] font-medium ${
                  !timeValidation.isValid ? 'border-rose-400 ring-1 ring-rose-200' : 'border-[#E5ECE7]'
                }`}
              />
              <p className="text-[11px] text-[#738078] mt-1">
                Sớm nhất: hôm nay hoặc ngày mai
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#263B35] mb-1.5 flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#285E56]" /> Giờ giao tới bàn ăn:
              </label>
              <input
                type="time"
                value={draftOrder.servingTime || ''}
                onChange={(e) => updateDraftOrder({ servingTime: e.target.value })}
                className={`w-full px-3.5 py-2.5 bg-[#FFFDF7] border rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56] font-medium ${
                  !timeValidation.isValid ? 'border-rose-400 ring-1 ring-rose-200 bg-rose-50/40 text-rose-900' : 'border-[#E5ECE7]'
                }`}
              />
              <p className="text-[11px] text-[#738078] mt-1">
                * Phải sớm trước ít nhất 4 tiếng kể từ lúc đặt
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#263B35] mb-1.5 flex items-center gap-1">
                <Users className="w-4 h-4 text-[#285E56]" /> Số lượng khách ăn:
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={draftOrder.guestCount || 4}
                onChange={(e) => updateDraftOrder({ guestCount: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56] font-medium"
              />
              {guestCount > 20 && (
                <p className="text-[11px] text-amber-700 mt-1 font-medium">
                  * Quy mô trên 20 khách sẽ có cơ chế gửi bảng báo giá cụ thể từ đầu bếp.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-[#263B35] mb-1.5 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-[#285E56]" /> Địa chỉ giao nhận món ăn:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: Căn hộ 12.04, Toà Landmark 3, Vinhomes Central Park, Bình Thạnh"
                value={draftOrder.customerAddress || ''}
                onChange={(e) => updateDraftOrder({ customerAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#263B35] mb-1.5">Dịp bữa ăn:</label>
              <input
                type="text"
                placeholder="Ví dụ: Cơm tối thường nhật, Sinh nhật con, Giỗ ông bà..."
                value={draftOrder.mealOccasion || 'Bữa cơm gia đình'}
                onChange={(e) => updateDraftOrder({ mealOccasion: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56]"
              />
            </div>
          </div>

          <div className="p-4 bg-[#FFFDF7] rounded-xl border border-[#E5ECE7] text-xs text-[#738078] flex items-start gap-2">
            <Info className="w-4 h-4 text-[#285E56] shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-[#263B35]">Cam kết chất lượng giao nhận:</span> Món ăn sau khi nấu xong tại bếp riêng của đầu bếp sẽ được đóng hộp sinh học giữ nhiệt, niêm phong cẩn thận và giao nhanh qua thùng giữ nhiệt để đảm bảo giữ nguyên độ nóng, mùi thơm và hương vị khi đến tay gia đình bạn.
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: CHỌN MÓN ĂN */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#E5ECE7] shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-[#263B35]">Chọn từng món ăn lẻ</h2>
                <p className="text-xs sm:text-sm text-[#738078]">
                  Tự do chọn món thịt, cá, canh, rau tùy thích. Bạn đã chọn <strong>{selectedItems.length} món</strong>.
                </p>
              </div>

              {/* Selected summary strip */}
              <div className="text-right">
                <span className="text-xs text-[#738078]">Nguyên liệu ước tính tạm tính:</span>
                <p className="text-base font-bold text-[#285E56]">{formatVND(estimatedIngredientTotal)}</p>
              </div>
            </div>

            {/* Category tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#E5ECE7] text-xs">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'meat', label: 'Món thịt' },
                { id: 'fish', label: 'Món cá' },
                { id: 'seafood', label: 'Hải sản' },
                { id: 'vegetable', label: 'Rau củ' },
                { id: 'soup', label: 'Canh' },
                { id: 'vegetarian', label: 'Món chay' },
                { id: 'dessert', label: 'Tráng miệng' },
                { id: 'banquet', label: 'Món tiệc/cỗ' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-medium ${
                    selectedCategory === tab.id
                      ? 'bg-[#285E56] text-white'
                      : 'bg-[#FFFDF7] text-[#263B35] hover:bg-[#E7F5EF]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dish Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDishes.map((dish) => {
              const selected = selectedItems.find((i) => i.dish.id === dish.id);

              return (
                <div
                  key={dish.id}
                  className={`bg-white rounded-2xl border overflow-hidden transition-all flex flex-col justify-between ${
                    selected ? 'border-[#285E56] ring-2 ring-[#285E56]/20 shadow-md' : 'border-[#E5ECE7] hover:border-[#B8E4D3]'
                  }`}
                >
                  <div>
                    <div className="relative aspect-16/10 overflow-hidden bg-stone-100">
                      <ImageWithFallback
                        src={dish.imageUrl}
                        alt={dish.name}
                        fallbackType="dish"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/90 backdrop-blur-xs text-[10px] font-semibold text-[#285E56]">
                        {dish.suggestedPortion}
                      </div>
                      <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
                        {dish.complexity === 'simple' ? 'Dễ làm' : dish.complexity === 'moderate' ? 'Vừa phải' : 'Kỳ công'}
                      </div>
                    </div>

                    <div className="p-4 space-y-2">
                      <h3 className="font-bold text-sm sm:text-base text-[#263B35] line-clamp-1">{dish.name}</h3>
                      <p className="text-xs text-[#738078] line-clamp-2">{dish.description}</p>
                      
                      <div className="pt-2 flex items-center justify-between text-xs">
                        <span className="text-[#738078]">Ước tính nguyên liệu:</span>
                        <span className="font-bold text-[#263B35]">{formatVND(dish.estimatedCost)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 pt-0 border-t border-[#E5ECE7]/60 mt-2">
                    {selected ? (
                      <div className="flex items-center justify-between pt-3">
                        <span className="text-xs font-semibold text-[#285E56]">Đã chọn:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQuantity(dish.id, -1)}
                            className="p-1 rounded-md border border-[#E5ECE7] text-[#263B35] hover:bg-stone-100"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{selected.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(dish.id, 1)}
                            className="p-1 rounded-md border border-[#E5ECE7] text-[#263B35] hover:bg-stone-100"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveDish(dish.id)}
                            className="p-1 rounded-md text-rose-600 hover:bg-rose-50 ml-1"
                            title="Xóa món này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddDish(dish)}
                        className="w-full mt-3 py-2 bg-[#E7F5EF] hover:bg-[#285E56] text-[#285E56] hover:text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm vào mâm cơm</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 3: NGUYÊN LIỆU & KIÊNG KHEM */}
      {currentStep === 3 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5ECE7] shadow-xs space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#263B35] mb-2">
              Khẩu vị, dị ứng & yêu cầu nêm nếm
            </h2>
            <p className="text-xs sm:text-sm text-[#738078]">
              Đầu bếp HomeMeal sẽ nêm nếm cá nhân hóa hoàn toàn theo ý gia đình bạn.
            </p>
          </div>

          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Lưu ý quan trọng về dị ứng thực phẩm:</p>
              Nếu trong gia đình có người dị ứng nghiêm trọng (hải sản, đậu phộng, trứng...), hãy ghi rõ bên dưới để đầu bếp chuẩn bị dao thớt riêng biệt và kiểm tra nhãn thành phần khi đi chợ.
            </div>
          </div>

          {/* Allergies list */}
          <div>
            <label className="block text-xs font-semibold text-[#263B35] mb-2">Dị ứng thực phẩm cần tránh tuyệt đối:</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {(draftOrder.allergies || []).map((allergy, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-50 text-rose-800 text-xs font-medium border border-rose-200"
                >
                  <span>{allergy}</span>
                  <button onClick={() => handleRemoveAllergy(idx)} className="text-rose-600 hover:text-rose-900">
                    ×
                  </button>
                </span>
              ))}
              {(draftOrder.allergies || []).length === 0 && (
                <span className="text-xs text-[#738078] italic">Chưa có ghi chú dị ứng nào</span>
              )}
            </div>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Nhập chất dị ứng (vd: Đậu phộng, Tôm cua...)"
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddAllergy())}
                className="flex-1 px-3 py-2 bg-[#FFFDF7] border border-[#E5ECE7] rounded-lg text-xs focus:ring-2 focus:ring-[#285E56]"
              />
              <button
                type="button"
                onClick={handleAddAllergy}
                className="px-3 py-2 bg-[#285E56] text-white text-xs font-semibold rounded-lg hover:bg-[#1f4b44]"
              >
                Thêm
              </button>
            </div>
          </div>

          {/* Preferences */}
          <div>
            <label className="block text-xs font-semibold text-[#263B35] mb-1.5">
              Ghi chú nêm nếm & yêu cầu riêng:
            </label>
            <textarea
              rows={3}
              placeholder="Ví dụ: Bớt bột ngọt, ít đường ngọt theo kiểu miền Trung, rau muống xào mềm cho ông bà dễ nhai, không cho ớt cay vào canh..."
              value={draftOrder.generalPreferences || ''}
              onChange={(e) => updateDraftOrder({ generalPreferences: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#285E56]"
            />
          </div>
        </div>
      )}

      {/* STEP 4: NGÂN SÁCH ĐI CHỢ */}
      {currentStep === 4 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5ECE7] shadow-xs space-y-6">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#263B35] mb-2">
              Thiết lập trần ngân sách nguyên liệu
            </h2>
            <p className="text-xs sm:text-sm text-[#738078]">
              Bạn đặt mức tiền tối đa cho đầu bếp đi chợ. Đầu bếp chỉ mua trong giới hạn này và bạn <strong>chỉ thanh toán đúng số tiền trên hóa đơn thực tế</strong>.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-[#E7F5EF]/60 border border-[#B8E4D3] space-y-2">
              <span className="text-xs text-[#738078]">Chi phí nguyên liệu ước tính:</span>
              <p className="text-2xl font-bold text-[#285E56]">{formatVND(estimatedIngredientTotal)}</p>
              <p className="text-[11px] text-[#738078]">Dựa trên giá trung bình tại chợ và siêu thị hôm nay</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5ECE7] space-y-2">
              <span className="text-xs text-[#738078]">Ước tính trên mỗi khách:</span>
              <p className="text-2xl font-bold text-[#263B35]">
                {formatVND(guestCount > 0 ? estimatedIngredientTotal / guestCount : 0)}
              </p>
              <p className="text-[11px] text-[#738078]">Quy mô {guestCount} người ăn</p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-[#E5ECE7] space-y-2">
              <span className="text-xs text-[#738078]">Chênh lệch ngân sách:</span>
              <p className={`text-2xl font-bold ${budgetDifference >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {budgetDifference >= 0 ? `+${formatVND(budgetDifference)}` : formatVND(budgetDifference)}
              </p>
              <p className="text-[11px] text-[#738078]">
                {budgetDifference >= 0 ? 'Ngân sách đủ để đầu bếp mua thực phẩm ngon' : 'Ngân sách thấp hơn giá ước tính của các món đã chọn'}
              </p>
            </div>
          </div>

          <div className="max-w-lg space-y-3">
            <label className="block text-xs font-semibold text-[#263B35]">
              Hạn mức ngân sách đi chợ bạn phê duyệt (VNĐ):
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                step="50000"
                min="100000"
                value={budget}
                onChange={(e) => updateDraftOrder({ estimatedGroceryBudget: Number(e.target.value) })}
                className="flex-1 px-3.5 py-2.5 bg-[#FFFDF7] border border-[#E5ECE7] rounded-xl text-base font-bold text-[#285E56] focus:ring-2 focus:ring-[#285E56]"
              />
              <button
                type="button"
                onClick={() => updateDraftOrder({ estimatedGroceryBudget: Math.ceil(estimatedIngredientTotal / 50000) * 50000 })}
                className="px-4 py-2 bg-[#E7F5EF] text-[#285E56] text-xs font-semibold rounded-xl hover:bg-[#B8E4D3]"
              >
                Đặt theo ước tính
              </button>
            </div>
            <p className="text-xs text-[#738078]">
              * Nếu đầu bếp đi chợ hết ít hơn ngân sách này (ví dụ hết 350.000đ), bạn chỉ trả 350.000đ. Không bao giờ thu cố định!
            </p>
          </div>
        </div>
      )}

      {/* STEP 5: TÍNH CÔNG NẤU & PHÍ GIAO HÀNG */}
      {currentStep === 5 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5ECE7] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-[#263B35] mb-1">
                Bảng tính tiền công nấu & Phí giao tận nơi
              </h2>
              <p className="text-xs sm:text-sm text-[#738078]">
                Tiền công nấu tại gian bếp chuyên biệt của đầu bếp và phí giao tận nơi giữ nhiệt nóng sốt.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-[#738078]">Tổng tiền công + phí giao:</span>
              <p className="text-2xl font-extrabold text-[#285E56]">{formatVND(feeCalc.totalLaborFee + feeCalc.deliveryFee)}</p>
            </div>
          </div>

          {/* Breakdown items */}
          <div className="space-y-3 bg-[#FFFDF7] p-5 rounded-2xl border border-[#E5ECE7] text-xs sm:text-sm">
            <h3 className="font-bold text-[#263B35] border-b border-[#E5ECE7] pb-2">Chi tiết từng cấu phần tính công:</h3>
            {feeCalc.breakdownSummary.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between py-1 border-b border-[#E5ECE7]/50">
                <span className="text-[#263B35]">{item.split(':')[0]}</span>
                <span className="font-semibold text-[#285E56]">{item.split(':')[1] || ''}</span>
              </div>
            ))}
          </div>

          {feeCalc.requiresQuotation && (
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 text-indigo-900 text-xs">
              <p className="font-semibold mb-1">Quy mô lớn cần xác nhận báo giá:</p>
              Vì số lượng khách lớn ({guestCount} người) hoặc thực đơn nhiều món, sau khi bạn gửi yêu cầu, đầu bếp sẽ xem xét và gửi một bảng báo giá chính xác (bao gồm nhân sự phụ bếp nếu cần) trước khi bạn xác nhận đặt.
            </div>
          )}
        </div>
      )}

      {/* STEP 6: CHỌN ĐẦU BẾP */}
      {currentStep === 6 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-[#E5ECE7] shadow-xs">
            <h2 className="text-lg sm:text-xl font-bold text-[#263B35] mb-1">
              Chọn đầu bếp chuẩn bị bữa ăn
            </h2>
            <p className="text-xs sm:text-sm text-[#738078]">
              Dựa trên khu vực hoạt động, kinh nghiệm nấu nướng và sở trường ẩm thực của từng đầu bếp.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {cooks.map((cook) => {
              const isSelected = (draftOrder.cookId || cooks[0].id) === cook.id;

              return (
                <div
                  key={cook.id}
                  onClick={() => updateDraftOrder({ cookId: cook.id })}
                  className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#285E56] bg-[#E7F5EF]/30 shadow-md ring-2 ring-[#285E56]/20'
                      : 'border-[#E5ECE7] bg-white hover:border-[#B8E4D3]'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3.5 mb-3">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-[#B8E4D3] shrink-0">
                        <ImageWithFallback
                          src={cook.avatar}
                          alt={cook.name}
                          fallbackType="cook"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-base text-[#263B35]">{cook.name}</h3>
                          {cook.verified && (
                            <span title="Đã kiểm định VSATTP">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[#738078]">{cook.title}</p>
                        <div className="flex items-center gap-1 text-xs text-[#285E56] font-semibold mt-0.5">
                          <Star className="w-3 h-3 fill-[#F2AD72] text-[#F2AD72]" />
                          <span>{cook.rating}</span>
                          <span className="text-[#738078] font-normal">({cook.reviewCount} đánh giá)</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-[#738078] line-clamp-2 mb-3">{cook.bio}</p>

                    <div className="text-xs space-y-1 text-[#738078] pt-2 border-t border-[#E5ECE7]">
                      <p>Khu vực: {cook.serviceAreas.join(', ')}</p>
                      <p>Công suất: Tối đa {cook.maxGuests} khách</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#E5ECE7] flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#285E56]">
                      {isSelected ? 'Đang chọn đầu bếp này' : 'Bấm để chọn'}
                    </span>
                    <span className="text-xs font-bold text-[#263B35]">
                      Khởi điểm {formatVND(cook.baseLaborFee)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 7: XÁC NHẬN ĐƠN HÀNG */}
      {currentStep === 7 && (
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E5ECE7] shadow-xs space-y-6">
          <div className="border-b border-[#E5ECE7] pb-4">
            <span className="text-xs font-bold text-[#285E56] uppercase tracking-wider">Tổng kết đơn đặt món</span>
            <h2 className="text-xl font-bold text-[#263B35]">Xem lại thông tin trước khi gửi</h2>
            <p className="text-xs text-[#738078] mt-1">
              Gửi yêu cầu này hoàn toàn <strong>CHƯA BỊ TRỪ TIỀN</strong>. Bạn chỉ thanh toán sau khi bữa ăn hoàn tất và nhận đủ hóa đơn đi chợ thật.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs sm:text-sm">
            {/* Left Column: Details */}
            <div className="space-y-4">
              <div className="bg-stone-50 p-4 rounded-xl border border-[#E5ECE7] space-y-2">
                <h3 className="font-bold text-[#263B35]">Thông tin nhận món:</h3>
                <div className="flex justify-between">
                  <span className="text-[#738078]">Ngày giờ giao:</span>
                  <span className="font-semibold text-[#285E56]">{draftOrder.date} lúc {draftOrder.servingTime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#738078]">Số lượng khách:</span>
                  <span className="font-semibold text-[#263B35]">{guestCount} người</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#738078]">Hình thức dịch vụ:</span>
                  <span className="font-semibold text-[#285E56]">
                    Nấu tại bếp đạt chuẩn & Giao hộp giữ nhiệt nóng sốt tận nơi
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#738078]">Địa chỉ giao món:</span>
                  <span className="font-semibold text-[#263B35] text-right line-clamp-1">{draftOrder.customerAddress}</span>
                </div>
                {draftOrder.mealOccasion && (
                  <div className="flex justify-between">
                    <span className="text-[#738078]">Dịp bữa ăn:</span>
                    <span className="font-semibold text-[#263B35]">{draftOrder.mealOccasion}</span>
                  </div>
                )}
              </div>

              {/* Menu items list */}
              <div className="bg-stone-50 p-4 rounded-xl border border-[#E5ECE7] space-y-2">
                <h3 className="font-bold text-[#263B35]">Món ăn đã chọn ({selectedItems.length} món):</h3>
                <ul className="space-y-1.5 divide-y divide-[#E5ECE7]">
                  {selectedItems.map((item, idx) => (
                    <li key={idx} className="pt-1.5 flex justify-between items-center text-xs">
                      <span>{item.dish.name} (x{item.quantity})</span>
                      <span className="font-medium text-[#285E56]">{formatVND(item.dish.estimatedCost * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Right Column: Financial Separation */}
            <div className="space-y-4">
              <div className="bg-[#E7F5EF] p-5 rounded-2xl border border-[#B8E4D3] space-y-3">
                <h3 className="font-bold text-[#285E56] text-base">Bảng dự toán chi phí minh bạch:</h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-[#B8E4D3]/40">
                    <span className="text-[#263B35]">1. Ngân sách tiền chợ bạn phê duyệt:</span>
                    <span className="font-bold text-[#285E56]">{formatVND(budget)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#B8E4D3]/40">
                    <span className="text-[#263B35]">2. Tiền công nấu (tạm tính):</span>
                    <span className="font-bold text-[#285E56]">{formatVND(feeCalc.totalLaborFee)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-[#B8E4D3]/40">
                    <span className="text-[#263B35]">3. Phí giao hàng nóng tận nơi:</span>
                    <span className="font-bold text-[#285E56]">{formatVND(feeCalc.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between pt-2 text-sm font-extrabold text-[#263B35]">
                    <span>Tổng dự kiến tối đa:</span>
                    <span className="text-base text-[#285E56]">{formatVND(budget + feeCalc.totalLaborFee + feeCalc.deliveryFee)}</span>
                  </div>
                </div>

                <div className="p-3 bg-white/80 rounded-xl text-[11px] text-[#738078] space-y-1">
                  <p className="font-semibold text-[#285E56]">Chính sách thanh toán:</p>
                  <p>• Bạn chỉ thanh toán tiền chợ theo hóa đơn thực mua tại chợ, không bao giờ thu trọn gói.</p>
                  <p>• Thanh toán chỉ diễn ra SAU KHI bạn đã nhận đồ ăn và dùng bữa xong.</p>
                  <p>• Có quyền khiếu nại từng dòng hóa đơn nếu thấy sai khác.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wizard Action Controls */}
      <div className="flex items-center justify-between pt-4 border-t border-[#E5ECE7]">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={handlePrev}
            className="px-5 py-2.5 bg-white border border-[#E5ECE7] text-[#263B35] font-semibold text-xs sm:text-sm rounded-xl hover:bg-stone-50 flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
        ) : <div />}

        {currentStep < STEPS.length ? (
          <button
            type="button"
            onClick={handleNext}
            className={`px-6 py-2.5 font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-1.5 shadow-sm transition-all ${
              currentStep === 1 && !timeValidation.isValid
                ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
                : 'bg-[#285E56] hover:bg-[#1f4b44] text-white'
            }`}
          >
            <span>Tiếp tục: {STEPS[currentStep]}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            className="px-8 py-3 bg-[#285E56] hover:bg-[#1f4b44] text-white font-bold text-sm sm:text-base rounded-xl flex items-center gap-2 shadow-md hover:shadow-lg"
          >
            <Check className="w-5 h-5 text-[#B8E4D3]" />
            <span>Gửi yêu cầu đặt bữa (Chưa trừ tiền)</span>
          </button>
        )}
      </div>
    </div>
  );
};
