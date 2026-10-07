import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemType: 'charger' | 'site';
  itemId: string;
  itemName: string;
  warningText?: string;
  onConfirm: () => Promise<void> | void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onClose,
  title,
  itemType,
  itemId,
  itemName,
  warningText,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Error during deletion:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const defaultWarning =
    itemType === 'charger'
      ? `Permanently decommission EV charger ${itemId}. This will disconnect the station from CPMS, terminate active connections, and remove the charger record from the database.`
      : `Permanently decommission site "${itemName}". All electrical configuration and grid limits for this facility will be removed.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="confirm-delete-modal"
        className="w-full max-w-md bg-white border border-rose-200 rounded-2xl shadow-2xl overflow-hidden text-slate-800 space-y-4 animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-rose-100 bg-rose-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-100 text-rose-700 border border-rose-200">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm tracking-tight">{title}</h3>
              <p className="text-xs text-rose-700">Permanent Decommissioning Confirmation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn-3d btn-3d-white p-1 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-2 space-y-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 font-mono">
            <div className="flex justify-between text-slate-500">
              <span>{itemType === 'charger' ? 'CHARGER ID:' : 'SITE ID:'}</span>
              <span className="font-bold text-slate-900">{itemId}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>NAME:</span>
              <span className="font-bold text-slate-900 truncate max-w-[200px]">{itemName}</span>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-50/80 border border-rose-200 text-rose-900 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-950">Are you sure you want to proceed?</p>
              <p className="text-[11px] text-rose-800">{warningText || defaultWarning}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="btn-3d btn-3d-white px-4 py-2 text-xs font-bold text-slate-700 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="btn-3d btn-3d-rose px-4 py-2 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Decommissioning...' : `Decommission & Delete ${itemType === 'charger' ? 'Charger' : 'Site'}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
