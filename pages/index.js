import React from 'react';

export default function Home() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      color: '#ffffff',
      fontFamily: 'sans-serif',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        padding: '40px',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{ color: '#38bdf8', marginBottom: '10px' }}>ARCOVA CRM</h1>
        <p style={{ color: '#94a3b8', marginBottom: '20px' }}>نظام إدارة العقارات والمبيعات</p>
        <button style={{
          backgroundColor: '#0284c7',
          color: '#ffffff',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '6px',
          fontSize: '16px',
          cursor: 'pointer',
          width: '100%'
        }}>
          تسجيل الدخول للنظام
        </button>
      </div>
    </div>
  );
}

