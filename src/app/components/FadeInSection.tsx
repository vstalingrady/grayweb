"use client";

import React, { useState, useEffect, useRef } from 'react';

interface FadeInSectionProps {
  children: React.ReactNode;
  threshold?: number | number[];
  durationMs?: number;
}

const FadeInSection: React.FC<FadeInSectionProps> = ({ children, threshold = 0.12, durationMs = 900 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = sectionRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
      }
    }, { threshold });

    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold]);

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
