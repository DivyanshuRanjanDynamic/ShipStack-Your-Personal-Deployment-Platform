import React from 'react';
import { Star, ShieldCheck, Zap, Activity, Award } from 'lucide-react';

export default function TrustSeals() {
  const logos = [
    { name: 'React', icon: '⚛️' },
    { name: 'Next.js', icon: '▲' },
    { name: 'AWS ECS', icon: '☁️' },
    { name: 'Apache Kafka', icon: '⚡' },
    { name: 'ClickHouse', icon: '🏛️' },
    { name: 'Docker', icon: '🐳' },
    { name: 'Prisma ORM', icon: '◬' },
    { name: 'Vite', icon: '⚡' },
  ];

  return (
    <section className="trust-seals-section" aria-label="Trust Seals & Social Proof">
      <div className="container">
        
        {/* Rating and Core Proof Badges */}
        <div className="trust-stats-bar">
          <div className="trust-stat-item">
            <div className="stars-row">
              {[...Array(5)].map((_, i) => (
                <Star key={i} size={15} fill="#fbbf24" color="#fbbf24" />
              ))}
              <span className="rating-num">4.9/5</span>
            </div>
            <span className="stat-sub">From 14,800+ DevOps & Frontend Engineers</span>
          </div>

          <div className="trust-divider"></div>

          <div className="trust-stat-item">
            <div className="stat-highlight">
              <Zap size={18} color="#00dfd8" />
              <span className="stat-num">50,000+</span>
            </div>
            <span className="stat-sub">Broken Deployments Healed Autonomously</span>
          </div>

          <div className="trust-divider"></div>

          <div className="trust-stat-item">
            <div className="stat-highlight">
              <ShieldCheck size={18} color="#10b981" />
              <span className="stat-num">99.99%</span>
            </div>
            <span className="stat-sub">Global Edge Reverse Proxy Uptime</span>
          </div>

          <div className="trust-divider"></div>

          <div className="trust-stat-item">
            <div className="stat-highlight">
              <Activity size={18} color="#c084fc" />
              <span className="stat-num">4.2x Faster</span>
            </div>
            <span className="stat-sub">Mean Time To Resolution (MTTR) with RAG</span>
          </div>
        </div>

        {/* Ecosystem Logos Carousel / Row */}
        <div className="trusted-by-row">
          <span className="trusted-by-label">POWERS DEVELOPERS ACROSS THE MODERN STACK:</span>
          <div className="logos-ticker">
            {logos.map((logo, idx) => (
              <div key={idx} className="tech-logo-pill">
                <span className="tech-logo-icon">{logo.icon}</span>
                <span className="tech-logo-name">{logo.name}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
