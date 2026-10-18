import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './AppContext';
import { TOUR_STEPS } from '../components/tour/tourSteps';

const TourContext = createContext(null);

export function TourProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, currentUser } = useApp();

  const [isWelcomeOpen, setIsWelcomeOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Stable user identifier resolution
  const stableUserId = useMemo(() => {
    if (!isAuthenticated || !currentUser?.isAuthenticated) return null;
    return currentUser.id || currentUser._id || (currentUser.email ? `email_${currentUser.email}` : null);
  }, [isAuthenticated, currentUser]);

  const storageKey = stableUserId ? `ricoz_tour_state_${stableUserId}` : null;

  // Load and react to user onboarding state changes
  useEffect(() => {
    if (!stableUserId || !storageKey) {
      setIsWelcomeOpen(false);
      setIsActive(false);
      if (import.meta.env.DEV) {
        console.log('[Tour Diagnostics] Auth check: User identity not yet available. Tour waiting.');
      }
      return;
    }

    try {
      const raw = localStorage.getItem(storageKey);
      let userState = null;
      if (raw) {
        try {
          userState = JSON.parse(raw);
        } catch {
          userState = null;
        }
      }

      if (import.meta.env.DEV) {
        console.log('[Tour Diagnostics] Initializing for user:', stableUserId, '| Saved State:', userState);
      }

      if (!userState || !userState.status || userState.status === 'not_started') {
        // Brand new account on this browser: show welcome popover
        setIsWelcomeOpen(true);
        setIsActive(false);
        if (import.meta.env.DEV) {
          console.log('[Tour Diagnostics] Brand-new user detected. Showing Welcome Popover.');
        }
      } else if (userState.status === 'dismissed' || userState.status === 'completed') {
        // Previously dismissed or completed: do not interrupt
        setIsWelcomeOpen(false);
        setIsActive(false);
        if (import.meta.env.DEV) {
          console.log(`[Tour Diagnostics] Tour previously ${userState.status}. Skipping welcome popover.`);
        }
      } else if (userState.status === 'in_progress') {
        const savedStep = typeof userState.stepIndex === 'number' ? userState.stepIndex : 0;
        const step = Math.min(Math.max(savedStep, 0), TOUR_STEPS.length - 1);
        setCurrentStepIndex(step);
        setIsWelcomeOpen(false);
        setIsActive(true);
      }
    } catch (err) {
      console.warn('[Tour Diagnostics] Failed to read tour state from storage:', err);
    }
  }, [stableUserId, storageKey]);

  // Persist state helper
  const saveState = useCallback((status, stepIndex = 0) => {
    if (!storageKey) return;
    try {
      const payload = {
        status,
        stepIndex,
        userId: stableUserId,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
      if (import.meta.env.DEV) {
        console.log('[Tour Diagnostics] State saved:', payload);
      }
    } catch (err) {
      console.warn('[Tour Diagnostics] Failed to write tour state:', err);
    }
  }, [storageKey, stableUserId]);

  // Actions
  const startTour = useCallback(() => {
    setIsWelcomeOpen(false);
    setIsActive(true);
    setCurrentStepIndex(0);
    saveState('in_progress', 0);

    const firstStep = TOUR_STEPS[0];
    if (firstStep && location.pathname !== firstStep.route) {
      navigate(firstStep.route);
    }
  }, [saveState, location.pathname, navigate]);

  const dismissWelcome = useCallback(() => {
    setIsWelcomeOpen(false);
    setIsActive(false);
    saveState('dismissed', 0);
    if (import.meta.env.DEV) {
      console.log('[Tour Diagnostics] Welcome popover dismissed by user ("Maybe later").');
    }
  }, [saveState]);

  const nextStep = useCallback(() => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      const nextIdx = currentStepIndex + 1;
      setCurrentStepIndex(nextIdx);
      saveState('in_progress', nextIdx);

      const targetRoute = TOUR_STEPS[nextIdx].route;
      if (targetRoute && location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
    } else {
      // Completed all steps
      setIsActive(false);
      saveState('completed', TOUR_STEPS.length);
      if (import.meta.env.DEV) {
        console.log('[Tour Diagnostics] Tour finished successfully.');
      }
    }
  }, [currentStepIndex, saveState, location.pathname, navigate]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      const prevIdx = currentStepIndex - 1;
      setCurrentStepIndex(prevIdx);
      saveState('in_progress', prevIdx);

      const targetRoute = TOUR_STEPS[prevIdx].route;
      if (targetRoute && location.pathname !== targetRoute) {
        navigate(targetRoute);
      }
    }
  }, [currentStepIndex, saveState, location.pathname, navigate]);

  const skipTour = useCallback(() => {
    setIsActive(false);
    setIsWelcomeOpen(false);
    saveState('completed', currentStepIndex);
    if (import.meta.env.DEV) {
      console.log('[Tour Diagnostics] Tour skipped by user.');
    }
  }, [currentStepIndex, saveState]);

  const restartTour = useCallback(() => {
    setIsWelcomeOpen(false);
    setIsActive(true);
    setCurrentStepIndex(0);
    saveState('in_progress', 0);

    const firstStep = TOUR_STEPS[0];
    if (firstStep && location.pathname !== firstStep.route) {
      navigate(firstStep.route);
    }
  }, [saveState, location.pathname, navigate]);

  const value = {
    steps: TOUR_STEPS,
    currentStep: TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0],
    currentStepIndex,
    totalSteps: TOUR_STEPS.length,
    isWelcomeOpen,
    isActive,
    stableUserId,
    startTour,
    dismissWelcome,
    nextStep,
    prevStep,
    skipTour,
    restartTour,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}
