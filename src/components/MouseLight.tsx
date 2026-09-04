'use client';

import { useEffect, useRef } from 'react';

/**
 * MouseLight Component - Dynamic cursor-tracking light effect
 * 
 * Creates a radial gradient light that follows the mouse cursor,
 * giving glass elements a dynamic reflective quality.
 * 
 * Usage:
 * - Add to layout.tsx for global effect
 * - Add className "glass-light-track" to elements that should respond
 * - Automatically tracks cursor movement with smooth easing
 */
export default function MouseLight() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let targetX = mouseX;
    let targetY = mouseY;

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;
    const updateLightPosition = () => {
      // Smooth easing for light following
      const easing = 0.12;
      mouseX += (targetX - mouseX) * easing;
      mouseY += (targetY - mouseY) * easing;

      document.documentElement.style.setProperty("--cursor-x", `${mouseX}px`);
      document.documentElement.style.setProperty("--cursor-y", `${mouseY}px`);

      // Update all glass-light-track elements
      const glassElements = document.querySelectorAll('.glass-light-track');
      glassElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const relativeX = mouseX - rect.left;
        const relativeY = mouseY - rect.top;

        // Calculate if mouse is near this element
        const distance = Math.sqrt(
          Math.pow(relativeX - rect.width / 2, 2) +
          Math.pow(relativeY - rect.height / 2, 2)
        );

        // Show light effect if within 300px
        const showLight = distance < 300;

        const afterElement = (element as HTMLElement).style;
        if (showLight) {
          (element as HTMLElement).classList.add('mouse-active');
          const normalizedX = rect.width ? relativeX / rect.width : 0.5;
          const normalizedY = rect.height ? relativeY / rect.height : 0.5;
          afterElement.setProperty(
            '--light-x',
            `${Math.max(0, Math.min(relativeX, rect.width))}px`
          );
          afterElement.setProperty(
            '--light-y',
            `${Math.max(0, Math.min(relativeY, rect.height))}px`
          );
          afterElement.setProperty('--tilt-x', `${(normalizedX - 0.5) * 8}deg`);
          afterElement.setProperty('--tilt-y', `${(0.5 - normalizedY) * 8}deg`);
        } else {
          (element as HTMLElement).classList.remove('mouse-active');
          afterElement.setProperty('--tilt-x', '0deg');
          afterElement.setProperty('--tilt-y', '0deg');
        }
      });

      animationFrameId = requestAnimationFrame(updateLightPosition);
    };

    animationFrameId = requestAnimationFrame(updateLightPosition);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    >
      <div className="mouse-liquid-orb mouse-liquid-orb-primary" />
      <div className="mouse-liquid-orb mouse-liquid-orb-secondary" />
      <div className="mouse-liquid-specular" />
    </div>
  );
}
