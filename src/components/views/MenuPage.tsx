import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Dish, DishCategory } from '../../types';
import { formatVND } from '../../utils/pricing';
import { Search, Plus, Check, Filter, Utensils, Info, ShoppingBag } from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';

export const MenuPage: React.FC = () => {
  const { dishes, draftOrder, updateDraftOrder, navigateTo } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DishCategory | 'all'>('all');
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all');
  const [selectedDishDetail, setSelectedDishDetail] = useState<Dish | null>(null);

  const selectedItems = draftOrder.items || [];

  const handleToggleDish = (dish: Dish) => {
    const exists = selectedItems.find((i) => i.dish.id === dish.id);
    if (exists) {
      updateDraftOrder({ items: selectedItems.filter((i) => i.dish.id !== dish.id) });
    } else {
      updateDraftOrder({ items: [...selectedItems, { dish, quantity: 1 }] });
    }
  };

  const filteredDishes = dishes.filter((dish) => {
    if (selectedCategory !== 'all' && dish.category !== selectedCategory) return false;
    if (selectedComplexity !== 'all' && dish.complexity !== selectedComplexity) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = dish.name.toLowerCase().includes(q) || dish.vietnameseName.toLowerCase().includes(q);
      const matchIng = dish.ingredients.some((ing) => ing.name.toLowerCase().includes(q));
      if (!matchName && !matchIng) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#E5E5DC]">
        <div>
          <span className="text-xs font-bold text-[#481620] uppercase tracking-wider">Thực đơn phong phú</span>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#333333]">Chọn món theo sở thích gia đình</h1>
          <p className="text-xs sm:text-sm text-[#62625C] mt-1">
            Mỗi món ăn đều liệt kê rõ nguyên liệu dự kiến và chi phí đi chợ tham khảo.
          </p>
        </div>

        {selectedItems.length > 0 && (
          <button
            onClick={() => navigateTo('/meal-planner')}
            className="px-5 py-2.5 bg-[#481620] text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center gap-2 hover:bg-[#361018] shadow-sm self-start md:self-auto"
          >
            <ShoppingBag className="w-4 h-4 text-[#60D5AE]" />
            <span>Đã chọn {selectedItems.length} món · Đặt bữa ngay</span>
          </button>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#E5E5DC] space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#62625C] absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Tìm theo tên món hoặc nguyên liệu (vd: cá bớp, thịt ba rọi, nấm...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#FFFFFF] border border-[#E5E5DC] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-[#481620]"
            />
          </div>

          <div className="flex gap-2">
            <select
              value={selectedComplexity}
              onChange={(e) => setSelectedComplexity(e.target.value)}
              className="px-3 py-2.5 bg-[#FFFFFF] border border-[#E5E5DC] rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#481620]"
            >
              <option value="all">Mọi độ khó</option>
              <option value="simple">Dễ làm</option>
              <option value="moderate">Vừa phải</option>
              <option value="complex">Kỳ công / Tiệc</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'Tất cả món' },
            { id: 'meat', label: 'Món thịt' },
            { id: 'fish', label: 'Món cá' },
            { id: 'seafood', label: 'Hải sản' },
            { id: 'vegetable', label: 'Rau củ' },
            { id: 'soup', label: 'Canh' },
            { id: 'vegetarian', label: 'Món chay' },
            { id: 'dessert', label: 'Tráng miệng' },
            { id: 'banquet', label: 'Món cỗ / Tiệc' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id as any)}
              className={`px-3.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[#481620] text-white'
                  : 'bg-[#FFFFFF] text-[#333333] hover:bg-[#F0FFF6]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Dish Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDishes.map((dish) => {
          const isSelected = selectedItems.some((i) => i.dish.id === dish.id);

          return (
            <div
              key={dish.id}
              className={`bg-white rounded-2xl border overflow-hidden transition-all flex flex-col justify-between ${
                isSelected ? 'border-[#481620] ring-2 ring-[#481620]/20 shadow-md' : 'border-[#E5E5DC] hover:border-[#60D5AE]'
              }`}
            >
              <div>
                <div className="relative aspect-16/10 bg-stone-100 overflow-hidden">
                  <ImageWithFallback
                    src={dish.imageUrl}
                    alt={dish.name}
                    fallbackType="dish"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-white/95 text-[10px] font-semibold text-[#481620]">
                    Khẩu phần: {dish.suggestedPortion}
                  </div>
                  <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px]">
                    {dish.prepTimeMinutes} phút
                  </div>
                </div>

                <div className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-[#333333] text-sm sm:text-base leading-snug">{dish.name}</h3>
                  </div>

                  <p className="text-xs text-[#62625C] line-clamp-2">{dish.description}</p>

                  <div className="pt-2 flex flex-wrap gap-1">
                    {dish.dietaryTags.map((tag, idx) => (
                      <span key={idx} className="text-[10px] px-2 py-0.5 bg-[#F0FFF6] text-[#481620] rounded-md font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0">
                <div className="py-2.5 border-t border-[#E5E5DC] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#62625C] text-[10px] block">Tiền chợ tham khảo:</span>
                    <span className="font-bold text-[#481620] text-sm">{formatVND(dish.estimatedCost)}</span>
                  </div>

                  <button
                    onClick={() => setSelectedDishDetail(dish)}
                    className="text-xs text-[#62625C] hover:text-[#481620] underline"
                  >
                    Xem nguyên liệu
                  </button>
                </div>

                <button
                  onClick={() => handleToggleDish(dish)}
                  className={`w-full py-2 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#481620] text-white shadow-xs'
                      : 'bg-[#F0FFF6] hover:bg-[#481620] text-[#481620] hover:text-white'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#60D5AE]" />
                      <span>Đã thêm vào thực đơn</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Thêm món này</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredDishes.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E5E5DC] space-y-3">
          <Utensils className="w-10 h-10 text-[#62625C] mx-auto opacity-50" />
          <h3 className="font-bold text-[#333333]">Không tìm thấy món ăn phù hợp</h3>
          <p className="text-xs text-[#62625C]">Hãy thử đổi từ khóa tìm kiếm hoặc bỏ chọn các bộ lọc phân loại.</p>
        </div>
      )}

      {/* Dish Detail Modal */}
      {selectedDishDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-[#FFFFFF] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#E5E5DC] max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative aspect-16/9 bg-stone-100">
              <ImageWithFallback
                src={selectedDishDetail.imageUrl}
                alt={selectedDishDetail.name}
                fallbackType="dish"
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedDishDetail(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div>
                <h3 className="font-bold text-lg text-[#333333]">{selectedDishDetail.name}</h3>
                <p className="text-xs text-[#62625C] mt-1">{selectedDishDetail.description}</p>
              </div>

              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#481620] mb-2">
                  Danh sách nguyên liệu ước tính khi đi chợ:
                </h4>
                <div className="bg-white rounded-xl border border-[#E5E5DC] divide-y divide-[#E5E5DC] text-xs">
                  {selectedDishDetail.ingredients.map((ing) => (
                    <div key={ing.id} className="p-2.5 flex justify-between items-center">
                      <div>
                        <span className="font-medium text-[#333333]">{ing.name}</span>
                        <span className="text-[#62625C] ml-1">({ing.estimatedQuantity} {ing.unit})</span>
                      </div>
                      <span className="font-semibold text-[#481620]">{formatVND(ing.estimatedPrice)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#F0FFF6] rounded-xl border border-[#60D5AE]/50 text-xs text-[#481620] flex items-center justify-between">
                <span>Tổng tiền chợ ước tính cho món này:</span>
                <span className="font-bold text-sm">{formatVND(selectedDishDetail.estimatedCost)}</span>
              </div>
            </div>

            <div className="p-4 bg-stone-50 border-t border-[#E5E5DC] flex justify-end gap-2">
              <button
                onClick={() => setSelectedDishDetail(null)}
                className="px-4 py-2 border border-[#E5E5DC] bg-white text-xs font-semibold rounded-lg"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  handleToggleDish(selectedDishDetail);
                  setSelectedDishDetail(null);
                }}
                className="px-4 py-2 bg-[#481620] text-white text-xs font-semibold rounded-lg"
              >
                {selectedItems.some((i) => i.dish.id === selectedDishDetail.id)
                  ? 'Bỏ chọn món'
                  : 'Thêm vào thực đơn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
