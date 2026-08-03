import React, { useState } from "react";
import { 
  Mail, 
  Lock, 
  Globe, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  ShieldCheck 
} from "lucide-react";
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
          setErrMessage('Configuration Error: Access role layout structure is unrecognizable.');
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
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F4F3ED] p-6 relative font-sans antialiased selection:bg-indigo-600 selection:text-white">
      
      {/* Global Unified Language Toggle */}
      <button 
        type="button"
        onClick={toggleLanguage}
        className="absolute top-6 right-6 flex items-center gap-2 font-black text-[10px] text-slate-600 uppercase tracking-widest border border-slate-200/80 bg-white/90 backdrop-blur-md shadow-sm px-4 py-2.5 rounded-2xl hover:bg-slate-100/80 transition-all active:scale-95 z-50"
      >
        <Globe className="w-3.5 h-3.5 text-slate-500" />
        <span>{language === 'en' ? '🇺🇸 EN' : '🇫🇷 FR'}</span>
      </button>

      <div className="w-full max-w-md bg-white rounded-[36px] shadow-xl shadow-slate-200/50 p-8 md:p-10 border border-slate-100/80 relative overflow-hidden">
        
        {/* Brand Emblem & Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-slate-950 text-[#D4AF37] rounded-2xl flex items-center justify-center shadow-md mb-4 border border-slate-800">
            <ShieldCheck className="w-7 h-7" />
          </div>
          
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight uppercase italic leading-none mb-2">
            DON CHIKE <span className="text-indigo-600 not-italic">ELITE</span>
          </h1>
          
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">
            {translate('login_subtitle', 'Secure Business Management')}
          </p>
        </div>

        {/* Security Diagnostic Alert Block */}
        {errMessage && (
          <div className="flex items-center gap-3 p-4 rounded-2xl mb-6 text-xs font-bold text-red-600 bg-red-50/80 border border-red-200/60 shadow-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="leading-snug">{errMessage}</span>
          </div>
        )}
        
        {/* Core Input Form Controls */}
        <form onSubmit={handleLoginSubmit} className="space-y-4">
          
          {/* Email Field */}
          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-400 pointer-events-none">
              <Mail className="w-5 h-5" />
            </div>
            <input 
              type="email" 
              placeholder={translate('staff_email_label', 'Email Address')} 
              className="w-full pl-12 pr-5 py-4 bg-slate-50 text-slate-800 rounded-2xl text-sm font-bold outline-none border border-slate-200/60 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-400 placeholder:font-medium" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          {/* Password Field */}
          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-400 pointer-events-none">
              <Lock className="w-5 h-5" />
            </div>
            <input 
              type="password" 
              placeholder={translate('secure_password_label', 'Secure Password')} 
              className="w-full pl-12 pr-5 py-4 bg-slate-50 text-slate-800 rounded-2xl text-sm font-bold outline-none border border-slate-200/60 focus:border-indigo-600 focus:bg-white focus:ring-4 focus:ring-indigo-600/10 transition-all placeholder:text-slate-400 placeholder:font-medium" 
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          {/* Modernized Interactive Action Button */}
          <button 
            type="submit"
            disabled={loading} 
            className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-indigo-800 py-4 px-6 text-white font-black text-xs uppercase tracking-[0.18em] shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none mt-2"
          >
            {/* Shimmer Light Sweep Effect */}
            <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out pointer-events-none" />

            <div className="relative flex items-center justify-center gap-2.5">
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-200" />
                  <span>{translate('provisioning_msg', 'Authenticating...')}</span>
                </>
              ) : (
                <>
                  <span>{translate('authorize_staff_btn', 'Login to Suite')}</span>
                  <ArrowRight className="w-4 h-4 text-indigo-200 group-hover:translate-x-1 transition-transform duration-200" />
                </>
              )}
            </div>
          </button>
        </form>
      </div>
    </div>
  );
}