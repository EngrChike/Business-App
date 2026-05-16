import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

const dictionary = {
  en: {
    // Shared / Navigation Universal Elements
    back: "← Back",
    cancel: "Cancel",
    save: "Save",
    loading: "Loading...",
    
    // Auth / Shift States / Login
    active_shift: "ACTIVE SHIFT",
    sign_out: "🚪 Sign Out App",
    login_subtitle: "Secure Business Management",
    
    // Dashboards Main Menu / Global Views
    service_ops: "Service Operations",
    sales_terminal: "New Sale Terminal",
    register_counters: "Start counter order now",
    debtor_ledger: "Debtors Ledger",
    unpaid_tabs: "Manage Unpaid customer Tabs",
    gestion_stock: "Inventory & Stock",
    global_stock: "Manage products, refills, and metrics",
    business_expenses: "Business Expenses",
    log_costs: "Log operations costs & outgoings",
    
    // Inventory View Intelligence
    inventory_intel: "Inventory Intelligence",
    restock_alert: "Restock Alert",
    items_low: "items running low",
    get_market_list: "GET MARKET LIST 📋",
    log_refill: "Log Logistics Refill",
    adding_stock_to: "Adding stock to",
    current_stock: "Currently",
    incoming_units_placeholder: "Incoming units count...",
    apply_refill: "Apply Refill",
    voice_command: "Voice Command",
    voice_example: '"Add 20 cases of Guinness..."',
    register_new_batch: "Register New Batch Line",
    product_name: "Product Name",
    initial_quantity: "Initial Quantity",
    cost_price: "Cost Price",
    sales_price: "Sales Price",
    save_product: "Save Product",
    critical_stock: "Critical Stock",
    stock_level: "Stock Level",
    refill: "Refill",
    
    // Business Expenses Module
    cat_transport: "Transport",
    cat_electricity: "Electricity",
    cat_staff_lunch: "Staff Lunch",
    cat_repairs: "Repairs",
    cat_cleaning: "Cleaning",
    cat_security: "Security",
    cat_other: "Other",
    amount_label: "Amount",
    description_label: "Description",
    optional_label: "Optional",
    log_expense_btn: "Log Business Expense",
    no_description: "No description",
    
    // Debtors Control Ledger
    walking_customer: "Walking Customer",
    access_denied_msg: "❌ Operational Access Denied: Only the Admin/CEO can execute balance settlement actions.",
    confirm_settle_prefix: "Confirm verified cash/bank receipt of",
    confirm_settle_mid: "from",
    confirm_settle_suffix: "This will permanently close out these records.",
    ledger_cleared_for: "Ledger cleared for",
    balance_closed_success: "Balance successfully closed.",
    error_reconciling: "Error Reconciling Ledger: ",
    outstanding_registry: "Outstanding Credit Registry",
    no_phone_registered: "No Phone Registered",
    balance_owed: "Balance Owed",
    unpaid_balances: "Unpaid Balances",
    reconciling_accounts: "Reconciling Accounts...",
    clear_total_balance_btn: "Clear Total Balance ✅",
    view_only_mode: "View Only Mode — Awaiting Admin Cash Settlement",
    all_accounts_balanced: "All Accounts Balanced",

    // Front-end Sales View Entry
    sales_entry: "Sales Entry",
    choose_item: "Choose Item",
    select_item_option: "Select Item",
    qty_label: "Qty",
    payment_method: "Payment Method",
    open_tab_btn: "Open Tab 🚨",
    immediate_cash_btn: "Immediate Cash 💰",
    debtor_name_placeholder: "Debtor Name",
    debtor_phone_placeholder: "Debtor Phone",
    confirm_order_btn: "Confirm Order",
    sales_shift_today: "Your Sales Shift Today",
    no_transactions_shift: "No transactions completed yet this shift.",
    quantity_size: "Quantity Size",
    shift_revenue: "Shift Revenue",
    processing_ledger: "Processing Ledger...",
    approve_sale_btn: "Approve Sale",
    cash_customer: "Cash Customer",
    alert_select_product: "Select a product first",
    alert_sale_recorded: "Sale Recorded Successfully!",
    submission_error: "Submission Error: ",

    // Staff Account Provisioning Control (StaffManagement.jsx)
    access_control: "Access Control",
    staff_provisioning: "Staff Account Provisioning",
    staff_full_name_label: "Staff Full Name",
    staff_email_label: "Staff Email Address",
    secure_password_label: "Secure Password",
    provisioning_msg: "Provisioning...",
    authorize_staff_btn: "Authorize New Staff Account 🔑",
    err_fullname_required: "❌ Error: Staff Full Name is required.",
    err_profile_mapping: "⚠️ Auth created, but profile mapping failed: ",
    staff_created_success: "✅ Staff Account Created! Access profile is active.",

    // Staff Performance & Reports Hub (StaffPerformance.jsx / Reports.jsx)
    back_main_console: "← Main Console",
    perf_intel_tag: "Performance Intel",
    ceo_oversight_title: "👑 CEO Oversight Hub",
    shift_metrics_title: "📋 Shift Log Metrics",
    syncing_ledgers_msg: "Synchronizing Corporate Ledgers...",
    historical_ledgers_label: "Historical Month Ledgers",
    no_history_found: "No Logged Operational History Found",
    shift_windows_logged: "Operational Shift Windows Logged",
    target_scope_badge: "Active Target Scope",
    operational_window_desc: "Standard Operational Window: 06:00 AM - 06:00 AM",
    view_run_btn: "View Run",
    target_date_badge: "Target Date Selection",
    active_ledger_runs_label: "Active Ledger Runs",
    gross_turnover_label: "Gross Turnover",
    shift_closeout_title: "Shift Closeout Summary",
    window_label: "Window",
    cash_to_handover_label: "Cash to Hand Over",
    unpaid_tabs_balance_label: "Unpaid Tabs Balance (Debts Logged)",
    itemized_receipts_label: "Itemized Ledger Receipts",
    product_item_fallback: "Product Item",
    client_label: "Client",
    direct_retail_fallback: "Direct Retail Counter",
    payment_status_paid: "paid",
    payment_status_debt: "debt",
    print_summary_btn: "Print Shift Receipt Summary 📄",
    
    // Core System Alerts & Security Diagnostics
    market_list_copied: "Market List copied to clipboard!",
    restock_success: "Restocked Successfully! Alert Cleared.",
    security_check: "SECURITY CHECK",
    delete_confirm_msg: "Are you sure you want to permanently delete this entry from your active inventory? This action cannot be reversed.",
    delete_success: "Entry successfully deleted from registry."
  },
  fr: {
    // Shared / Navigation Universal Elements
    back: "← Retour",
    cancel: "Annuler",
    save: "Enregistrer",
    loading: "Chargement...",
    
    // Auth / Shift States / Login
    active_shift: "SHIFT ACTIF",
    sign_out: "🚪 Déconnexion",
    login_subtitle: "Gestion d'Entreprise Sécurisée",
    
    // Dashboards Main Menu / Global Views
    service_ops: "Opérations de Service",
    sales_terminal: "Terminal des Ventes",
    register_counters: "Démarrer une commande comptoir",
    debtor_ledger: "Registre des Débiteurs",
    unpaid_tabs: "Gérer les ardoises clients impayées",
    gestion_stock: "Inventaire & Stock",
    global_stock: "Gérer les produits, recharges et métriques",
    business_expenses: "Dépenses de l'Entreprise",
    log_costs: "Enregistrer les coûts d'exploitation",
    
    // Inventory View Intelligence
    inventory_intel: "Intelligence de l'Inventaire",
    restock_alert: "Alerte de Réapprovisionnement",
    items_low: "articles presque épuisés",
    get_market_list: "OBTENIR LA LISTE DE MARCHÉ 📋",
    log_refill: "Enregistrer le Ravitaillement",
    adding_stock_to: "Ajout de stock pour",
    current_stock: "Actuellement",
    incoming_units_placeholder: "Nombre d'unités entrantes...",
    apply_refill: "Appliquer le Ravitaillement",
    voice_command: "Commande Vocale",
    voice_example: '"Ajouter 20 caisses de Guinness..."',
    register_new_batch: "Enregistrer un Nouveau Lot",
    product_name: "Nom du Produit",
    initial_quantity: "Quantité Initiale",
    cost_price: "Prix d'Achat",
    sales_price: "Prix de Vente",
    save_product: "Enregistrer le Produit",
    critical_stock: "Stock Critique",
    stock_level: "Niveau de Stock",
    refill: "Ravitallier",
    
    // Business Expenses Module
    cat_transport: "Transport",
    cat_electricity: "Électricité",
    cat_staff_lunch: "Déjeuner du personnel",
    cat_repairs: "Réparations",
    cat_cleaning: "Nettoyage",
    cat_security: "Sécurité",
    cat_other: "Autre",
    amount_label: "Montant",
    description_label: "Description",
    optional_label: "Optionnel",
    log_expense_btn: "Enregistrer la dépense",
    no_description: "Aucune description",
    
    // Debtors Control Ledger
    walking_customer: "Client de passage",
    access_denied_msg: "❌ Accès opérationnel refusé : Seul l'Administrateur/CEO peut effectuer des règlements.",
    confirm_settle_prefix: "Confirmer la réception vérifiée en espèces/banque de",
    confirm_settle_mid: "de la part de",
    confirm_settle_suffix: "Cette action fermera définitivement ces enregistrements.",
    ledger_cleared_for: "Registre soldé pour",
    balance_closed_success: "Compte clôturé avec succès.",
    error_reconciling: "Erreur lors du rapprochement du grand livre : ",
    outstanding_registry: "Registre des Crédits en Cours",
    no_phone_registered: "Aucun téléphone enregistré",
    balance_owed: "Solde Dû",
    unpaid_balances: "Ardoises Non Payées",
    reconciling_accounts: "Rapprochement des comptes...",
    clear_total_balance_btn: "Solder le Compte Total ✅",
    view_only_mode: "Mode Lecture Seule — En attente du règlement Admin",
    all_accounts_balanced: "Tous les comptes sont soldés",

    // Front-end Sales View Entry
    sales_entry: "Saisie des Ventes",
    choose_item: "Choisir un article",
    select_item_option: "Sélectionner l'article",
    qty_label: "Qté",
    payment_method: "Mode de Paiement",
    open_tab_btn: "Ouvrir une Ardoise 🚨",
    immediate_cash_btn: "Espèces Immédiates 💰",
    debtor_name_placeholder: "Nom du débiteur",
    debtor_phone_placeholder: "Téléphone du débiteur",
    confirm_order_btn: "Confirmer la commande",
    sales_shift_today: "Votre shift de vente aujourd'hui",
    no_transactions_shift: "Aucune transaction effectuée pendant ce shift.",
    quantity_size: "Quantité",
    shift_revenue: "Revenu du Shift",
    processing_ledger: "Mise à jour du registre...",
    approve_sale_btn: "Approuver la vente",
    cash_customer: "Client au comptant",
    alert_select_product: "Veuillez d'abord sélectionner un produit",
    alert_sale_recorded: "Vente enregistrée avec succès !",
    submission_error: "Erreur d'envoi : ",

    // Staff Account Provisioning Control (StaffManagement.jsx)
    access_control: "Contrôle d'Accès",
    staff_provisioning: "Création de Compte Personnel",
    staff_full_name_label: "Nom Complet de l'Employé",
    staff_email_label: "Adresse Email de l'Employé",
    secure_password_label: "Mot de Passe Sécurisé",
    provisioning_msg: "Création du compte...",
    authorize_staff_btn: "Autoriser le Nouveau Compte Personnel 🔑",
    err_fullname_required: "❌ Erreur : Le nom complet de l'employé est obligatoire.",
    err_profile_mapping: "⚠️ Authentification créée, mais la liaison du profil a échoué : ",
    staff_created_success: "✅ Compte personnel créé ! Le profil d'accès est actif.",

    // Staff Performance & Reports Hub (StaffPerformance.jsx / Reports.jsx)
    back_main_console: "← Console Principale",
    perf_intel_tag: "Données de Performance",
    ceo_oversight_title: "👑 Centre de Surveillance du PDG",
    shift_metrics_title: "📋 Indicateurs de Shift",
    syncing_ledgers_msg: "Synchronisation des Grands Livres...",
    historical_ledgers_label: "Historique des Rapports Mensuels",
    no_history_found: "Aucun Historique d'Exploitation Trouvé",
    shift_windows_logged: "Créneaux de Shift Enregistrés",
    target_scope_badge: "Périmètre Ciblé Actif",
    operational_window_desc: "Plage Opérationnelle Standard : 06:00 - 06:00",
    view_run_btn: "Voir le Shift",
    target_date_badge: "Sélection de la Date Cible",
    active_ledger_runs_label: "Registres d'Activité Actifs",
    gross_turnover_label: "Chiffre d'Affaires Brut",
    shift_closeout_title: "Résumé de Clôture de Shift",
    window_label: "Période",
    cash_to_handover_label: "Espèces à Remettre",
    unpaid_tabs_balance_label: "Solde des Ardoises Client (Crédits Loggés)",
    itemized_receipts_label: "Détail des Recettes de Caisse",
    product_item_fallback: "Article de Stock",
    client_label: "Client",
    direct_retail_fallback: "Vente Directe Comptoir",
    payment_status_paid: "payé",
    payment_status_debt: "crédit",
    print_summary_btn: "Imprimer le Rapport de Shift 📄",
    
    // Core System Alerts & Security Diagnostics
    market_list_copied: "Liste de marché copiée dans le presse-papiers !",
    restock_success: "Ravitaillement réussi ! Alerte effacée.",
    security_check: "CONTRÔLE DE SÉCURITÉ",
    delete_confirm_msg: "Êtes-vous sûr de vouloir supprimer définitivement cet article de votre inventaire actif ? Cette action est irréversible.",
    delete_success: "Entrée supprimée avec succès du registre."
  }
};

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    return localStorage.getItem('app_language') || 'en';
  });

  const toggleLanguage = () => {
    const nextLang = language === 'en' ? 'fr' : 'en';
    setLanguage(nextLang);
    localStorage.setItem('app_language', nextLang);
  };

  const t = (key) => {
    return dictionary[language]?.[key] || dictionary['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);