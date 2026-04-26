// REFACTOR: The service now communicates securely through Supabase Edge Function
import type { AIAction } from '../types';
import { supabase } from './supabaseClient';

// ✅ Edge Function URL
const SUPABASE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_FUNCTION_URL || '';

// Define the type for our chat history messages
export type ChatMessage = {
  role: "system" | "user" | "model";
  content: string;
};

export type ChatHistory = ChatMessage[];

export function initializeChat(systemPrompt: string): ChatHistory {
  return [{ role: 'system', content: systemPrompt }];
}

export async function sendMessageToAI(
  chatHistory: ChatHistory,
  message: string
): Promise<{ newHistory: ChatHistory, response: AIAction }> {

  if (!SUPABASE_FUNCTION_URL) {
    throw new Error("Supabase Function URL is not configured.");
  }

  // 获取登录 session
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error("User not logged in");
  }

  const userMessage: ChatMessage = { role: 'user', content: message };
  const updatedHistory = [...chatHistory, userMessage];

  const messagesForApi = updatedHistory.map(msg => ({
    role: msg.role === 'model' ? 'assistant' : msg.role,
    content: msg.content
  }));

  try {
    const apiResponse = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 带上 Supabase token
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        messages: messagesForApi
      })
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      throw new Error(`API error (${apiResponse.status}): ${errorBody}`);
    }

    const responseData = await apiResponse.json();
    const responseText = responseData.choices[0].message.content;

    let aiAction: AIAction;

    try {
      const cleanedResponseText = responseText.replace(
        /("url":\s*)"([^"]+)"/g,
        (match, key, value) => {
          const firstUrl = value.split(/[\s\n\r]+/)[0].trim();
          return `${key}"${firstUrl}"`;
        }
      );

      aiAction = JSON.parse(cleanedResponseText);
    } catch (e) {
      console.error("[AI] JSON parse failed, fallback...", e);
      try {
        aiAction = JSON.parse(responseText);
      } catch {
        aiAction = {
          type: 'speech',
          payload: { text: "抱歉，我好像有点思维混乱了。我们再试一次吧。" }
        };
      }
    }

    const modelMessage: ChatMessage = {
      role: 'model',
      content: JSON.stringify(aiAction, null, 2)
    };

    return {
      newHistory: [...updatedHistory, modelMessage],
      response: aiAction
    };

  } catch (error: any) {
    console.error("[AI] request failed:", error);
    throw new Error("Failed to call AI service");
  }
}