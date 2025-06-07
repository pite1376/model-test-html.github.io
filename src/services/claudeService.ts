export async function getClaudeCompletion(apiKey: string, message: string) {
  const API_URL = "https://api.302ai.cn/v1/chat/completions";
  const MODEL = "claude-sonnet-4-20250514";

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${apiKey}`,
  };

  const data = {
    model: MODEL,
    messages: [{ role: "user", content: message }],
  };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API error: ${response.status} - ${errorData.message || response.statusText}`);
    }

    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("Error calling Claude API:", error);
    throw error;
  }
} 