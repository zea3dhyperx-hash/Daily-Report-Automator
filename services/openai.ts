
import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse } from '../types.ts';

export const parseTaskWithAI = async (input: string): Promise<AIResponse> => {
  // Initialize AI client within the request scope to ensure usage of the latest environment configuration.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: input,
      config: {
        systemInstruction: 'You are a task parser. Extract project details from user input. Return a JSON object with keys: projectName, projectType, assignedBy, remarks. If a value is missing, infer a professional one or use "General" for type and "Self" for assignedBy.',
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: {
              type: Type.STRING,
              description: 'The name of the project.',
            },
            projectType: {
              type: Type.STRING,
              description: 'The type or category of the task.',
            },
            assignedBy: {
              type: Type.STRING,
              description: 'The person who assigned the task.',
            },
            remarks: {
              type: Type.STRING,
              description: 'Additional notes or specific achievements.',
            },
          },
          required: ["projectName", "projectType", "assignedBy", "remarks"],
          propertyOrdering: ["projectName", "projectType", "assignedBy", "remarks"],
        },
      },
    });

    // Access the generated text directly via the .text property
    const text = response.text;
    if (!text) {
      throw new Error("Gemini API returned an empty response.");
    }
    
    return JSON.parse(text.trim()) as AIResponse;
  } catch (error) {
    console.error('AI Parsing Error:', error);
    return {
      projectName: input,
      projectType: 'General',
      assignedBy: 'Self',
      remarks: ''
    };
  }
};
