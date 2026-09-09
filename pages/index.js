import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Home() {
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
      setErrorMsg(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0c0f17', color: '#fff', fontFamily: 'sans-serif', direction: 'rtl', padding: '1rem' }}>
      <form onSubmit={handleLogin} style={{ backgroundColor: '#131822', padding: '2.5rem 2rem', borderRadius: '12px', width: '100%', maxWidth: '400px', border: '1px solid #d4af37', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', textAlign: 'center' }}>
        
        {/* اللوجو الذهبي الفاخر (AV) */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            width: '55px',
            height: '75px',
            border: '2px solid #d4af37',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 10px rgba(212, 175, 55, 0.2)'
          }}>
            <span style={{ color: '#d4af37', fontSize: '1.6rem', fontWeight: 'bold', fontFamily: 'serif', lineHeight: 1 }}>AV</span>
          </div>

          <h2 style={{ textAlign: 'center', margin: 0, color: '#d4af37', fontFamily: 'serif', fontSize: '1.5rem', letterSpacing: '3px' }}>ARCOVA</h2>
        </div>

        {errorMsg && <div style={{ backgroundColor: '#991b1b', color: '#fff', padding: '0.6rem', borderRadius: '4px', marginBottom: '1rem', textAlign: 'center', fontSize: '0.85rem' }}>{errorMsg}</div>}

        <div style={{ marginBottom: '1rem', textAlign: 'right' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d4af37' }}>البريد الإلكتروني</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#0c0f17', color: '#fff', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: '#d4af37' }}>كلمة المرور</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '0.7rem', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#0c0f17', color: '#fff', boxSizing: 'border-box', outline: 'none' }} />
        </div>

        <button type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', backgroundColor: '#d4af37', color: '#0c0f17', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}>
          {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
        </button>
      </form>
    </div>
  );
}
