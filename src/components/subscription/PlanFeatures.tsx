import React from 'react';
import { Check, X } from 'lucide-react';
import type { SubscriptionPlan } from '../../lib/subscriptionClient';

// DANH SÁCH QUYỀN LỢI CỦA GÓI — dùng chung ở bảng giá (trang giới thiệu), trang gia hạn và cửa sổ gói trong ERP.
// Dòng đầu luôn là giới hạn nhân viên (dữ liệu thật, hệ thống tự kiểm soát); các dòng sau do quản trị nền tảng soạn ở
// tab "Gói dịch vụ": ✓ = được nhận, ✗ (gạch mờ) = không có trong gói này.
export default function PlanFeatures({ plan, compact = false }: { plan: Pick<SubscriptionPlan, 'maxEmployees' | 'features'>; compact?: boolean }) {
  const features = plan.features || [];
  const size = compact ? 'text-xs' : 'text-sm';
  return (
    <ul className={`space-y-1.5 ${size}`}>
      <li className="flex items-start gap-2 text-slate-800 font-semibold">
        <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
        <span>{plan.maxEmployees === null ? 'Không giới hạn số nhân viên' : `Tối đa ${plan.maxEmployees} nhân viên`}</span>
      </li>
      {features.map((f, i) => (
        <li key={i} className={`flex items-start gap-2 ${f.included ? 'text-slate-700' : 'text-slate-400'}`}>
          {f.included
            ? <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
            : <X className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" aria-hidden />}
          <span className={f.included ? '' : 'line-through decoration-slate-300'}>
            {f.text}
            <span className="sr-only">{f.included ? ' (có)' : ' (không có)'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
