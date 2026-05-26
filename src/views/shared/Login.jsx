import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext.jsx"; 
import { supabase } from "../../api/supabaseClient";

export default function Login() {
  // Use a fallback object check to prevent context parsing crashes
  const langContext = useLanguage() || {};
  const language = langContext.language || 'en';
  const toggleLanguage = langContext.toggleLanguage || (() => {});
  
  // Custom fail-safe translation macro wrapper
  const translate = (key, defaultText) => {
    try {
      if (langContext.t && typeof langContext.t === 'function') {
        const result = langContext.t(key);
        if (result && result !== key) return result;
      }
    } catch (e) {
      console.warn(`Translation fallback triggered for key: ${key}`);
    }
    return defaultText;
  };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage('');

    try {
      // 1. Authenticate credentials against Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({ 
        email: email.trim().toLowerCase(), 
        password 
      });

      if (error) {
        setErrMessage(error.message);
        return;
      }

      // 2. Safe Profile Check: Read as an array to prevent PostgREST .single() coercion crashes
      if (data?.user) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('role, is_active')
          .eq('id', data.user.id);

        // If there's an active database query error or the user row doesn't exist yet
        if (profileError || !profiles || profiles.length === 0) {
          // Bypass check for root master administrator profile row generation delay
          if (email.trim().toLowerCase() === 'donchike21@gmail.com') {
            return;
          }
          setErrMessage(translate('profile_read_err', 'Account verification failed. Please contact your system administrator.'));
          return;
        }

        const userProfile = profiles[0];

        // 3. Slam the door if 'is_active' is explicitly false
        if (userProfile && userProfile.is_active === false) {
          await supabase.auth.signOut(); // Immediately destroy the session token
          setErrMessage(translate('suspended_account_err', 'This account has been suspended. Please contact the administrator.'));
          return;
        }

        // 4. Verify role parsing syntax matching enum types
        const stringRole = userProfile.role ? String(userProfile.role).toLowerCase().trim() : '';
        if (stringRole !== 'admin' && stringRole !== 'manager' && stringRole !== 'staff') {
          await supabase.auth.signOut();
          setErrMessage('🔒 Configuration Error: Access role layout structure is unrecognizable.');
          return;
        }
      }
    } catch (err) {
      setErrMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F3ED] p-6 relative font-sans antialiased">
      
      {/* Global Unified Language Toggle */}
      <button 
        type="button"
        onClick={toggleLanguage}
        className="absolute top-6 right-6 font-black text-[10px] text-slate-400 uppercase tracking-widest border border-slate-200 bg-white shadow-sm px-4 py-2 rounded-xl hover:bg-slate-50 transition-all active:scale-95 z-50"
      >
        {language === 'en' ? '🇺🇸 EN' : '🇫🇷 FR'}
      </button>

      <div className="w-full max-w-md bg-white rounded-[40px] shadow-sm p-8 md:p-10 border border-slate-100">
        
        {/* Brand Header */}
        <h1 className="text-3xl font-black text-[#3F51B5] text-center mb-1 tracking-tighter italic">
          DON CHIKE <span className="text-slate-900 not-italic">ELITE</span>
        </h1>
        <p className="text-slate-400 text-center mb-10 text-[10px] font-bold uppercase tracking-widest">
          {translate('login_subtitle', 'Secure Business Management')}
        </p>

        {/* Diagnostic Security Alert Blocks */}
        {errMessage && (
          <div className="p-4 rounded-2xl mb-6 text-xs font-black uppercase text-center tracking-wider bg-red-50 text-[#FF5A50] border border-red-100">
            ❌ {errMessage}
          </div>
        )}
        
        {/* Core Input Form Controls */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div>
            <input 
              type="email" 
              placeholder={translate('staff_email_label', 'Email Address')} 
              className="w-full p-5 bg-slate-50 text-slate-800 rounded-[20px] text-sm font-bold outline-none border border-transparent focus:border-[#3F51B5] focus:bg-white transition-all shadow-inner" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div>
            <input 
              type="password" 
              placeholder={translate('secure_password_label', 'Secure Password')} 
              className="w-full p-5 bg-slate-50 text-slate-800 rounded-[20px] text-sm font-bold outline-none border border-transparent focus:border-[#3F51B5] focus:bg-white transition-all shadow-inner" 
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            disabled={loading} 
            className="w-full bg-[#1C1B1F] text-white font-black py-5 rounded-[20px] transition-all shadow-md hover:opacity-90 active:scale-[0.98] uppercase text-xs tracking-widest disabled:opacity-50 mt-2"
          >
            {loading ? translate('provisioning_msg', 'Authenticating...') : translate('authorize_staff_btn', 'Login to Suite')}
          </button>
        </form>
      </div>
    </div>
  );
}