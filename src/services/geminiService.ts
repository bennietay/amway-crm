import { GoogleGenAI } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export async function generateIcebreaker(leadData: any, tone: string = 'professional') {
  const ai = getAI();
  if (!ai) return "AI integration is currently disabled. Please configure your GEMINI_API_KEY to use this feature.";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a personalized, ${tone}, and non-spammy icebreaker message for a potential Amway business partner based on this data: ${JSON.stringify(leadData)}. Focus on health, wellness, or financial freedom depending on their profile. The tone should be ${tone}.`,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate icebreaker. Please check your API key configuration.";
  }
}

export async function checkCompliance(message: string) {
  const ai = getAI();
  if (!ai) return { compliant: true, suggestions: "AI compliance check is disabled." };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following message for Amway compliance. Ensure there are no illegal income claims or misleading health promises: "${message}". Return a JSON with "compliant" (boolean) and "suggestions" (string).`,
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Error:", error);
    return { compliant: true, suggestions: "Error during compliance check." };
  }
}

export async function scoreLead(leadData: any) {
  const ai = getAI();
  if (!ai) return 50;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Score this lead from 0 to 100 based on their potential as a business partner: ${JSON.stringify(leadData)}. Return only the number.`,
    });
    return parseInt(response.text.trim()) || 50;
  } catch (error) {
    console.error("Gemini Error:", error);
    return 50;
  }
}
