// src/api/gemini.js
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const processVoiceToData = async (transcript, role) => {
  // Logic specifically for Admin Inventory vs Staff Sales
  const systemPrompt = role === 'inventory_add' 
    ? "You are an inventory manager for a bar. Extract: item name, quantity (number), cost price (number), and selling price (number). Return JSON: { \"name\": string, \"quantity\": number, \"cost\": number, \"price\": number }" 
    : "You are a bar waiter. Extract sales from Ivorian slang: 'Bock' or '66' means a large beer, 'Drogba' means a 65cl bottle. Return JSON: { \"items\": [{ \"name\": string, \"quantity\": number }] }";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt} Input text: "${transcript}"` }]
        }],
        generationConfig: { 
          response_mime_type: "application/json" 
        }
      })
    });

    const data = await response.json();
    
    // Safety check: Ensure Gemini returned a valid response
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      throw new Error("Invalid API Response");
    }

    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    return null; // Return null so the UI can handle the error gracefully
  }
};