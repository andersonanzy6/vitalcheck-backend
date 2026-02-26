require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

async function listModels() {
  try {
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY not set in .env");
      return;
    }
    
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.list();
    
    console.log("Available Models:");
    console.log("================");
    
    for (const model of response.models) {
      console.log(`\nModel: ${model.name}`);
      console.log(`Display Name: ${model.displayName}`);
      console.log(`Supported Methods: ${model.supportedGenerationMethods?.join(", ") || "None"}`);
    }
  } catch (error) {
    console.error("Error listing models:", error.message);
  }
}

listModels();
