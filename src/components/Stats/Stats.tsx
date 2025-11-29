
import React, { useEffect, useRef, useState } from 'react';
import './Stats.css';

interface Stat {
  value: number;
  suffix: string;
  label: string;
  description: string;
}

const stats: Stat[] = [
  { value: 50000, suffix: '+', label: 'Textes de Loi', description: 'Lois, décrets, arrêtés indexés' },
  { value: 15000, suffix: '+', label: 'Jurisprudences', description: 'Décisions de justice analysées' },
  { value: 100, suffix: '%', label: 'Gratuit', description: 'Accès libre pour tous les citoyens' },
  { value: 24, suffix: '/7', label: 'Disponibilité', description: 'Service accessible en permanence' },
];

function useCountUp(end: number, duration: number = 2000, start: boolean = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setCount(Math.floor(easeOutQuart * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration, start]);

  return count;
}

function StatCard({ stat, animate }: { stat: Stat; animate: boolean }) {
  const count = useCountUp(stat.value, 2500, animate);
  
  return (
    <div className="stats__card">
      <div className="stats__card-value">
        <span className="stats__card-number">{count.toLocaleString()}</span>
        <span className="stats__card-suffix">{stat.suffix}</span>
      </div>
      <h3 className="stats__card-label">{stat.label}</h3>
      <p className="stats__card-description">{stat.description}</p>
    </div>
  );
}

function Stats() {
  const [animate, setAnimate] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAnimate(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section className="stats" ref={sectionRef}>
      <div className="stats__bg">
        <div className="stats__gradient"></div>
      </div>
      
      <div className="container">
        <div className="stats__grid">
          {stats.map((stat, index) => (
            <StatCard key={index} stat={stat} animate={animate} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Stats;
