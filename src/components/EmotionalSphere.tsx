import React, { useEffect, useRef, useState } from 'react';

interface EmotionalSphereProps {
  score?: number; // 1 to 10
  resourceLevel?: 'high' | 'medium' | 'low' | 'none';
  onClick?: () => void;
  className?: string;
  size?: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export const EmotionalSphere: React.FC<EmotionalSphereProps> = ({
  score = 8.2,
  resourceLevel = 'high',
  onClick,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Parallax & touch interaction states
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });
  const touchPulseRef = useRef(0);

  // Check reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // Health state visual parameters
    const isHigh = resourceLevel === 'high' || score >= 8;
    const isLow = resourceLevel === 'low' || score < 5;

    const targetState = {
      emeraldIntensity: isHigh ? 1.0 : isLow ? 0.4 : 0.7,
      cyanIntensity: isHigh ? 0.9 : isLow ? 0.5 : 0.75,
      waveSpeed: isHigh ? 1.0 : isLow ? 0.6 : 0.8,
      waveAmp: isHigh ? 38 : isLow ? 22 : 30,
    };

    const currentState = { ...targetState };

    const W = 480;
    const H = 480;
    const cx = W / 2;
    const cy = H / 2;
    const R = 170; // Main sphere radius

    // Floating particles inside the glass sphere
    const particles: Particle[] = Array.from({ length: 30 }, () => ({
      x: (Math.random() - 0.5) * (R * 1.5),
      y: (Math.random() - 0.5) * (R * 1.5),
      z: (Math.random() - 0.5) * R,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 1.0 + Math.random() * 2.0,
      alpha: 0.2 + Math.random() * 0.6,
      color: Math.random() > 0.3 ? '#34F5AA' : '#46E6E0',
    }));

    const render = () => {
      const step = prefersReducedMotion ? 0.0008 : 0.008 * currentState.waveSpeed;
      time += step;

      // Smooth mouse parallax interpolation
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.05;

      // Touch pulse decay (smooth glow reaction)
      touchPulseRef.current *= 0.93;
      const touchBonus = touchPulseRef.current;

      // Smooth health state interpolation
      currentState.emeraldIntensity += (targetState.emeraldIntensity - currentState.emeraldIntensity) * 0.03;
      currentState.cyanIntensity += (targetState.cyanIntensity - currentState.cyanIntensity) * 0.03;
      currentState.waveSpeed += (targetState.waveSpeed - currentState.waveSpeed) * 0.03;
      currentState.waveAmp += (targetState.waveAmp - currentState.waveAmp) * 0.03;

      ctx.clearRect(0, 0, W, H);

      const px = mouseRef.current.x;
      const py = mouseRef.current.y;

      // Offset center slightly based on parallax
      const scx = cx + px * 0.4;
      const scy = cy + py * 0.4;

      // Subtle breathing scale (2-3%)
      const breathScale = 1.0 + Math.sin(time * 0.4) * 0.02;

      ctx.save();
      ctx.translate(scx, scy);
      ctx.scale(breathScale, breathScale);

      // ==========================================
      // 1. OUTER AMBIENT GLOW / HALO (Behind Sphere)
      // ==========================================
      const haloGrad = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.45);
      haloGrad.addColorStop(0, `rgba(52, 245, 170, ${0.18 * currentState.emeraldIntensity + touchBonus * 0.15})`);
      haloGrad.addColorStop(0.4, `rgba(70, 230, 224, ${0.12 * currentState.cyanIntensity})`);
      haloGrad.addColorStop(0.75, 'rgba(25, 191, 209, 0.04)');
      haloGrad.addColorStop(1, 'rgba(5, 10, 18, 0)');

      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // 2. ORBITAL RING (BACK ARC - Behind Sphere)
      // ==========================================
      const orbitRx = R * 1.35;
      const orbitRy = R * 0.34;
      const orbitTilt = -Math.PI * 0.08; // ~-15 degrees tilt

      ctx.save();
      ctx.rotate(orbitTilt);

