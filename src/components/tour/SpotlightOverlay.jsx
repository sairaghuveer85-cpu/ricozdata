import React, { useEffect, useState } from 'react';

/**
 * SpotlightOverlay
 * Uses an SVG cutout mask to subtly dim the background while illuminating
 * the actual target element with a crisp focus ring.
 */
export default function SpotlightOverlay({ targetRect, onDismiss }) {
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!targetRect) {
    // If no target rect is provided, just show a transparent non-blocking overlay
    return null;
  }

  const padding = 8;
  const radius = 10;
  const top = Math.max(0, targetRect.top - padding);
  const left = Math.max(0, targetRect.left - padding);
  const width = Math.min(windowDimensions.width - left, targetRect.width + padding * 2);
  const height = Math.min(windowDimensions.height - top, targetRect.height + padding * 2);
  const cornerRadius = Math.min(radius, width / 2, height / 2);
  const cutoutPath = [
    `M 0 0 H ${windowDimensions.width} V ${windowDimensions.height} H 0 Z`,
    `M ${left + cornerRadius} ${top}`,
    `H ${left + width - cornerRadius}`,
    `Q ${left + width} ${top} ${left + width} ${top + cornerRadius}`,
    `V ${top + height - cornerRadius}`,
    `Q ${left + width} ${top + height} ${left + width - cornerRadius} ${top + height}`,
    `H ${left + cornerRadius}`,
    `Q ${left} ${top + height} ${left} ${top + height - cornerRadius}`,
    `V ${top + cornerRadius}`,
    `Q ${left} ${top} ${left + cornerRadius} ${top}`,
    'Z',
  ].join(' ');

  return (
    <div
      className="fixed inset-0 z-[800] pointer-events-none transition-opacity duration-200"
      aria-hidden="true"
    >
      {/* SVG Mask Cutout */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-auto"
        width={windowDimensions.width}
        height={windowDimensions.height}
      >
        <path
          d={cutoutPath}
          fill="rgba(15, 23, 42, 0.52)"
          fillRule="evenodd"
          onClick={onDismiss}
          style={{ cursor: 'pointer' }}
        />
      </svg>

      {/* Target Element Illuminated Focus Ring */}
      <div
        className="fixed pointer-events-none transition-all duration-200 ease-out"
        style={{
          top,
          left,
          width,
          height,
          borderRadius: `${radius}px`,
          border: '2px solid var(--color-brand, #2563EB)',
          boxShadow: '0 0 0 4px rgba(37, 99, 235, 0.22), 0 8px 24px rgba(0, 0, 0, 0.25)',
        }}
      />
    </div>
  );
}
