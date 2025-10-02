import React, { useEffect, useRef } from 'react';
import { WarningIcon, XMarkIcon } from './IconComponents';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      modalRef.current?.focus();
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    onConfirm();
    onClose(); // Close modal after confirming
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 animate-fade-in-fast"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-theme-surface rounded-xl shadow-2xl w-full max-w-md border border-theme-border transform animate-scale-in"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
      >
        <div className="flex items-start justify-between p-6 border-b border-theme-border">
            <div className="flex items-center">
                <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-theme-destructive/20 sm:mx-0 sm:h-10 sm:w-10">
                    <WarningIcon className="h-6 w-6 text-red-400" />
                </div>
                <h3 id="modal-title" className="text-xl font-bold text-white ml-4">
                    {title}
                </h3>
            </div>
            <button
                onClick={onClose}
                className="p-1 text-theme-text-secondary rounded-full hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
        </div>
        <div className="p-6">
          <p className="text-theme-text-secondary">{message}</p>
        </div>
        <div className="bg-black/20 px-6 py-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 rounded-b-xl">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-theme-border shadow-sm px-4 py-2 bg-transparent text-base font-medium text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-surface focus:ring-gray-500 sm:mt-0 sm:w-auto sm:text-sm transition-colors"
            onClick={onClose}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-theme-destructive text-base font-medium text-white hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-theme-surface focus:ring-theme-destructive sm:mt-0 sm:w-auto sm:text-sm transition-colors mt-3 sm:mt-0"
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>{`
          .animate-fade-in-fast { animation: fadeIn 0.2s ease-out forwards; }
          .animate-scale-in { animation: scaleIn 0.2s ease-out forwards; }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
};