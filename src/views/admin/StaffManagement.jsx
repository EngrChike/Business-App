import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Centralized translation wrapper hook
import { supabase } from '../../api/supabaseClient';

export default function StaffManagement({ onBack }) {
  const { t } = useLanguage(); // Uses the same global state language engine
  const [fullName, setFullName] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (!fullName.trim()) {
      setMessage(t('err_fullname_required') || "❌ Error: Staff Full Name is required.");
      setLoading(false);
      return;
    }

    // 1. Secure Authentication Registration
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    if (error) {
      setMessage("❌ Error: " + error.message);
    } else if (data?.user) {
      // 2. High-Reliability Role & Profile Assignment Engine
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          id: data.user.id,
          full_name: fullName.trim(), 
          email: email.trim().toLowerCase(),
          role: 'staff',
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id);

      // If update fails because profile entry doesn't exist yet, fallback to upsert
      if (profileError) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .upsert({ 
            id: data.user.id,
            full_name: fullName.trim(), 
            email: email.trim().toLowerCase(),
            role: 'staff',
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (upsertError) {
          setMessage((t('err_profile_mapping') || "⚠️ Auth created, but profile mapping failed: ") + upsertError.message);
          setLoading(false);
          return;
        }
      }

      setMessage(t('staff_created_success') || "✅ Staff Account Created! Access profile is active.");
      setFullName('');
      setEmail('');
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 font-sans flex items-center justify-center">
      <div className="bg-[#0f172a] text-white p-8 rounded-[40px] shadow-2xl max-w-md w-full border border-white/5 relative">
        
        {/* RETOUR CONTROLLER */}
        <button onClick={onBack} className="text-blue-500 font-black text-xs uppercase tracking-widest absolute top-8 left-8 hover:text-blue-400 transition-all">
          {t('back')}
        </button>

        <div className="text-right mb-8">
          <h2 className="text-white font-black uppercase text-lg tracking-tight italic">
            {t('access_control') || 'Access Control'}
          </h2>
          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
            {t('staff_provisioning') || 'Staff Account Provisioning'}
          </p>
        </div>

        {/* FEEDBACK DISPLAY STATE */}
        {message && (
          <div className={`p-4 rounded-2xl mb-6 text-xs font-black uppercase text-center tracking-wider border ${
            message.includes('❌') || message.includes('⚠️') 
              ? 'bg-red-500/10 text-red-400 border-red-500/20' 
              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {message}
          </div>
        )}

        <form onSubmit={handleCreateStaff} className="space-y-4">
          {/* STAFF FULL NAME */}
          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
              {t('staff_full_name_label') || 'Staff Full Name'}
            </label>
            <input 
              type="text" 
              value={fullName} 
              onChange={(e) => setFullName(e.target.value)}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold transition-all text-sm"
              placeholder="e.g., John Doe"
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
              {t('staff_email_label') || 'Staff Email Address'}
            </label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold transition-all text-sm"
              placeholder="e.g., staff@business.com"
              required
            />
          </div>

          <div>
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 px-1">
              {t('secure_password_label') || 'Secure Password'}
            </label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl outline-none focus:border-blue-500 text-white font-bold transition-all text-sm tracking-wide"
              placeholder="••••••••••••"
              minLength={6}
              required
            />
          </div>

          <button 
            type="submit"
            disabled={loading} 
            className="w-full p-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition-all active:scale-95 border-b-4 border-blue-800 disabled:opacity-50 mt-4"
          >
            {loading ? (t('provisioning_msg') || "Provisioning...") : (t('authorize_staff_btn') || "Authorize New Staff Account 🔑")}
          </button>
        </form>
      </div>
    </div>
  );
}