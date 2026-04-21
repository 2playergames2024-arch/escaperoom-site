'use client';

import { useEffect, useRef } from 'react';

interface BookeoWidgetProps {
  type: string;
  className?: string;
}

export default function BookeoWidget({ type, className = "" }: BookeoWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const accountId = "41554CXHWMK1535EB1636F";

  useEffect(() => {
    if (!type || !containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = `https://bookeo.com/widget.js?a=${accountId}&type=${type}`;
    script.async = true;

    // Debug line
    script.onload = () => {
      console.log(`✅ Bookeo script loaded successfully for type: ${type}`);
    };

    script.onerror = () => {
      console.error(`❌ Failed to load Bookeo script for type: ${type}`);
    };

    containerRef.current.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [type]);

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ minHeight: '650px' }}
    />
  );
}