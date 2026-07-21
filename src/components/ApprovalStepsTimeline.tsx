// ─── ApprovalStepsTimeline ──────────────────────────────────────────────────
// Hiển thị tiến trình duyệt nhiều cấp (tuần tự theo order)
// Chỉ bước đang chờ (pending, index đầu tiên) được phép thao tác

import React from 'react';
import { CheckCircle, XCircle, Clock, UserCheck, Lock } from 'lucide-react';
import { ApprovalStep } from '../types';

interface ApprovalStepsTimelineProps {
  steps: ApprovalStep[];
  currentUserId?: string;
  canApprove?: boolean; // User hiện tại có quyền duyệt bước này không (do parent tính)
  onApprove?: (stepId: string) => void;
  onReject?: (stepId: string) => void;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG = {
  approved: { color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle, label: 'Đã duyệt' },
  rejected: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', icon: XCircle, label: 'Từ chối' },
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', icon: Clock, label: 'Chờ duyệt' },
} as const;

export default function ApprovalStepsTimeline({
  steps,
  currentUserId,
  canApprove,
  onApprove,
  onReject,
  size = 'md',
}: ApprovalStepsTimelineProps) {
  if (!steps || steps.length === 0) return null;

  // Index của bước đang chờ duyệt tiếp theo (chỉ bước này được thao tác)
  const nextPendingIdx = steps.findIndex(s => s.status === 'pending');

  return (
    <div className="space-y-2">
      {steps.map((step, idx) => {
        const cfg = STATUS_CONFIG[step.status];
        const Icon = cfg.icon;
        const isActive = idx === nextPendingIdx; // bước đang mở để duyệt
        // User có thể duyệt bước này nếu: bước đang active, user là approver, và (canApprove không bị ép false)
        const canActOnThis = isActive && step.approverId === currentUserId && (canApprove !== false);

        return (
          <div
            key={step.id}
            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${cfg.bg} ${
              isActive ? 'ring-1 ring-amber-400/50' : ''
            }`}
          >
            {/* Status icon */}
            <div className={`shrink-0 ${cfg.color}`}>
              <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <div className={`font-bold text-slate-200 ${size === 'sm' ? 'text-[11px]' : 'text-xs'}`}>
                {step.levelName}
              </div>
              {step.notes && (
                <div className="text-[9px] text-slate-500 mt-0.5">{step.notes}</div>
              )}
              {step.updatedAt && step.status !== 'pending' && (
                <div className="text-[9px] text-slate-600 mt-0.5">
                  {new Date(step.updatedAt).toLocaleString('vi-VN')}
                </div>
              )}
            </div>

            {/* Action buttons - chỉ bước đang active & user là approver */}
            {canActOnThis && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onApprove?.(step.id)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1"
                >
                  <UserCheck className="w-3 h-3" /> Duyệt
                </button>
                <button
                  onClick={() => onReject?.(step.id)}
                  className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg transition-colors"
                >
                  Từ chối
                </button>
              </div>
            )}

            {/* Lock indicator cho bước chưa tới lượt */}
            {!isActive && step.status === 'pending' && (
              <Lock className="w-3.5 h-3.5 text-slate-600 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
