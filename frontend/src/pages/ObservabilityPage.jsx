import React, { useState } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  ChevronDown, 
  ExternalLink, 
  Sparkles, 
  Activity, 
  Database, 
  Cpu, 
  Globe, 
  ShieldCheck, 
  Zap,
  BarChart,
  LineChart
} from 'lucide-react';

export default function ObservabilityPage() {
  const [activeTab, setActiveTab] = useState('Overview');

  return (
    <ConsoleLayout title="Observability">
      <div className="observability-page-container">
        
        {/* Observability Sub-Sidebar matching Image 2 */}
        <aside className="obs-subsidebar">
          <span className="obs-nav-heading">Observability</span>
          <div className="obs-nav-item active">Overview</div>
          <div className="obs-nav-item">Query</div>
          <div className="obs-nav-item">Notebooks</div>
          <div className="obs-nav-item">Alerts</div>
          <div className="obs-nav-item">Custom Metrics</div>

          <span className="obs-nav-heading mt-4">Compute</span>
          <div className="obs-nav-item">Functions</div>
          <div className="obs-nav-item">Agent Runs</div>
          <div className="obs-nav-item">Sandboxes</div>
          <div className="obs-nav-item">Cron Jobs</div>
          <div className="obs-nav-item">External APIs</div>
          <div className="obs-nav-item">Middleware</div>
          <div className="obs-nav-item">Runtime Cache</div>

          <span className="obs-nav-heading mt-4">CDN</span>
          <div className="obs-nav-item">CDN Requests</div>
          <div className="obs-nav-item">ISR</div>
          <div className="obs-nav-item">PPR</div>
          <div className="obs-nav-item">Fast Data Transfer</div>
          <div className="obs-nav-item">Image Optimization</div>
          <div className="obs-nav-item">External Origins</div>
          <div className="obs-nav-item">Microfrontends</div>
        </aside>

        {/* Main View matching Image 2 */}
        <div className="obs-main-view">
          {/* Top Controls */}
          <div className="obs-top-controls">
            <button type="button" className="btn-add-filter">
              <span>Production</span>
              <ChevronDown size={13} />
            </button>

            <button type="button" className="btn-add-filter">
              <span>Last 12 hours</span>
              <ChevronDown size={13} />
            </button>
          </div>

          {/* Upgrade Banner matching Image 2 */}
          <div className="obs-banner-pro">
            <div className="flex-center gap-2">
              <Sparkles size={16} color="#c084fc" />
              <span>Upgrade to Pro to get Observability Plus, including anomaly alerts, custom queries, 30-day retention, and more.</span>
            </div>
            <button type="button">Upgrade to Pro</button>
          </div>

          {/* 4 Chart Cards Grid matching Image 2 */}
          <div className="obs-charts-grid">
            
            {/* Card 1: CDN Requests */}
            <div className="obs-chart-card">
              <div className="obs-chart-header">
                <span>CDN Requests</span>
                <ChevronDown size={14} color="#666" />
              </div>
              <div className="obs-chart-legend">
                <span><span className="legend-dot" style={{ background: '#3b82f6' }}></span>2XX</span>
                <span><span className="legend-dot" style={{ background: '#f59e0b' }}></span>4XX</span>
                <span><span className="legend-dot" style={{ background: '#10b981' }}></span>3XX</span>
                <span><span className="legend-dot" style={{ background: '#ef4444' }}></span>5XX</span>
              </div>
              <svg className="obs-svg-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
                <rect x="50" y="80" width="4" height="40" fill="#3b82f6" />
                <rect x="120" y="90" width="4" height="30" fill="#3b82f6" />
                <rect x="180" y="85" width="4" height="35" fill="#3b82f6" />
                <rect x="240" y="20" width="5" height="100" fill="#3b82f6" />
                <rect x="290" y="75" width="4" height="45" fill="#3b82f6" />
                <rect x="350" y="90" width="4" height="30" fill="#3b82f6" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="#222" />
              </svg>
              <div className="obs-chart-footer">
                <span>12h ago</span>
                <span>2m ago</span>
              </div>
            </div>

            {/* Card 2: Fast Data Transfer */}
            <div className="obs-chart-card">
              <div className="obs-chart-header">
                <span>Fast Data Transfer</span>
                <ChevronDown size={14} color="#666" />
              </div>
              <div className="obs-chart-legend">
                <span><span className="legend-dot" style={{ background: '#3b82f6' }}></span>Outgoing: 3MB</span>
                <span><span className="legend-dot" style={{ background: '#eab308' }}></span>Incoming: 144KB</span>
              </div>
              <svg className="obs-svg-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
                <rect x="80" y="85" width="4" height="35" fill="#3b82f6" />
                <rect x="190" y="30" width="5" height="90" fill="#3b82f6" />
                <rect x="210" y="45" width="5" height="75" fill="#3b82f6" />
                <rect x="310" y="65" width="4" height="55" fill="#3b82f6" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="#222" />
              </svg>
              <div className="obs-chart-footer">
                <span>12h ago</span>
                <span>2m ago</span>
              </div>
            </div>

            {/* Card 3: Functions */}
            <div className="obs-chart-card">
              <div className="obs-chart-header">
                <span>ShipStack Functions</span>
                <ChevronDown size={14} color="#666" />
              </div>
              <div className="obs-chart-legend">
                <span><span className="legend-dot" style={{ background: '#ef4444' }}></span>Error: 0%</span>
                <span><span className="legend-dot" style={{ background: '#f59e0b' }}></span>Timeout: 0%</span>
              </div>
              <svg className="obs-svg-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
                <line x1="20" y1="110" x2="380" y2="110" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 6" />
                <circle cx="200" cy="110" r="3" fill="#f59e0b" />
              </svg>
              <div className="obs-chart-footer">
                <span>12h ago</span>
                <span>2m ago</span>
              </div>
            </div>

            {/* Card 4: Compute */}
            <div className="obs-chart-card">
              <div className="obs-chart-header">
                <span>Compute</span>
                <ChevronDown size={14} color="#666" />
              </div>
              <div className="obs-chart-legend">
                <span><span className="legend-dot" style={{ background: '#3b82f6' }}></span>Active CPU: 10s</span>
              </div>
              <svg className="obs-svg-chart" viewBox="0 0 400 120" preserveAspectRatio="none">
                <path 
                  d="M0 115 L50 115 L60 95 L70 115 L140 115 L150 90 L160 115 L220 115 L230 40 L240 115 L290 115 L300 80 L310 115 L400 115" 
                  fill="none" 
                  stroke="#3b82f6" 
                  strokeWidth="2" 
                />
              </svg>
              <div className="obs-chart-footer">
                <span>12h ago</span>
                <span>2m ago</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </ConsoleLayout>
  );
}
