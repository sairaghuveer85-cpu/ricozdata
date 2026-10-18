import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTour } from '../../context/TourContext';
import SpotlightOverlay from './SpotlightOverlay';
import TourTooltip from './TourTooltip';
import WelcomePopover from './WelcomePopover';

export default function ContextualTour() {
  const location = useLocation();
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    isWelcomeOpen,
    isActive,
    startTour,
    dismissWelcome,
    nextStep,
    prevStep,
    skipTour,
  } = useTour();

  const [targetRect, setTargetRect] = useState(null);
  const checkTimerRef = useRef(null);

  // Diagnostic log on mount
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[Tour Diagnostics] ContextualTour mounted in MainLayout viewport.');
    }
  }, []);

  // Find and track the target element's bounding rect
  const updateTargetRect = useCallback(() => {
    if (!isActive || !currentStep?.targetSelector) {
      setTargetRect(null);
      return;
    }

    const selectors = currentStep.targetSelector.split(',').map((s) => s.trim());
    let element = null;

    for (const selector of selectors) {
      element = document.querySelector(selector);
      if (element) break;
    }

    if (element) {
      const rect = element.getBoundingClientRect();
      // Ensure the element is actually laid out and visible
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right,
        });
        return;
      }
    }

    // Element not found or not yet sized
    setTargetRect(null);
  }, [isActive, currentStep]);

  // Recalculate on step, route change, scroll, and resize
  useEffect(() => {
    if (!isActive) {
      setTargetRect(null);
      return;
    }

    // Initial check
    updateTargetRect();

    // Re-check after slight delay to allow page rendering/animations to complete
    checkTimerRef.current = setTimeout(updateTargetRect, 180);

    const handleScrollOrResize = () => {
      requestAnimationFrame(updateTargetRect);
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize);

    // Mutation observer for dynamically rendered elements (tables, data sources)
    const observer = new MutationObserver(() => {
      requestAnimationFrame(updateTargetRect);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-tour'],
    });

    return () => {
      clearTimeout(checkTimerRef.current);
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
      observer.disconnect();
    };
  }, [isActive, currentStep, location.pathname, updateTargetRect]);

  // Welcome Popover takes precedence when user first enters
  if (isWelcomeOpen) {
    return <WelcomePopover onStart={startTour} onDismiss={dismissWelcome} />;
  }

  // Active tour step
  if (isActive && currentStep) {
    return (
      <>
        <SpotlightOverlay targetRect={targetRect} onDismiss={skipTour} />
        <TourTooltip
          step={currentStep}
          currentStepIndex={currentStepIndex}
          totalSteps={totalSteps}
          targetRect={targetRect}
          onNext={nextStep}
          onBack={prevStep}
          onSkip={skipTour}
          onClose={skipTour}
        />
      </>
    );
  }

  return null;
}
