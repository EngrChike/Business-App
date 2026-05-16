import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext.jsx'; // Global translation link
import { supabase } from '../../api/supabaseClient';

export default function Expenses({ onBack }) {
  const { t } = useLanguage(); // Initialize the translation engine parser
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ category: 'Transport', amount: '', description: '' });

  // Dynamically translated UI categories
  const categories = [
    { value: 'Transport', label: t('cat_transport') || 'Transport' },
    { value: 'Electricity', label: t('cat_electricity') || 'Electricity' },
    { value: 'Staff Lunch', label: t('cat_staff_lunch') || 'Staff Lunch' },
    { value: 'Repairs', label: t('cat_repairs') || 'Repairs' },
    { value: 'Cleaning', label: t('cat_cleaning') || 'Cleaning' },
    { value: 'Security', label: t('cat_security') || 'Security' },
    { value: 'Other', label: t('cat_other') || 'Other' }
  ];

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('created_at', { ascending: false });
    setExpenses(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('expenses').insert([{
      ...formData,
      amount: parseFloat(formData.amount),
      staff_id: user.id
    }]);

    if (!error) {
      setFormData({ category: 'Transport', amount: '', description: '' });
      fetchExpenses();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-24 font-sans">
      <div className="max-w-4xl mx-auto">
        <button onClick={onBack} className="text-blue-600 font-black mb-6 uppercase text-xs tracking-widest">
          {t('back')}
        </button>
        <h1 className="text-2xl font-black uppercase mb-8 italic">
          {t('business_expenses')}
        </h1>

        {/* LOG EXPENSE FORM */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-[40px] shadow-sm border mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select 
              className="p-4 bg-slate-100 rounded-2xl font-bold border-none"
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
            >
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <input 
              type="number" 
              placeholder={`${t('amount_label') || 'Amount'} (FCFA)`} 
              className="p-4 bg-slate-100 rounded-2xl font-bold border-none"
              value={formData.amount}
              onChange={e => setFormData({...formData, amount: e.target.value})}
              required
            />
            <input 
              type="text" 
              placeholder={`${t('description_label') || 'Description'} (${t('optional_label') || 'Optional'})`} 
              className="p-4 bg-slate-100 rounded-2xl font-bold border-none"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <button className="w-full mt-4 bg-red-500 text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95">
            {t('log_expense_btn') || 'Log Business Expense'} 💸
          </button>
        </form>

        {/* EXPENSE LOG LIST */}
        <div className="space-y-3">
          {expenses.map(exp => {
            // Find matched localized string entry for category flag display
            const matchedCat = categories.find(c => c.value === exp.category);
            return (
              <div key={exp.id} className="bg-white p-5 rounded-3xl border flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black text-red-500 uppercase">
                    {matchedCat ? matchedCat.label : exp.category}
                  </p>
                  <p className="text-sm font-bold text-slate-800">
                    {exp.description || (t('no_description') || 'No description')}
                  </p>
                  <p className="text-[9px] text-slate-400">
                    {new Date(exp.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-lg font-black text-slate-900">
                  -{exp.amount.toLocaleString()} <span className="text-[10px]">FCFA</span>
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}