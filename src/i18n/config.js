import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          inventory: "Inventory Control",
          staff: "Staff Network",
          profits: "Profit Insights",
          sales: "Fast Sales",
          logout: "End Secure Session",
          item_name: "Item Name",
          price: "Price",
          stock: "Stock Level",
          add_item: "Add New Item",
          back: "Back",
          save: "Save Changes"
        }
      },
      fr: {
        translation: {
          inventory: "Gestion de Stock",
          staff: "Personnel",
          profits: "Bénéfices",
          sales: "Ventes",
          logout: "Déconnexion",
          item_name: "Nom de l'article",
          price: "Prix",
          stock: "Niveau de Stock",
          add_item: "Ajouter un article",
          back: "Retour",
          save: "Sauvegarder"
        }
      }
    }
  });

export default i18n;
