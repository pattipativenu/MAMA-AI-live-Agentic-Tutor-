import { GoogleGenAI } from '@google/genai';

// Initialize the SDK using the Vite environment variable
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY
});

// ── Audience calibration ──────────────────────────────────────────────────────

function getAudienceNote(age: string): string {
  const lower = age.toLowerCase();
  const isYoung =
    /class [5-7]|grade [5-7]|[1][0-2] year/.test(lower);
  const isSenior =
    /class 1[12]|grade 1[12]|1[78] year/.test(lower);

  if (isYoung) {
    return `Visual complexity calibrated for a ${age} student — use simple, bold shapes and fun analogies. Avoid complex formulas. Big forms, bright colours, and clear cause-and-effect relationships only.`;
  }
  if (isSenior) {
    return `Visual complexity calibrated for a ${age} student — include precise annotations, relevant mathematical notation, vector diagrams, and the technical accuracy expected at advanced-study level.`;
  }
  return `Visual complexity calibrated for a ${age} student — balance visual clarity with moderate technical detail, labelled diagrams, and clear relational indicators.`;
}

// ── Subject-aware visual guidance ────────────────────────────────────────────

function getSubjectVisualNote(concept: string): string {
  const c = concept.toLowerCase();
  if (/cell|organ|muscle|nerve|blood|tissue|anatomy|physiology|plant|animal|dna|protein|enzyme|mitosis|meiosis|respiration|photosynthesis/.test(c)) {
    return 'Biology/anatomy style: photorealistic or semi-realistic subject with a warm anatomical colour palette (cream/rose for tissue, blue for veins and water flow, yellow for nerves and energy signals). Include at least one circular or rectangular zoom-inset callout showing the micro-level detail of the key structure, connected with a clean line or arrow to the macro view.';
  }
  if (/atom|molecule|bond|reaction|electron|orbital|crystal|ionic|covalent|periodic|element|compound|acid|base|polymer|solution/.test(c)) {
    return 'Chemistry style: precise 3D molecular or atomic structure with CPK colour-coded atoms (red=oxygen, light-grey=hydrogen, dark-grey=carbon, blue=nitrogen), clean visible bond lines. Use a white background for molecular diagrams or a dark dramatic backdrop for quantum/orbital concepts.';
  }
  if (/force|wave|light|electric|magnetic|quantum|energy|momentum|optic|circuit|current|gravity|motion|velocity|acceleration|thermodynamic|fluid/.test(c)) {
    return 'Physics style: bold directional arrows for forces and fields, vibrant colour-coded field lines, precise geometric diagrams with vector annotations and magnitude labels. Use a dark background for electromagnetic/quantum topics, white for classical mechanics/optics.';
  }
  if (/triangle|circle|graph|function|calculus|algebra|geometry|theorem|equation|proof|matrix|vector|set|probability|statistics/.test(c)) {
    return 'Mathematics style: clean white or faint grid background, precise geometric construction with a compass-and-ruler aesthetic, colour-coded elements (navy blue=primary object, red=derived or measured, green=known or given), inline mathematical notation. No decorative clutter.';
  }
  return 'Include clear functional colour-coding, purposeful annotation arrows with labels, and at least one zoom-inset callout if the concept has both a macro view and a micro or molecular detail worth showing side-by-side.';
}

// ── Per-theme art direction ───────────────────────────────────────────────────

const THEME_DIRECTIONS: Record<
  string,
  { style: string; lighting: string; composition: string }
