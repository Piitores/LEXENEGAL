
import React from 'react';
import './Logo.css';

interface LogoProps {
  size?: number;
  animated?: boolean;
}

function Logo({ size = 60, animated = true }: LogoProps) {
  return (
    <svg 
      className={`logo ${animated ? 'logo--animated' : ''}`}
      width={size} 
      height={size} 
      viewBox="0 0 100 100" 
      fill="none"
    >
      {/* Baobab Trunk */}
      <path 
        className="logo__trunk"
        d="M45 95 L40 70 Q35 60 38 50 L42 35 Q44 30 50 28 Q56 30 58 35 L62 50 Q65 60 60 70 L55 95 Z"
        fill="url(#trunkGradient)"
      />
      
      {/* African Pattern on Trunk */}
      <g className="logo__pattern">
        <path d="M46 75 L50 70 L54 75 L50 80 Z" fill="var(--color-gold)" opacity="0.6"/>
        <path d="M44 60 L50 55 L56 60 L50 65 Z" fill="var(--color-gold)" opacity="0.4"/>
        <path d="M46 45 L50 40 L54 45 L50 50 Z" fill="var(--color-gold)" opacity="0.3"/>
      </g>
      
      {/* Network Nodes - Crown */}
      <g className="logo__network">
        {/* Central Node */}
        <circle className="logo__node logo__node--center" cx="50" cy="18" r="5" fill="var(--color-gold)"/>
        
        {/* Primary Nodes */}
        <circle className="logo__node logo__node--1" cx="30" cy="25" r="4" fill="var(--color-emerald)"/>
        <circle className="logo__node logo__node--2" cx="70" cy="25" r="4" fill="var(--color-emerald)"/>
        <circle className="logo__node logo__node--3" cx="20" cy="40" r="3" fill="var(--color-gold)"/>
        <circle className="logo__node logo__node--4" cx="80" cy="40" r="3" fill="var(--color-gold)"/>
        <circle className="logo__node logo__node--5" cx="38" cy="12" r="3" fill="var(--color-emerald)"/>
        <circle className="logo__node logo__node--6" cx="62" cy="12" r="3" fill="var(--color-emerald)"/>
        <circle className="logo__node logo__node--7" cx="50" cy="5" r="2.5" fill="var(--color-gold)"/>
        
        {/* Connection Lines */}
        <g className="logo__connections" stroke="var(--color-gold)" strokeWidth="1" opacity="0.6">
          <line x1="50" y1="18" x2="30" y2="25"/>
          <line x1="50" y1="18" x2="70" y2="25"/>
          <line x1="30" y1="25" x2="20" y2="40"/>
          <line x1="70" y1="25" x2="80" y2="40"/>
          <line x1="50" y1="18" x2="38" y2="12"/>
          <line x1="50" y1="18" x2="62" y2="12"/>
          <line x1="50" y1="18" x2="50" y2="5"/>
          <line x1="38" y1="12" x2="50" y2="5"/>
          <line x1="62" y1="12" x2="50" y2="5"/>
          <line x1="30" y1="25" x2="38" y2="12"/>
          <line x1="70" y1="25" x2="62" y2="12"/>
        </g>
        
        {/* Data Flow Particles */}
        <circle className="logo__particle logo__particle--1" r="1.5" fill="var(--color-gold)">
          <animateMotion dur="2s" repeatCount="indefinite" path="M50,18 L30,25"/>
        </circle>
        <circle className="logo__particle logo__particle--2" r="1.5" fill="var(--color-emerald)">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M50,18 L70,25"/>
        </circle>
        <circle className="logo__particle logo__particle--3" r="1" fill="var(--color-gold)">
          <animateMotion dur="1.8s" repeatCount="indefinite" path="M50,18 L50,5"/>
        </circle>
      </g>
      
      {/* Gradients */}
      <defs>
        <linearGradient id="trunkGradient" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="var(--color-blue-lighter)"/>
          <stop offset="100%" stopColor="var(--color-blue-light)"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default Logo;
