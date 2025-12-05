"use client";

import React, { useState, useEffect, useRef } from 'react';

interface FadeInSectionProps {
  children: React.ReactNode;
  threshold?: number | number[];
  durationMs?: number;
}

const FadeInSection: React.FC<FadeInSectionProps> = ({ children, threshold = 0.12, durationMs = 900 }) => {
  // Default to visible so content always renders, even if
  // IntersectionObserver is unavailable or misbehaves.
  const [isVisible, setIsVisible] = useState(true);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sectionRef.current;
    // If we're already visible (e.g., initial render), no need to observe.
    if (!element || isVisible) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
      }
    }, { threshold });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [threshold, isVisible]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsVisible(true);
      }
    };

    handleResize(); // Initial check

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={sectionRef}
      className={`transition-opacity ease-out ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ transitionDuration: `${durationMs}ms` }}
    >
      {children}
    </div>
  );
};

export default FadeInSection;