> = {
  realistic: {
    style:
      'A highly detailed scientific illustration rendered with the precision of a premium university press textbook — clean, professional, and pedagogically exact. Think a high-quality Nature or National Geographic educational spread.',
    lighting:
      'Soft, diffused studio lighting with gentle highlights that reveal depth and texture without harsh shadows. Subtle ambient occlusion adds dimensionality.',
    composition:
      'Composed as a clear educational diagram on a clean white or light-grey background. For complex topics, use a multi-panel layout: one main wide-view illustration plus one or two circular or rectangular zoom-inset callouts revealing key micro-level or cross-sectional detail. For comparative concepts (healthy vs. diseased, before vs. after), use a split-panel side-by-side layout. Elements are well-spaced, functionally colour-coded, and accompanied by crisp annotation arrows and clean label lines that walk the viewer through the concept step by step.',
  },
  space: {
    style:
      'A breathtaking sci-fi visualisation in the style of award-winning NASA concept art — vibrant neon-cyan energy lines, luminous particle streams, and deep cosmic blues and purples that radiate discovery and wonder.',
    lighting:
      'Dramatic bioluminescent glow emanating from the central subject, with volumetric light shafts cutting through a deep starfield and high-contrast rim lighting defining every element against the dark cosmos.',
    composition:
      'Wide cinematic shot framing the concept against an infinite star-field. Bold geometric energy patterns and glowing orbital paths radiate outward from the focal point, creating a sense of vast scale.',
  },
  anime: {
    style:
      'A richly detailed Studio Ghibli-inspired illustration with lush cel-shading, expressive clean line work, and a warm, inviting colour palette of soft ambers, teals, and creamy whites.',
    lighting:
      'Warm golden-hour diffused sunlight with soft dappled shadows and a subtle lens flare — creating a gentle, approachable, and slightly magical atmosphere that makes learning feel like an adventure.',
    composition:
      'Medium shot with a beautifully hand-painted soft-bokeh background, placing the educational concept as the charming focal point. Delicate motion lines and sparkle effects add life.',
  },
  historical: {
    style:
      'A meticulous vintage scientific journal illustration rendered as if drawn by Leonardo da Vinci in his personal notebook — rich sepia ink-wash tones, careful cross-hatching, and the texture of aged parchment.',
    lighting:
      'Warm candlelight-style amber illumination casting long, gentle shadows — evoking a Renaissance scholar\'s workshop at dusk, scholarly and warm.',
    composition:
      'Precise technical drawing with elegant annotation arrows, handwritten-style labels, measurement guides, and a beautifully aged paper background with subtle foxing and torn edges.',
  },
  action: {
    style:
      'A high-energy comic book action spread with bold thick outlines, explosive Kirby-dot energy effects, and a vibrant primary colour palette that bursts with kinetic movement and excitement.',
    lighting:
      'Dramatic high-contrast spotlight lighting with a dominant key light and deep purple-black shadows, creating a bold theatrical and dynamic look inspired by DC/Marvel splash pages.',
    composition:
      'Dramatic low-angle shot with explosive perspective lines radiating from the focal point. Speed lines, impact stars, and selective motion blur convey raw power and rapid transformation.',
  },
};

// ── Prompt builder (Nano Banana guide: narrative > keywords) ──────────────────

/**
 * Builds a rich, descriptive educational image prompt following the
 * Nano Banana prompting guide:
 *  • Describe the scene narratively — never just list disconnected keywords
 *  • Use photography/art-direction terminology (shot type, lens, lighting)
 *  • Calibrate visual complexity to the student's age/grade
 *  • Keep text minimal — let visual storytelling carry the concept
 */
