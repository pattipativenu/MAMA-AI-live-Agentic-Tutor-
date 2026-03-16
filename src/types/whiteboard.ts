/**
 * Whiteboard feature types
 * Used for AI-powered step-by-step formula explanations
 */

export interface WhiteboardStep {
  id: string;
  math: string;           // LaTeX formula
  explanation: string;    // Plain text explanation
  decode: string;         // Symbol definitions (optional)
  status: 'pending' | 'typing' | 'complete';
  spokenText?: string;    // Accumulated transcript for this step (for audio sync)
  isSpeaking?: boolean;   // Whether AI is currently speaking this step
  highlightedTerms?: string[]; // Terms to highlight in orange when AI references them
}

export interface WhiteboardState {
  isActive: boolean;
  isPending?: boolean;           // Whiteboard area visible but first step not yet received
  problemTitle: string;
  steps: WhiteboardStep[];
  currentStepIndex: number;
  isTyping: boolean;
  highlightedStepIndex?: number; // Which step is currently highlighted/focused
}

export interface ParsedWhiteboardContent {
  isWhiteboardStart: boolean;
  isWhiteboardEnd: boolean;
  problemTitle: string | null;
  newStep: WhiteboardStep | null;
  displayText: string;    // Clean text without markers
}

// NEW SIMPLIFIED Marker constants
// Format: [[WB:Title]], [[MATH:formula]], [[EXPLAIN:text]], [[END]]
export const WB_MARKERS = {
  // Start marker: [[WB:Problem Title]]
  START: '[[WB:',
  // End marker: [[END]]
  END: '[[END]]',
  // Math marker: [[MATH:formula]]
  MATH_START: '[[MATH:',
  MATH_END: ']]',
  // Explain marker: [[EXPLAIN:text]]
  EXPLAIN_START: '[[EXPLAIN:',
  EXPLAIN_END: ']]',
  // Legacy support
  LEGACY_START: '[[WB_START:',
  LEGACY_END: '[[WB_END]]',
  LEGACY_STEP: '[[STEP]]',
} as const;

export const DEFAULT_WHITEBOARD_STATE: WhiteboardState = {
  isActive: false,
  problemTitle: '',
  steps: [],
  currentStepIndex: -1,
  isTyping: false,
};
