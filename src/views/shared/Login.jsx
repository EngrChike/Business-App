import React, { useState } from "react";
import { useLanguage } from "../../context/LanguageContext.jsx"; // Connected to your global toggle engine
import { supabase } from "../../api/supabaseClient";

export default function Login() {
  const { language, toggleLanguage, t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errMessage, setErrMessage] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrMessage('');

    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });

      if (error) {
        setErrMessage(error.message);
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
        onClick={toggleLanguage}
        className="absolute top-6 right-6 font-black text-[10px] text-slate-400 uppercase tracking-widest border border-slate-200 bg-white shadow-sm px-4 py-2 rounded-xl hover:bg-slate-50 transition-all active:scale-95"
      >
        {language === 'en' ? '🇺🇸 EN' : '🇫🇷 FR'}
      </button>

      <div className="w-full max-w-md bg-white rounded-[40px] shadow-sm p-8 md:p-10 border border-slate-100">
        
        {/* Brand Header */}
        <h1 className="text-3xl font-black text-[#3F51B5] text-center mb-1 tracking-tighter italic">
          DON CHIKE <span className="text-slate-900 not-italic">ELITE</span>
        </h1>
        <p className="text-slate-400 text-center mb-10 text-[10px] font-bold uppercase tracking-widest">
          {t('login_subtitle') || 'Secure Business Management'}
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
              placeholder={t('staff_email_label') || 'Email Address'} 
              className="w-full p-5 bg-slate-50 text-slate-800 rounded-[20px] text-sm font-bold outline-none border border-transparent focus:border-[#3F51B5] focus:bg-white transition-all shadow-inner" 
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>
          
          <div>
            <input 
              type="password" 
              placeholder={t('secure_password_label') || 'Secure Password'} 
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
            {loading ? (t('provisioning_msg') || "Authenticating...") : (t('authorize_staff_btn') ? t('authorize_staff_btn').replace('🔑', '') : "Login to Suite")}
          </button>
        </form>
      </div>
    </div>
  );
}