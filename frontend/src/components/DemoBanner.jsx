import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { isDemoMode, onDemoModeChange } from '../services/api';
import './DemoBanner.css';

const REPO_URL = 'https://github.com/DivyanshuRanjanDynamic/ShipStack-Your-Personal-Deployment-Platform';
const VIDEO_URL = import.meta.env.VITE_DEMO_VIDEO_URL || '';
const DISMISS_KEY = 'shipstack-demo-banner-dismissed';

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Tells visitors of a public deployment that the console is showing sample data and why.
 * Renders nothing unless demo mode is on (see services/api.js).
 */
export default function DemoBanner() {
  const [demo, setDemo] = useState(isDemoMode());
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => onDemoModeChange(setDemo), []);

  if (!demo || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Storage unavailable (private window); the banner just returns on the next visit.
    }
  };

  return (
    <div className="demo-banner" role="status">
      <span className="demo-banner__dot" aria-hidden="true" />
      <div className="demo-banner__body">
        <div className="demo-banner__title">Live demo with sample data · deploying is turned off</div>
        <div className="demo-banner__detail">
          The build pipeline (AWS ECS, Kafka, ClickHouse and the AI diagnosis service) runs on a private
          AWS account, so this console shows recorded deployments instead of live ones.
        </div>
        <div className="demo-banner__links">
          {VIDEO_URL && (
            <a href={VIDEO_URL} target="_blank" rel="noreferrer">Watch the full demo</a>
          )}
          <a href={REPO_URL} target="_blank" rel="noreferrer">Source on GitHub</a>
        </div>
      </div>
      <button type="button" className="demo-banner__close" onClick={dismiss} aria-label="Dismiss demo notice">
        <X size={16} />
      </button>
    </div>
  );
}
