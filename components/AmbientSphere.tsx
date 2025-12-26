"use client";

import { useEffect, useRef } from "react";

interface AmbientSphereProps {
  volume: number; // 0-1 normalized volume
}

export function AmbientSphere({ volume }: AmbientSphereProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const animationRef = useRef<number | null>(null);
  const filterRef = useRef<SVGFilterElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const circle = svg.querySelector("circle") as SVGCircleElement;
    filterRef.current = svg.querySelector("#glow") as SVGFilterElement;
    
    if (!circle) return;

    // Smooth volume tracking for better animation
    let smoothedVolume = volume;
    const smoothingFactor = 0.15; // Lower = more responsive, higher = smoother

    const animate = () => {
      // Smooth volume changes for more natural animation
      smoothedVolume = smoothedVolume * (1 - smoothingFactor) + volume * smoothingFactor;

      // Enhanced scale range (0.7 to 1.5) for more dramatic effect
      const baseScale = 0.7 + smoothedVolume * 0.8;
      
      // Dynamic pulsing effect that responds to volume
      const time = Date.now();
      const pulseIntensity = 0.15 + smoothedVolume * 0.25; // Stronger pulse with higher volume
      const pulseSpeed = 400 + smoothedVolume * 200; // Faster pulse with higher volume
      const pulseScale = 1 + Math.sin(time / pulseSpeed) * pulseIntensity;
      
      // Apply combined scale
      const finalScale = baseScale * pulseScale;
      circle.style.transform = `scale(${finalScale})`;

      // Enhanced opacity range (0.2 to 0.9) for better visibility
      const opacity = 0.2 + smoothedVolume * 0.7;
      circle.style.opacity = opacity.toString();

      // Volume-based glow intensity
      if (filterRef.current) {
        const glowBlur = 4 + smoothedVolume * 8; // 4 to 12 blur based on volume
        const blurElement = filterRef.current.querySelector("feGaussianBlur") as SVGFEGaussianBlurElement;
        if (blurElement) {
          blurElement.setAttribute("stdDeviation", glowBlur.toString());
        }
      }

      // Subtle SVG-level pulse for overall effect
      const svgPulse = 1 + Math.sin(time / 600) * 0.05 * smoothedVolume;
      svg.style.transform = `scale(${svgPulse})`;

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
    <div 
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <svg
        ref={svgRef}
        width="400"
        height="400"
        viewBox="0 0 400 400"
        className="transition-transform duration-75 pointer-events-none"
      >
        <defs>
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
          fill="transparent"
          filter="url(#glow)"
          className="transition-all duration-75"
          style={{ transformOrigin: "200px 200px" }}
        />
      </svg>
    </div>
  );
}






