import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
      } else if (data?.user) {
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setErrorMsg('خطأ: ' + err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'sans-serif', direction: 'rtl' }}>
      <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: '400px', padding: '2rem', backgroundColor: '#1e293b', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1.5rem', color: '#38bdf8' }}>ARCOVA CRM</h2>
        
        {errorMsg && (
          <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: '#ef444422', border: '1px solid #ef4444', color: '#f87171', borderRadius: '4px', fontSize: '0.875rem' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>البريد الإلكتروني</label>
          <input 
            type="email" 
            required 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', outline: 'none' }} 
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>كلمة المرور</label>
          <input 
            type="password" 
            required 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #334155', backgroundColor: '#0f172a', color: '#fff', outline: 'none' }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: 'none', backgroundColor: '#0284c7', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}
        >
          {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
}
