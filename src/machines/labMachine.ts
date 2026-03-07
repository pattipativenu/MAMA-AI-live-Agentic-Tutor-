import { useState } from 'react';

// 7 Phases as defined centrally in Epic 3
export type LabPhase = 
  | 'equipment_check' // Checking if they have materials
  | 'guidance'        // Instruction/Setup
  | 'experiment'      // Doing the activity (Result observation)
  | 'analysis'        // Chatting about why it happened
  | 'carousel_gen'    // Building the media for review
  | 'carousel_play'   // Playing the Carousel
  | 'quiz'            // Post-carousel test
  | 'complete';

export function useLabMachine(initialPhase: LabPhase = 'equipment_check') {
  const [phase, setPhase] = useState<LabPhase>(initialPhase);

  const nextPhase = () => {
    setPhase((current) => {
      switch (current) {
        case 'equipment_check': return 'guidance';
        case 'guidance': return 'experiment';
        case 'experiment': return 'analysis';
        case 'analysis': return 'carousel_gen';
        case 'carousel_gen': return 'carousel_play';
        case 'carousel_play': return 'quiz';
        case 'quiz': return 'complete';
        default: return current;
      }
    });
  };

  const jumpToPhase = (target: LabPhase) => {
    setPhase(target);
  };

  return { 
    phase, 
    nextPhase, 
    jumpToPhase,
    isComplete: phase === 'complete'
  };
}
