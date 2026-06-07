
import React from 'react';
import './Logo.css';

interface LogoProps {
  size?: number;
  animated?: boolean;
}

function Logo({ size = 60, animated = true }: LogoProps) {
  return (
    <img 
      src="/lexenegal_new_logo.svg" 
      alt="Lexenegal Logo" 
      style={{ width: 'auto', height: size, objectFit: 'contain' }}
      className={`logo ${animated ? 'logo--animated' : ''}`}
    />
  );
}

export default Logo;
