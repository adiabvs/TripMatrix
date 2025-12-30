'use client';

import { useEffect, useRef } from 'react';
import { MdClose } from 'react-icons/md';

interface BottomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export default function BottomModal({ 
  isOpen, 
  onClose, 
  title, 
  children,
  maxHeight = '90vh'
}: BottomModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 flex items-end justify-center bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        style={{ 
          animation: 'fadeIn 0.2s ease-out',
          zIndex: 99999,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          WebkitTransform: 'translateZ(0)',
          transform: 'translateZ(0)',
          isolation: 'isolate', // Create new stacking context
          willChange: 'transform', // Optimize for iOS
        }}
      >
        <div
          ref={modalRef}
          className="w-full max-w-[600px] bg-black rounded-t-3xl shadow-2xl flex flex-col"
          style={{ 
            maxHeight,
            animation: 'slideUpFromBottom 0.3s ease-out',
            position: 'relative',
            zIndex: 100000,
            WebkitTransform: 'translateZ(0)',
            transform: 'translateZ(0)',
            isolation: 'isolate', // Create new stacking context
            willChange: 'transform', // Optimize for iOS
            WebkitBackfaceVisibility: 'hidden', // Fix iOS rendering issues
            backfaceVisibility: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          </div>

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-full transition-colors active:scale-95"
                aria-label="Close"
              >
                <MdClose className="w-6 h-6 text-white" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </>
  );
}

