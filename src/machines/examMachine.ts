import { useState } from 'react';

// 9 Steps as defined in Epic 3
export type ExamStep = 
  | 'context'            // Gathering context / what to test
  | 'question'           // AI asks the question
  | 'student_answer'     // Student gives Answer
  | 'evaluation'         // AI evaluates (Green/Amber/Red)
  | 'hooks_generation'   // AI generates the Concept Hooks reasoning
  | 'hooks_review'       // UI shows Hooks
  | 'carousel_generation'// Building the visual media
  | 'carousel_playback'  // Playing the Carousel recap
  | 'next_question'      // Loop branch
  | 'complete';          // Session finished

export function useExamMachine(initialStep: ExamStep = 'context') {
  const [step, setStep] = useState<ExamStep>(initialStep);

  const nextStep = () => {
    setStep((current) => {
      switch (current) {
        case 'context': return 'question';
        case 'question': return 'student_answer';
        case 'student_answer': return 'evaluation';
        // Evaluation paths: evaluation -> hooks_generation -> hooks_review -> carousel_generation -> carousel_playback -> next_question
        case 'evaluation': return 'hooks_generation';
        case 'hooks_generation': return 'hooks_review';
        case 'hooks_review': return 'carousel_generation';
        case 'carousel_generation': return 'carousel_playback';
        case 'carousel_playback': return 'next_question';
        case 'next_question': return 'question'; // Loops back to asking a question
        default: return current;
      }
    });
  };

  const jumpToStep = (target: ExamStep) => {
    setStep(target);
  };

  return { 
    step, 
    nextStep, 
    jumpToStep,
    isComplete: step === 'complete'
  };
}
