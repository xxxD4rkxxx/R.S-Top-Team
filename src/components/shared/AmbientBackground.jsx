import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const Blob = ({ color, size, delay, initialPosition }) => {
  // Memoizing values for consistency within a render, but random across instances
  const animControls = useMemo(() => {
    // Generate random path
    const points = Array.from({ length: 5 }).map(() => ({
      x: (Math.random() - 0.5) * 400,
      y: (Math.random() - 0.5) * 400,
      scale: 0.8 + Math.random() * 0.7,
      opacity: 0.01 + Math.random() * 0.05 // Soft opacity range
    }));
    
    return {
      x: points.map(p => p.x),
      y: points.map(p => p.y),
      scale: points.map(p => p.scale),
      opacity: points.map(p => p.opacity)
    };
  }, []);

  return (
    <motion.div
      initial={{ 
        left: initialPosition.left, 
        top: initialPosition.top,
        scale: 0.8,
        opacity: 0
      }}
      animate={{
        x: animControls.x,
        y: animControls.y,
        scale: animControls.scale,
        opacity: animControls.opacity,
      }}
      transition={{
        duration: 20 + Math.random() * 20,
        repeat: Infinity,
        repeatType: "reverse",
        ease: "easeInOut",
        delay: delay
      }}
      className={`absolute rounded-full blur-[140px] pointer-events-none ${color}`}
      style={{
        width: size,
        height: size,
        zIndex: 0
      }}
    />
  );
};

export default function AmbientBackground() {
  // Use a stable set of blobs
  const blobs = useMemo(() => [
    { color: 'bg-primary', size: 600, top: '15%', left: '15%', delay: 0 },
    { color: 'bg-primary', size: 500, top: '65%', left: '75%', delay: 2 },
    { color: 'bg-white', size: 400, top: '35%', left: '65%', delay: 4 },
    { color: 'bg-primary', size: 700, top: '75%', left: '15%', delay: 1 },
    { color: 'bg-white', size: 300, top: '25%', left: '85%', delay: 5 },
    { color: 'bg-primary', size: 550, top: '45%', left: '35%', delay: 3 },
  ], []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden bg-black select-none pointer-events-none">
      {blobs.map((blob, idx) => (
        <Blob 
          key={idx} 
          color={blob.color} 
          size={blob.size} 
          delay={blob.delay}
          initialPosition={{ top: blob.top, left: blob.left }}
        />
      ))}
      
      {/* Subtle Noise / Grain Overlay for texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}>
      </div>
    </div>
  );
}
