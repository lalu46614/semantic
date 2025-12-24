"use client";

import { useEffect, useRef } from "react";

interface AmbientSphereProps {
  volume: number; // 0-1 normalized volume
}

export function AmbientSphere({ volume }: AmbientSphereProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const circle = svg.querySelector("circle") as SVGCircleElement;
    if (!circle) return;

    const animate = () => {
      // Calculate scale based on volume (0.8 to 1.2 range)
      const scale = 0.8 + volume * 0.4;
      const opacity = 0.3 + volume * 0.5;

      circle.style.transform = `scale(${scale})`;
      circle.style.opacity = opacity.toString();

      // Add pulsing effect
      const pulseScale = 1 + Math.sin(Date.now() / 500) * 0.1 * volume;
      svg.style.transform = `scale(${pulseScale})`;

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [volume]);

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <svg
        ref={svgRef}
        width="400"
        height="400"
        viewBox="0 0 400 400"
        className="transition-transform duration-75"
      >
        <defs>
          <radialGradient id="sphereGradient" cx="50%" cy="50%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
            <stop offset="50%" stopColor="rgba(99, 102, 241, 0.6)" />
            <stop offset="100%" stopColor="rgba(139, 92, 246, 0.4)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle
          cx="200"
          cy="200"
          r="150"
          fill="url(#sphereGradient)"
          filter="url(#glow)"
          className="transition-all duration-75"
          style={{ transformOrigin: "200px 200px" }}
        />
      </svg>
    </div>
  );
}




