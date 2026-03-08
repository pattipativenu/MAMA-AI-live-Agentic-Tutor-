import { useState } from 'react';

// 10 steps as defined in Epic 3
export type ExamStep =
  | 'context'             // Gathering context / what to test
  | 'question'            // AI asks the question
  | 'student_answer'      // Student gives Answer
  | 'evaluation'          // AI evaluates (Green/Amber/Red)
  | 'hooks_generation'    // AI generates the Concept Hooks reasoning
  | 'hooks_review'        // UI shows Hooks
  | 'carousel_generation' // Building the visual media
  | 'carousel_playback'   // Playing the Carousel recap
  | 'next_question'       // Loop branch
  | 'complete';           // Session finished

/**
 * Pure synchronous helper — returns the step that follows `current`.
 * Call this directly whenever you need to know the next step without
 * triggering a state update (e.g. for side-effects in ExamEntry).
 */
export function getNextStep(current: ExamStep): ExamStep {
  switch (current) {
    case 'context':             return 'question';
    case 'question':            return 'student_answer';
    case 'student_answer':      return 'evaluation';
    case 'evaluation':          return 'hooks_generation';
    case 'hooks_generation':    return 'hooks_review';
    case 'hooks_review':        return 'carousel_generation';
    case 'carousel_generation': return 'carousel_playback';
    case 'carousel_playback':   return 'next_question';
    case 'next_question':       return 'question';
    default:                    return current;
  }
}

export function useExamMachine(initialStep: ExamStep = 'context') {
  const [step, setStep] = useState<ExamStep>(initialStep);

  // Always uses the latest state (updater form) — safe to call in rapid succession.
  const nextStep = () => setStep((current) => getNextStep(current));

  const jumpToStep = (target: ExamStep) => setStep(target);

  return {
    step,
    nextStep,
    jumpToStep,
    isComplete: step === 'complete',
  };
}
