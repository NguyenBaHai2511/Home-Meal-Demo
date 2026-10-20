import React from 'react';
import { ShoppingEvidenceItem } from '../../types';
import { formatVND } from '../../utils/pricing';
import { X, CheckCircle, Store, Calendar, FileText } from 'lucide-react';
import { ImageWithFallback } from './ImageWithFallback';

interface EvidenceModalProps {
  item: ShoppingEvidenceItem | null;
  onClose: () => void;
}

export const EvidenceModal: React.FC<EvidenceModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-[#FFFDF7] rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[#E5ECE7] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E5ECE7] flex items-center justify-between bg-white">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-[#E7F5EF] text-[#285E56]">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-[#263B35] text-base sm:text-lg">{item.name}</h3>
              <p className="text-xs text-[#738078]">Chứng từ mua sắm nguyên liệu thực tế</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#738078] hover:text-[#263B35] hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Photos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-[#285E56] mb-1.5">Ảnh hóa đơn / Biên lai tính tiền:</p>
              <div className="aspect-4/3 rounded-xl overflow-hidden border border-[#E5ECE7] bg-stone-50">
                <ImageWithFallback
                  src={item.receiptImageUrl || 'https://images.unsplash.com/photo-1554415707-9e44667ff221?auto=format&fit=crop&w=600&q=80'}
                  alt={`Hóa đơn ${item.name}`}
                  fallbackType="receipt"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#285E56] mb-1.5">Ảnh nguyên liệu / Sạp mua:</p>
              <div className="aspect-4/3 rounded-xl overflow-hidden border border-[#E5ECE7] bg-stone-50">
                <ImageWithFallback
                  src={item.ingredientImageUrl || item.receiptImageUrl || 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&q=80'}
                  alt={`Nguyên liệu ${item.name}`}
                  fallbackType="dish"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Details breakdown */}
          <div className="bg-[#E7F5EF]/60 rounded-xl p-4 border border-[#B8E4D3]/40 space-y-2.5 text-xs sm:text-sm">
            <div className="flex justify-between items-center py-1 border-b border-[#E5ECE7]">
              <span className="text-[#738078] flex items-center gap-1.5">
                <Store className="w-4 h-4 text-[#285E56]" /> Địa điểm mua:
              </span>
              <span className="font-semibold text-[#263B35]">{item.storeName || 'Chợ truyền thống'}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5ECE7]">
              <span className="text-[#738078] flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#285E56]" /> Thời gian mua sắm:
              </span>
              <span className="font-semibold text-[#263B35]">{item.purchaseTime}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5ECE7]">
              <span className="text-[#738078]">Khối lượng thực mua:</span>
              <span className="font-semibold text-[#263B35]">{item.quantity} {item.unit}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5ECE7]">
              <span className="text-[#738078]">Đơn giá ước tính ban đầu:</span>
              <span className="text-[#738078] line-through">{formatVND(item.estimatedPrice)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-[#E5ECE7]">
              <span className="text-[#285E56] font-semibold">Giá thực mua trên hóa đơn:</span>
              <span className="font-bold text-[#285E56] text-base">{formatVND(item.actualPrice)}</span>
            </div>
            {item.notes && (
              <div className="pt-1">
                <span className="text-[#738078] block mb-1">Ghi chú của đầu bếp:</span>
                <p className="p-2.5 bg-white rounded-lg border border-[#E5ECE7] text-xs text-[#263B35] italic">
                  "{item.notes}"
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-[#E5ECE7] text-xs text-[#285E56]">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Chứng từ này được đính kèm vào hóa đơn cuối cùng. Bạn chỉ thanh toán đúng số tiền thực chi này.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-[#E5ECE7] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#285E56] text-white text-xs sm:text-sm font-semibold rounded-lg hover:bg-[#1f4b44]"
          >
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
};
