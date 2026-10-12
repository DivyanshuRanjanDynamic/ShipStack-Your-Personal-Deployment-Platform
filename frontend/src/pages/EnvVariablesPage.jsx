import React, { useState } from 'react';
import ConsoleLayout from '../components/ConsoleLayout';
import { 
  Lock, 
  Code, 
  MoreHorizontal, 
  Search, 
  ChevronDown, 
  Plus, 
  Eye, 
  EyeOff, 
  CheckSquare
} from 'lucide-react';

export default function EnvVariablesPage() {
  const [activeTab, setActiveTab] = useState('Project');
  const [showValues, setShowValues] = useState({});

  const toggleShow = (id) => {
    setShowValues(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const envVars = [
    { id: '1', key: 'MONGODB_URI', target: 'Production and Preview', date: 'Added Apr 23', isSecret: true },
    { id: '2', key: 'NEXT_PUBLIC_FIREBASE_PROJECT_ID', target: 'Production and Preview', date: 'Added Apr 20', isSecret: true },
    { id: '3', key: 'NEXT_PUBLIC_FIREBASE_APP_ID', target: 'Production and Preview', date: 'Added Apr 20', isSecret: true },
    { id: '4', key: 'NEXT_PUBLIC_FIREBASE_API_KEY', target: 'Production and Preview', date: 'Added Apr 20', isSecret: true },
    { id: '5', key: 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', target: 'Production and Preview', date: 'Added Apr 20', isSecret: true },
    { id: '6', key: 'FIREBASE_PRIVATE_KEY', target: 'All Environments', date: 'Updated Apr 17', attention: true, isSecret: false },
    { id: '7', key: 'FIREBASE_CLIENT_EMAIL', target: 'All Environments', date: 'Updated Apr 17', isSecret: false },
    { id: '8', key: 'FIREBASE_PROJECT_ID', target: 'All Environments', date: 'Updated Apr 17', isSecret: false },
    { id: '9', key: 'ADMIN_EMAILS', target: 'All Environments', date: 'Added Apr 17', isSecret: false },
    { id: '10', key: 'RESEND_FROM_EMAIL', target: 'All Environments', date: 'Updated Apr 17', isSecret: false },
    { id: '11', key: 'NEXT_PUBLIC_RAZORPAY_KEY', target: 'All Environments', date: 'Added Apr 17', isSecret: false },
    { id: '12', key: 'AWS_SECRET_ACCESS_KEY', target: 'All Environments', date: 'Updated Apr 17', attention: true, isSecret: false },
    { id: '13', key: 'APP_URL', target: 'All Environments', date: 'Updated Apr 17', isSecret: false },
    { id: '14', key: 'RESEND_API_KEY', target: 'All Environments', date: 'Updated Apr 17', attention: true, isSecret: false },
    { id: '15', key: 'AWS_S3_BUCKET', target: 'All Environments', date: 'Updated Mar 19', isSecret: false },
    { id: '16', key: 'AWS_REGION', target: 'All Environments', date: 'Updated Mar 13', isSecret: false },
    { id: '17', key: 'AWS_ACCESS_KEY_ID', target: 'All Environments', date: 'Added Mar 13', attention: true, isSecret: false },
    { id: '18', key: 'RAZORPAY_KEY_SECRET', target: 'All Environments', date: 'Added Mar 3', attention: true, isSecret: false },
    { id: '19', key: 'RAZORPAY_KEY_ID', target: 'All Environments', date: 'Added Mar 3', isSecret: false },
    { id: '20', key: 'NEXT_PUBLIC_APP_URL', target: 'All Environments', date: 'Added Mar 2', isSecret: false },
  ];

  return (
    <ConsoleLayout title="Environment Variables">
      <div className="env-page-view">
        <div className="flex-center justify-between">
          <div>
            <h1>Environment Variables</h1>
            <p className="env-page-desc">
              Store API keys, tokens, and config securely. <a href="#">Learn more about environment variables</a>
            </p>
          </div>

          <div className="flex-center gap-2">
            <button type="button" className="btn-add-filter">Link Shared Variable</button>
            <button type="button" className="btn-add-env">Add Environment Variable</button>
          </div>
        </div>

        {/* Tabs: Project / Shared matching Image 5 */}
        <div className="env-tabs">
          <button 
            type="button" 
            className={`env-tab ${activeTab === 'Project' ? 'active' : ''}`}
            onClick={() => setActiveTab('Project')}
          >
            Project
          </button>
          <button 
            type="button" 
            className={`env-tab ${activeTab === 'Shared' ? 'active' : ''}`}
            onClick={() => setActiveTab('Shared')}
          >
            Shared
          </button>
        </div>

        {/* Search & Filters matching Image 5 */}
        <div className="env-filters-row">
          <input type="text" placeholder="Search variables..." className="env-search-input" />
          <button type="button" className="btn-add-filter"><span>All Types</span><ChevronDown size={12} /></button>
          <button type="button" className="btn-add-filter"><span>All Environments</span><ChevronDown size={12} /></button>
          <button type="button" className="btn-add-filter"><span>All Editors</span><ChevronDown size={12} /></button>
          <button type="button" className="btn-add-filter"><span>All Variables</span><ChevronDown size={12} /></button>
          <button type="button" className="btn-add-filter"><span>Last Updated</span><ChevronDown size={12} /></button>
        </div>

        {/* Variables Table matching Image 5 */}
        <div className="env-table">
          {envVars.map((ev) => (
            <div key={ev.id} className="env-row">
              <div className="env-col-key">
                {ev.isSecret ? <Lock size={13} color="#777" /> : <Code size={13} color="#777" />}
                <span>{ev.key}</span>
                {ev.attention && (
                  <span className="env-attention-badge">Needs Attention</span>
                )}
              </div>

              <div className="env-col-val" onClick={() => toggleShow(ev.id)} style={{ cursor: 'pointer' }} title="Click to reveal/hide">
                {showValues[ev.id] ? <span style={{ letterSpacing: 'normal', color: '#00dfd8' }}>prod_sk_live_94a2b</span> : '••••••••••••'}
              </div>

              <div className="env-col-target">
                <span>{ev.target}</span>
              </div>

              <div className="env-col-author">
                <img 
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" 
                  alt="author" 
                  className="deploy-avatar-img"
                  style={{ width: 16, height: 16 }}
                />
                <span>{ev.date}</span>
              </div>

              <div className="env-col-actions">
                <MoreHorizontal size={14} />
              </div>
            </div>
          ))}
        </div>

        {/* Checkbox at bottom matching Image 5 */}
        <div className="mt-4 flex-center gap-2 text-dim" style={{ fontSize: 13 }}>
          <input type="checkbox" defaultChecked id="sys-env" />
          <label htmlFor="sys-env">Enable access to System Environment Variables</label>
        </div>

      </div>
    </ConsoleLayout>
  );
}