      // Back half of the ring (angles from Math.PI to Math.PI * 2)
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRx, orbitRy, 0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = `rgba(70, 230, 224, ${0.25 + touchBonus * 0.1})`;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      // ==========================================
      // 3. SPHERE GLASS BODY (Base Fill & Shadow)
      // ==========================================
      // Dark glass sphere interior with deep cyan gradient
      const sphereGrad = ctx.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R);
      sphereGrad.addColorStop(0, 'rgba(12, 32, 52, 0.95)');
      sphereGrad.addColorStop(0.5, 'rgba(7, 20, 34, 0.96)');
      sphereGrad.addColorStop(0.85, 'rgba(4, 12, 22, 0.98)');
      sphereGrad.addColorStop(1, 'rgba(3, 8, 15, 1.0)');

      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();

      // Sphere Outer Glass Rim Glow
      ctx.shadowColor = '#34F5AA';
      ctx.shadowBlur = 18 + touchBonus * 10;
      ctx.strokeStyle = `rgba(52, 245, 170, ${0.45 * currentState.emeraldIntensity + touchBonus * 0.2})`;
      ctx.lineWidth = 2.0;
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow

      // ==========================================
      // 4. CLIPPED INNER CONTENT (Fluid Waves & Particles)
      // ==========================================
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R - 1, 0, Math.PI * 2);
      ctx.clip();

      // Inner Ambient Light Core Glow
      const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      innerGlow.addColorStop(0, `rgba(52, 245, 170, ${0.22 * currentState.emeraldIntensity + touchBonus * 0.15})`);
      innerGlow.addColorStop(0.5, `rgba(70, 230, 224, ${0.12 * currentState.cyanIntensity})`);
      innerGlow.addColorStop(1, 'rgba(5, 10, 18, 0)');
      ctx.fillStyle = innerGlow;
      ctx.fillRect(-R, -R, R * 2, R * 2);

      // --- Draw 3D Fluid Laser Waves inside the sphere ---
      const drawLaserWave = (
        yBase: number,
        freq: number,
        amp: number,
        phase: number,
        color: string,
        lineWidth: number,
        glowBlur: number
      ) => {
        ctx.save();
        ctx.beginPath();

        const startX = -R;
        const endX = R;
        const step = 4;

        ctx.moveTo(startX, yBase);

        for (let x = startX; x <= endX; x += step) {
          const normX = (x + R) / (R * 2); // 0 to 1
          const envelope = Math.sin(normX * Math.PI); // 0 at edges, 1 in center

          const w1 = Math.sin(time * freq * 1.2 + normX * Math.PI * 3 + phase) * amp;
          const w2 = Math.cos(time * freq * 0.8 - normX * Math.PI * 2) * (amp * 0.4);

          const y = yBase + (w1 + w2) * envelope;

          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        if (glowBlur > 0) {
          ctx.shadowColor = color;
          ctx.shadowBlur = glowBlur;
        }
        ctx.stroke();
        ctx.restore();
      };

      // Wave 1: Deep Teal Background Flow
      drawLaserWave(10, 0.8, currentState.waveAmp * 0.7, 0, 'rgba(25, 191, 209, 0.4)', 2.5, 0);

      // Wave 2: Cyan secondary stream
      drawLaserWave(-15, 1.0, currentState.waveAmp * 0.85, Math.PI * 0.4, 'rgba(70, 230, 224, 0.7)', 2.0, 8);

      // Wave 3: PRIMARY BRIGHT EMERALD LASER WAVE (Matches reference exactly!)
      drawLaserWave(
        0,
        1.2,
        currentState.waveAmp * (1 + touchBonus * 0.3),
        time * 0.2,
        `rgba(52, 245, 170, ${0.95 + touchBonus * 0.05})`,
        3.5,
        14 + touchBonus * 8
      );

      // Wave 4: Upper Fine Cyan Harmonic Wave
      drawLaserWave(-35, 1.4, currentState.waveAmp * 0.5, Math.PI * 0.8, 'rgba(70, 230, 224, 0.65)', 1.5, 6);

      // Wave 5: Lower Emerald Harmonic Wave
      drawLaserWave(30, 1.1, currentState.waveAmp * 0.6, Math.PI * 1.3, 'rgba(52, 245, 170, 0.55)', 1.8, 6);

      // --- Internal Floating Micro Particles ---
      particles.forEach((p) => {
        p.x += p.vx * currentState.waveSpeed;
        p.y += p.vy * currentState.waveSpeed;

        // Keep inside sphere radius
        const dist = Math.hypot(p.x, p.y);
        if (dist > R - 15) {
          p.x *= 0.92;
          p.y *= 0.92;
          p.vx = -p.vx;
          p.vy = -p.vy;
        }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha * (0.6 + Math.sin(time * 2 + p.x) * 0.4);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      ctx.restore(); // End sphere clipping

      // ==========================================
      // 5. ORBITAL RING (FRONT ARC - In Front of Sphere)
      // ==========================================
      ctx.save();
      ctx.rotate(orbitTilt);

      // Front half of the ring (angles from 0 to Math.PI)
      ctx.beginPath();
      ctx.ellipse(0, 0, orbitRx, orbitRy, 0, 0, Math.PI);

      const ringGrad = ctx.createLinearGradient(-orbitRx, 0, orbitRx, 0);
      ringGrad.addColorStop(0, `rgba(70, 230, 224, ${0.4 + touchBonus * 0.2})`);
      ringGrad.addColorStop(0.5, `rgba(52, 245, 170, ${0.95 + touchBonus * 0.05})`);
      ringGrad.addColorStop(1, `rgba(70, 230, 224, ${0.4 + touchBonus * 0.2})`);

      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = '#34F5AA';
      ctx.shadowBlur = 10;
      ctx.stroke();

      // Small glowing orbit data node dot sliding along the ring
      const nodeAngle = (time * 0.7) % (Math.PI * 2);
      const nodex = Math.cos(nodeAngle) * orbitRx;
      const nodey = Math.sin(nodeAngle) * orbitRy;

      // Only draw node if it's on front arc
      if (nodeAngle <= Math.PI) {
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#34F5AA';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(nodex, nodey, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // ==========================================
      // 6. GLASS SPECULAR GLARE & RIM HIGHLIGHTS
      // ==========================================
      // Top-Left Crescent Specular Glare (Glass reflection curve)
      ctx.save();
      ctx.beginPath();
      ctx.arc(-R * 0.15, -R * 0.15, R * 0.88, -Math.PI * 0.75, -Math.PI * 0.25);

      const glareGrad = ctx.createLinearGradient(-R * 0.6, -R * 0.8, 0, -R * 0.2);
      glareGrad.addColorStop(0, 'rgba(255, 255, 255, 0.65)');
      glareGrad.addColorStop(0.5, 'rgba(70, 230, 224, 0.35)');
      glareGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.strokeStyle = glareGrad;
      ctx.lineWidth = 3.5;
      ctx.stroke();
      ctx.restore();

      // Top Edge Fine Rim Light Arc
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R - 1, -Math.PI * 0.7, -Math.PI * 0.1);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.restore();

      // Bottom Right Subtle Emerald Reflection
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R - 1, Math.PI * 0.2, Math.PI * 0.6);
      ctx.strokeStyle = 'rgba(52, 245, 170, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      ctx.restore(); // Restore translation & breathing scale

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [score, resourceLevel, prefersReducedMotion]);

  // Desktop smooth parallax pointer handlers
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    targetMouseRef.current = {
      x: relX * 24,
      y: relY * 20,
    };
  };

  const handlePointerLeave = () => {
    targetMouseRef.current = { x: 0, y: 0 };
  };

  const handleClick = () => {
    touchPulseRef.current = 1.0;
    if (onClick) onClick();
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
      className={`relative flex items-center justify-center cursor-pointer group select-none w-full aspect-square mx-auto ${className}`}
    >
      {/* Outer Soft Teal Radial Glow behind sphere canvas */}
      <div className="absolute inset-[-10%] bg-[radial-gradient(circle_at_center,_rgba(52,245,170,0.12)_0%,_rgba(70,230,224,0.08)_45%,_transparent_70%)] pointer-events-none rounded-full blur-3xl z-0" />

      {/* Futuristic Glowing Bio-Orb Sphere Canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={480}
        className="relative z-10 w-full h-full transition-opacity duration-500 ease-out"
      />
    </div>
  );
};
