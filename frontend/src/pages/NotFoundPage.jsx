import React from 'react';
import { Link } from 'react-router-dom';
import ConsoleLayout from '../components/ConsoleLayout';
import { AlertCircle, ArrowLeft, Home, FolderGit2 } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <ConsoleLayout title="Page Not Found">
      <div
        style={{
          maxWidth: '560px',
          margin: '80px auto',
          textAlign: 'center',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            color: '#ef4444',
          }}
        >
          <AlertCircle size={32} />
        </div>

        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#ffffff',
            margin: '0 0 10px',
            letterSpacing: '-0.5px',
          }}
        >
          404 - Page Not Found
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: '#71717a',
            lineHeight: 1.6,
            marginBottom: '28px',
          }}
        >
          The page or resource you requested does not exist or may have been relocated.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <Link
            to="/projects"
            className="btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 22px',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            <Home size={15} />
            <span>Go to Dashboard</span>
          </Link>
          <Link
            to="/new"
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 20px',
              fontSize: '13px',
              textDecoration: 'none',
            }}
          >
            <FolderGit2 size={15} />
            <span>New Project</span>
          </Link>
        </div>
      </div>
    </ConsoleLayout>
  );
}
