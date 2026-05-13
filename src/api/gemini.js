// src/api/gemini.js
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export const processVoiceToData = async (transcript, role) => {
  const systemPrompt = role === 'admin' 
    ? "Extract inventory details: item, quantity, cost, and selling price." 
    : "Extract sales details: item names and quantities.";

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `${systemPrompt} Input text: "${transcript}"` }]
        }],
        generationConfig: { response_mime_type: "application/json" }
      })
    });

    const data = await response.json();
    return JSON.parse(data.candidates[0].content.parts[0].text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { error: "CONNECTION_ERROR" };
  }
};
