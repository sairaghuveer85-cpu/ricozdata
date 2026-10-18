import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X, ChevronRight, ChevronLeft, Compass, Check } from 'lucide-react';
import Button from '../common/Button';

export default function TourTooltip({
  step,
  currentStepIndex,
  totalSteps,
  targetRect,
  onNext,
  onBack,
  onSkip,
  onClose,
}) {
  const tooltipRef = useRef(null);
  const [position, setPosition] = useState({ top: 100, left: 100 });
  const [placedAbove, setPlacedAbove] = useState(false);

  // Calculate and clamp tooltip position
  useLayoutEffect(() => {
    if (!tooltipRef.current) return;

    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl.offsetWidth || 320;
    const tooltipHeight = tooltipEl.offsetHeight || 160;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const offset = 14;

    if (!targetRect) {
      // Fallback: bottom-right anchored
      setPosition({
        top: Math.max(margin, viewportHeight - tooltipHeight - 24),
        left: Math.max(margin, viewportWidth - tooltipWidth - 24),
      });
      setPlacedAbove(false);
      return;
    }

    let top = 0;
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
    let isAbove = false;

    if (step.placement === 'top') {
      top = targetRect.top - tooltipHeight - offset;
      isAbove = true;
      if (top < margin) {
        // Flip to bottom if clipping top
        top = targetRect.bottom + offset;
        isAbove = false;
      }
    } else {
      top = targetRect.bottom + offset;
      isAbove = false;
      if (top + tooltipHeight > viewportHeight - margin) {
        // Flip to top if clipping bottom
        top = targetRect.top - tooltipHeight - offset;
        isAbove = true;
      }
    }

    // Clamp horizontally
    left = Math.max(margin, Math.min(viewportWidth - tooltipWidth - margin, left));
    // Clamp vertically
    top = Math.max(margin, Math.min(viewportHeight - tooltipHeight - margin, top));

    setPosition({ top, left });
    setPlacedAbove(isAbove);
  }, [targetRect, step]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
      ) {
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault();
        onNext();
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0 && onBack) {
        e.preventDefault();
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNext, onBack, currentStepIndex]);

  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <aside
      ref={tooltipRef}
      role="dialog"
      aria-label={`Product Tour Step ${currentStepIndex + 1} of ${totalSteps}: ${step.title}`}
      className="fixed z-[850] w-[calc(100vw-2rem)] max-w-[340px] rounded-xl border p-4 shadow-2xl transition-all duration-150 ease-out animate-in fade-in zoom-in-95"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        backgroundColor: 'var(--color-surface, #FFFFFF)',
        borderColor: 'var(--color-border, #E2E8F0)',
        color: 'var(--color-text-primary, #111827)',
      }}
    >
      {/* Header with Step Counter and Close */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
          <Compass className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Step {currentStepIndex + 1} of {totalSteps}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close tour"
          className="p-1 -mr-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white mb-1">
        {step.title}
      </h3>

      {/* Description in simple English */}
      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
        {step.description}
      </p>

      {/* Footer Actions */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1">
          {currentStepIndex > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={onBack}
              icon={ChevronLeft}
            >
              Back
            </Button>
          )}
          <button
            type="button"
            onClick={onSkip}
            className="text-[11px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:underline px-1 py-1 rounded cursor-pointer transition-colors"
          >
            Skip tour
          </button>
        </div>

        <Button
          type="button"
          variant="primary"
          size="xs"
          onClick={onNext}
          icon={isLast ? Check : ChevronRight}
        >
          {isLast ? 'Finish tour' : 'Next'}
        </Button>
      </div>
    </aside>
  );
}
