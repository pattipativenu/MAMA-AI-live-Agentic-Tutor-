/**
 * GlobeVisualizer - 3D Audio-Reactive Globe for Mama AI
 * 
 * A canvas-based 3D particle system that reacts to microphone audio (listening)
 * and AI TTS audio (speaking). Replaces the static mic button with an
 * interactive, living visualization.
 * 
 * Adapted from Tara Globe Visualizer with Mama AI brand colors:
 * - Orange (amber-500): IDLE, LISTENING
 * - Orange → Green: THINKING (transition)
 * - Green (emerald-500): SPEAKING
 */

import React, { useEffect, useRef, useCallback } from 'react';

export type GlobeState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING' | 'ERROR';

interface GlobeVisualizerProps {
  state: GlobeState;
  audioStream: MediaStream | null;        // Live mic stream — used when LISTENING
  ttsAudio: HTMLAudioElement | null;      // TTS audio element — used when SPEAKING
  ttsAnalyser?: AnalyserNode | null;      // Alternative: TTS analyser from useGeminiLive
  size?: number;                          // Globe size in pixels (default: 200)
}

const GlobeVisualizer: React.FC<GlobeVisualizerProps> = ({ 
  state, 
  audioStream, 
  ttsAudio,
  ttsAnalyser: externalTtsAnalyser,
  size = 200 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);

  // ─── Microphone Audio Analysis (LISTENING) ───────────────────────────────
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // ─── TTS Audio Analysis (SPEAKING) ───────────────────────────────────────
  const ttsAudioContextRef = useRef<AudioContext | null>(null);
  const ttsAnalyserRef = useRef<AnalyserNode | null>(null);
  const ttsSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const ttsDataArrayRef = useRef<Uint8Array | null>(null);
  const ttsConnectedRef = useRef<boolean>(false);
  
  // Ref to store external analyser from useGeminiLive
  const externalTtsAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Sync external analyser to ref
  useEffect(() => {
    externalTtsAnalyserRef.current = externalTtsAnalyser;
  }, [externalTtsAnalyser]);

  // ─── Mama AI Brand Colors ─────────────────────────────────────────────────
  // ORANGE colors for IDLE, LISTENING (amber-500 palette)
  const ORANGE_COLORS = [
    [245, 158, 11],   // amber-500
    [251, 191, 36],   // amber-400
    [217, 119, 6],    // amber-600
    [255, 215, 166],  // amber-200
    [180, 83, 9],     // amber-700
  ];

  // GREEN colors for SPEAKING (emerald-500 palette)
  const GREEN_COLORS = [
    [16, 185, 129],   // emerald-500
    [52, 211, 153],   // emerald-400
    [5, 150, 105],    // emerald-600
    [167, 243, 208],  // emerald-200
    [4, 120, 87],     // emerald-700
  ];

  // ─── Globe Constants ──────────────────────────────────────────────────────
  const PARTICLE_COUNT = 1500;              // Reduced for mobile performance
  const TILT_ANGLE = 45 * (Math.PI / 180);  // Fixed 45° tilt

  // ─── Mutable Globe State (ref to avoid re-renders) ───────────────────────
  const v = useRef({
    time: 0,
    rotation: 0,
    amplitude: 0,       // Controls how much particles spike outward
    morph: 0,           // 0 = sphere, 1 = 3-ring atom shape
    colorMix: 0,        // 0 = full orange, 1 = full green
    radius: size,
    targetRadius: size,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
  });

  // ─── Microphone AudioContext lifecycle ────────────────────────────────────
  useEffect(() => {
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;

    if (audioStream && state === 'LISTENING') {
      try {
        ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        source = ctx.createMediaStreamSource(audioStream);
        sourceRef.current = source;
        source.connect(analyser);

        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      } catch (e) {
        console.error("[GlobeVisualizer] Failed to initialize AudioContext:", e);
      }
    }

    return () => {
      if (source) source.disconnect();
      if (ctx && ctx.state !== 'closed') ctx.close().catch(console.error);
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
      dataArrayRef.current = null;
    };
  }, [audioStream, state]);

  // ─── TTS AudioContext lifecycle ───────────────────────────────────────────
  useEffect(() => {
    if (ttsAudio && state === 'SPEAKING' && !ttsConnectedRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        ttsAudioContextRef.current = ctx;

        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.6;
        ttsAnalyserRef.current = analyser;

        const source = ctx.createMediaElementSource(ttsAudio);
        ttsSourceRef.current = source;
        source.connect(analyser);
        analyser.connect(ctx.destination);

        ttsDataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
        ttsConnectedRef.current = true;
      } catch (e) {
        console.error("[GlobeVisualizer] Failed to initialize TTS AudioContext:", e);
      }
    }
  }, [ttsAudio, state]);

  // ─── TTS context cleanup ──────────────────────────────────────────────────
  useEffect(() => {
    if (!ttsAudio) {
      ttsConnectedRef.current = false;
      if (ttsAudioContextRef.current && ttsAudioContextRef.current.state !== 'closed') {
        ttsAudioContextRef.current.close().catch(() => {});
      }
      ttsAudioContextRef.current = null;
      ttsAnalyserRef.current = null;
      ttsSourceRef.current = null;
      ttsDataArrayRef.current = null;
    }
  }, [ttsAudio]);

  // ─── Particle Factory ─────────────────────────────────────────────────────
  const createParticle = useCallback(() => {
    const orangeIdx = Math.floor(Math.random() * ORANGE_COLORS.length);
    const greenIdx = Math.floor(Math.random() * GREEN_COLORS.length);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    const baseX = Math.sin(phi) * Math.cos(theta);
    const baseY = Math.sin(phi) * Math.sin(theta);
    const baseZ = Math.cos(phi);

    return {
      theta, phi, baseX, baseY, baseZ,
      ringIndex: Math.floor(Math.random() * 3),
      ringAngle: Math.random() * Math.PI * 2,
      size: Math.random() * 1.5 + 0.5,
      orangeRGB: [...ORANGE_COLORS[orangeIdx]],
      greenRGB: [...GREEN_COLORS[greenIdx]],
      x: 0, y: 0, z: 0, projX: 0, projY: 0, alpha: 0, projScale: 0
    };
  }, []);

  // ─── Per-particle Update ──────────────────────────────────────────────────
  const updateParticle = useCallback((p: any, width: number, height: number) => {
    const { time, rotation, amplitude, morph, colorMix, radius, mouseX, mouseY } = v.current;

    // 1. Interpolate color between orange and green
    const r = p.orangeRGB[0] + (p.greenRGB[0] - p.orangeRGB[0]) * colorMix;
    const g = p.orangeRGB[1] + (p.greenRGB[1] - p.orangeRGB[1]) * colorMix;
    const b = p.orangeRGB[2] + (p.greenRGB[2] - p.orangeRGB[2]) * colorMix;

    // 2. 3D Noise for surface ripple (increased amplitude for visibility)
    const noiseFreq = 3.0;
    const noise = Math.sin(p.baseX * noiseFreq + time) *
                  Math.cos(p.baseY * noiseFreq + time) *
                  Math.sin(p.baseZ * noiseFreq + time);
    const sphereRadius = radius + noise * (amplitude * 60);

    const sx = p.baseX * sphereRadius;
    const sy = p.baseY * sphereRadius;
    const sz = p.baseZ * sphereRadius;

    // 3. Atom morph target
    const ringR = radius * 1.3;
    const angle = p.ringAngle + time * 2.0;
    const cx = ringR * Math.cos(angle);
    const cy = ringR * Math.sin(angle);
    const cz = (Math.random() - 0.5) * 20;

    let tx, ty, tz;
    if (p.ringIndex === 0) {
      tx = cx; ty = cz; tz = cy;
    } else {
      const tilt = p.ringIndex === 1 ? Math.PI / 3 : -Math.PI / 3;
      tx = cx;
      ty = cy * Math.cos(tilt) - cz * Math.sin(tilt);
      tz = cy * Math.sin(tilt) + cz * Math.cos(tilt);
    }

    const bx = sx + (tx - sx) * morph;
    const by = sy + (ty - sy) * morph;
    const bz = sz + (tz - sz) * morph;

    // 4. Rotate: Y-axis + X-axis tilt
    const finalRotY = rotation + mouseX * 0.2;
    const finalRotX = TILT_ANGLE + mouseY * 0.2;

    const r1x = bx * Math.cos(finalRotY) - bz * Math.sin(finalRotY);
    const r1z = bx * Math.sin(finalRotY) + bz * Math.cos(finalRotY);

    const r2x = r1x * Math.cos(finalRotX) - by * Math.sin(finalRotX);
    const r2y = r1x * Math.sin(finalRotX) + by * Math.cos(finalRotX);
    const r2z = r1z;

    // 5. Perspective projection
    const perspective = 600;
    const scale = perspective / (perspective + r2z + 400);
    p.projX = r2x * scale + width / 2;
    p.projY = r2y * scale + height / 2;
    p.projScale = scale;
    p.alpha = scale;
    p.finalColor = `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
  }, []);

  // ─── Animation Loop ───────────────────────────────────────────────────────
  const animate = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const ctx = canvasRef.current.getContext('2d', { alpha: true });
    if (!ctx) return;

    const width = containerRef.current.offsetWidth;
    const height = containerRef.current.offsetHeight;

    // Sync canvas resolution
    if (canvasRef.current.width !== width) {
      const dpr = window.devicePixelRatio || 1;
      canvasRef.current.width = width * dpr;
      canvasRef.current.height = height * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, width, height);

    // ── Read live audio levels ──────────────────────────────────────────────
    let micAudioLevel = 0;
    if (state === 'LISTENING' && analyserRef.current && dataArrayRef.current) {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      const avg = dataArrayRef.current.reduce((a, b) => a + b, 0) / dataArrayRef.current.length;
      micAudioLevel = Math.max(0, (avg / 128) - 0.1);
    }

    let ttsAudioLevel = 0;
    const effectiveAnalyser = externalTtsAnalyserRef.current || ttsAnalyserRef.current;
    if (state === 'SPEAKING' && effectiveAnalyser) {
      const dataArray = new Uint8Array(effectiveAnalyser.frequencyBinCount);
      effectiveAnalyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      ttsAudioLevel = Math.max(0, (avg / 100));
    }

    // ── Compute target values per state ────────────────────────────────────
    let targetAmp = 0.05, targetMorph = 0, targetColorMix = 0;

    if (state === 'IDLE') {
      // Slow breathing
      targetAmp = 0.1 + Math.sin(v.current.time * 2) * 0.02;
      targetColorMix = 0; // Orange
    } else if (state === 'LISTENING') {
      // Mic audio drives spike intensity (amplified for visibility)
      targetAmp = 0.2 + (micAudioLevel * 3.0);
      targetColorMix = 0; // Orange
    } else if (state === 'THINKING') {
      // Simplified: just sphere with gentle pulse, no atom morph
      targetAmp = 0.15 + Math.sin(v.current.time * 2) * 0.05;
      targetMorph = 0; // Stay as sphere
      targetColorMix = 0.5; // Halfway between orange and green
    } else if (state === 'SPEAKING') {
      // TTS audio drives spike intensity (amplified for visibility)
      targetAmp = 0.15 + (ttsAudioLevel * 2.5);
      targetColorMix = 1.0; // Green
    } else if (state === 'ERROR') {
      targetAmp = 0.1;
      targetColorMix = 0; // Orange (safe default)
    }

    // ── Smooth interpolation ────────────────────────────────────────────────
    v.current.amplitude += (targetAmp - v.current.amplitude) * 0.15;
    v.current.morph += (targetMorph - v.current.morph) * 0.04;
    v.current.colorMix += (targetColorMix - v.current.colorMix) * 0.08;
    v.current.radius += (v.current.targetRadius - v.current.radius) * 0.06;
    v.current.mouseX += (v.current.targetMouseX - v.current.mouseX) * 0.12;
    v.current.mouseY += (v.current.targetMouseY - v.current.mouseY) * 0.12;

    v.current.time += 0.015 + v.current.amplitude * 0.03;
    v.current.rotation += 0.004; // Consistent slow rotation for all states

    // ── Draw particles ──────────────────────────────────────────────────────
    // Update all particles first
    particlesRef.current.forEach(p => {
      updateParticle(p, width, height);
    });
    
    // Sort by Z depth (back to front) for proper 3D occlusion
    particlesRef.current.sort((a, b) => a.z - b.z);
    
    // Draw particles
    particlesRef.current.forEach(p => {
      const margin = 50;
      if (
        p.alpha > 0.05 &&
        p.projX > -margin && p.projX < width + margin &&
        p.projY > -margin && p.projY < height + margin
      ) {
        ctx.globalAlpha = Math.min(1, (p.alpha - 0.05) * 3);
        ctx.fillStyle = p.finalColor;
        ctx.beginPath();
        ctx.arc(p.projX, p.projY, p.size * p.projScale * 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    animationRef.current = requestAnimationFrame(animate);
  }, [state, updateParticle]);

  // ─── Setup + Teardown ─────────────────────────────────────────────────────
  useEffect(() => {
    particlesRef.current = Array.from({ length: PARTICLE_COUNT }, createParticle);

    const handleMouseMove = (e: MouseEvent) => {
      v.current.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      v.current.targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationRef.current);
    };
  }, [animate, createParticle]);

  return (
    <div 
      ref={containerRef} 
      className="relative rounded-full overflow-hidden"
      style={{ width: size, height: size }}
    >
      <canvas 
        ref={canvasRef} 
        className="block"
        style={{ width: size, height: size }}
      />
    </div>
  );
};

export default GlobeVisualizer;