function buildImagePrompt(concept: string, theme: string, age: string): string {
  const { style, lighting, composition } =
    THEME_DIRECTIONS[theme] ?? THEME_DIRECTIONS.realistic;

  const complexityNote = age
    ? getAudienceNote(age)
    : 'Use clear, universally accessible visual complexity suitable for high-school students.';

  const subjectNote = getSubjectVisualNote(concept);

  return `
Create a stunning educational visual that makes the concept "${concept}" immediately clear, memorable, and beautiful.

ARTISTIC DIRECTION:
${style}

LIGHTING & ATMOSPHERE:
${lighting}

COMPOSITION & FRAMING:
${composition}

EDUCATIONAL REQUIREMENTS:
• The concept "${concept}" must be the unmistakable focal point — every visual element should serve its understanding, nothing else.
• ${complexityNote}
• ${subjectNote}
• CRITICAL — SPELLING: Every scientific term, label, and annotation must be spelled with exact precision. Examples of common errors to avoid: "Phosphate" not "Phospate", "Cytosine" not "Cytsome", "Mitochondria" not "Mitocondria", "Electromagnetic" not "Electromangetic". Scientific accuracy in text labels is non-negotiable for an educational tool.
• OUTPUT TYPE: Generate a scientific ILLUSTRATION or CONCEPT DIAGRAM — NOT a flowchart, UML activity diagram, sequence diagram, or data visualisation chart — unless the concept is explicitly about a process flow or a data set. Visual storytelling through illustration always beats text-heavy boxes and connector lines.
• ZOOM INSETS: For biological, anatomical, or microscopic concepts, include at least one circular or rectangular zoom-inset callout that magnifies a key micro-level detail and connects it with a clean arrow or line to the macro subject.
• COLOUR LANGUAGE: Apply functional colour coding — red/orange = heat/danger/inflammation/energy; blue/cyan = fluid/cold/electrical signals; green = growth/normal/positive/safe; yellow/amber = chemical bonds/caution/transition; purple/violet = nerve signals/quantum effects.
• Use concrete visual metaphors and real-world scale references to make abstract ideas instantly tangible.
• Keep any text or symbols minimal and crystal-clear — prioritise visual storytelling and colour-coded relationships over dense labelling.
• Include purposeful indicators (arrows, flow lines, highlights, or motion trails) to show direction, force, energy transfer, or cause and effect where relevant.
• Wide landscape 16:9 format.

QUALITY BAR: This image should be so vivid and self-explanatory that a student immediately grasps the core concept from the image alone, before reading a single word of accompanying text.
  `.trim();
}

// ── Core generation logic ─────────────────────────────────────────────────────

/**
 * Attempts to generate an image using the specified model.
 * Returns a base64 data URI for direct browser rendering.
 */
async function attemptGeneration(modelName: string, prompt: string): Promise<string> {
  console.log(`[ImageGen] Trying model: ${modelName}`);

  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const imagePart = response.candidates?.[0]?.content?.parts?.find(
    (p: any) => p.inlineData || p.fileData
  );

  if (imagePart?.inlineData?.data) {
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    return `data:${mimeType};base64,${imagePart.inlineData.data}`;
  }

  if (imagePart?.fileData?.fileUri) {
    throw new Error(
      `Model returned a fileURI (${imagePart.fileData.fileUri}) rather than inline base64 data. We need base64 for direct browser rendering.`
    );
  }

  throw new Error(
    `Model ${modelName} returned successfully but contained no valid image data in the parts array.`
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ImageGenerationOptions {
  theme?: string;
  age?: string;
}

/**
 * Generates a rich educational image using Nano Banana-optimised prompting.
 *
 * Primary:  Nano Banana 2    (gemini-3.1-flash-image-preview)
 * Fallback: Nano Banana Pro  (gemini-3-pro-image-preview)
 */
export async function generateEducationalImage(
  concept: string,
  options: ImageGenerationOptions = {}
): Promise<string> {
  const { theme = 'realistic', age = '' } = options;
  const fullPrompt = buildImagePrompt(concept, theme, age);

  try {
    return await attemptGeneration('gemini-3.1-flash-image-preview', fullPrompt);
  } catch (flashError) {
    console.warn('[ImageGen] Nano Banana 2 failed. Falling back to Nano Banana Pro…', flashError);
    try {
      return await attemptGeneration('gemini-3-pro-image-preview', fullPrompt);
    } catch (error) {
      console.error('[ImageGen] Both models failed. FINAL ERROR:', error);
      throw new Error('Image generation pipeline failed. Please check your API usage limits.');
    }
  }
}
