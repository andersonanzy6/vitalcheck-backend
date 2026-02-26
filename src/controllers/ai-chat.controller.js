const AIChat = require("../models/AIChat");
const { GoogleGenerativeAI } = require("@google/genai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Use gemini-1.5-flash which is available in @google/genai
// Supports: gemini-1.5-flash, gemini-1.5-pro, gemini-2.0-flash-exp
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

const SYSTEM_PROMPT = `You are a helpful health information assistant. You provide general health information, wellness tips, and educational content about common health conditions.

IMPORTANT DISCLAIMERS:
1. You are NOT a replacement for a real doctor or medical professional
2. Always recommend consulting with a qualified healthcare provider for:
   - Any serious symptoms (chest pain, difficulty breathing, severe bleeding, etc.)
   - Persistent or worsening symptoms
   - Anything requiring a diagnosis or prescription
   - Emergency situations (always recommend calling emergency services)
3. Never provide specific medical diagnoses or prescriptions
4. Never take responsibility for health decisions
5. Keep responses concise and easy to understand

When a user describes symptoms that could be serious, always recommend they see a real doctor immediately.
Encourage users to book appointments with doctors on the platform for proper medical care.

Respond in a friendly, empathetic, and educational manner.`;

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, message } = req.body;
    const userId = req.user.id;

    if (!message || message.trim() === "") {
      return res.status(400).json({ message: "Message cannot be empty" });
    }

    // Find or create conversation
    let conversation = null;
    if (conversationId) {
      conversation = await AIChat.findById(conversationId);
      if (!conversation || conversation.userId.toString() !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }
    } else {
      conversation = new AIChat({
        userId,
        messages: [],
      });
    }

    // Add user message to conversation
    conversation.messages.push({
      sender: "user",
      content: message,
    });

    // Get AI response using Gemini
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    // Build conversation history for context
    const chatHistory = conversation.messages.map((msg) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Remove the last user message from history since we'll start fresh
    chatHistory.pop();

    const chat = model.startChat({
      history: chatHistory.length > 0 ? chatHistory : undefined,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      },
    });

    const result = await chat.sendMessage(message);
    const aiResponse = result.response.text();

    // Add AI response to conversation
    conversation.messages.push({
      sender: "ai",
      content: aiResponse,
    });

    await conversation.save();

    res.json({
      conversationId: conversation._id,
      message: aiResponse,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("AI Chat Error:", error);

    if (error.message?.includes("API key")) {
      return res.status(500).json({
        message: "AI service not configured. Please check backend setup.",
      });
    }

    res.status(500).json({
      message: error.message || "Failed to get AI response",
    });
  }
};

exports.getConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await AIChat.findById(conversationId);

    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json({
      id: conversation._id,
      title: conversation.title,
      topic: conversation.topic,
      status: conversation.status,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getConversationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 10, skip = 0 } = req.query;

    const conversations = await AIChat.find({ userId })
      .select("_id title topic status createdAt messages")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    // Get last message for each conversation for preview
    const conversationList = conversations.map((conv) => ({
      id: conv._id,
      title: conv.title,
      topic: conv.topic,
      status: conv.status,
      lastMessage: conv.messages.length > 0
        ? conv.messages[conv.messages.length - 1].content
        : "No messages",
      messageCount: conv.messages.length,
      createdAt: conv.createdAt,
    }));

    res.json(conversationList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.closeConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await AIChat.findById(conversationId);

    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    conversation.status = "closed";
    await conversation.save();

    res.json({ message: "Conversation closed", conversationId });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await AIChat.findById(conversationId);

    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await AIChat.findByIdAndDelete(conversationId);

    res.json({ message: "Conversation deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDischargeSummary = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await AIChat.findById(conversationId);

    if (!conversation || conversation.userId.toString() !== userId) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const summaryPrompt = `Based on this health consultation conversation, provide a brief summary (3-4 sentences) of the key points discussed:

${conversation.messages
        .map((msg) => `${msg.sender.toUpperCase()}: ${msg.content}`)
        .join("\n")}

Summary:`;

    const result = await model.generateContent(summaryPrompt);
    const summary = result.response.text();

    res.json({
      conversationId,
      summary,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.symptomCheck = async (req, res) => {
  try {
    // Validate auth context
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Not authorized" });
    }

    // Validate payload
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array is required" });
    }
    for (const m of messages) {
      if (!m || typeof m.content !== "string" || typeof m.sender !== "string") {
        return res.status(400).json({ message: "each message must include sender and content strings" });
      }
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY is missing in environment");
      return res.status(500).json({ message: "AI service not configured. Please contact support." });
    }

    const SYMPTOM_CHECK_PROMPT = `You are a medical symptom checker. Your goal is to guide the user through a structured diagnostic flow:
1. Identify the primary symptom.
2. Ask about duration.
3. Ask about severity.
4. Provide potential conditions (clearly stating these are NOT diagnoses).
5. Determine urgency level (Low, Medium, High, Emergency).
6. Strongly suggest a doctor consultation if urgency is not Low.

Respond ONLY in JSON format with the following fields:
{
  "message": "The AI's next question or response",
  "possibleConditions": ["condition1", "condition2"],
  "urgencyLevel": "Low/Medium/High/Emergency",
  "suggestDoctor": true/false,
  "flowStep": "symptom/duration/severity/result"
}

Current Conversation:
${messages.map(m => `${m.sender}: ${m.content}`).join("\n")}

AI:`;

    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent(SYMPTOM_CHECK_PROMPT);
    const responseText = result.response.text();

    // Try to parse JSON from AI response
    let jsonResponse;
    try {
      const cleanJson = responseText.replace(/```json|```/g, "").trim();
      jsonResponse = JSON.parse(cleanJson);
    } catch (e) {
      console.warn("SymptomCheck JSON parse failed; returning fallback structure", e?.message);
      jsonResponse = {
        message: responseText,
        possibleConditions: [],
        urgencyLevel: "Unknown",
        suggestDoctor: true,
        flowStep: "unknown"
      };
    }

    // Ensure required fields exist in response
    jsonResponse.message = typeof jsonResponse.message === "string" && jsonResponse.message.trim() ? jsonResponse.message : "Can you describe your main symptom?";
    jsonResponse.possibleConditions = Array.isArray(jsonResponse.possibleConditions) ? jsonResponse.possibleConditions : [];
    jsonResponse.urgencyLevel = typeof jsonResponse.urgencyLevel === "string" ? jsonResponse.urgencyLevel : "Unknown";
    jsonResponse.suggestDoctor = typeof jsonResponse.suggestDoctor === "boolean" ? jsonResponse.suggestDoctor : true;
    jsonResponse.flowStep = typeof jsonResponse.flowStep === "string" ? jsonResponse.flowStep : "unknown";

    // Log the query with minimal PII
    console.log(`Symptom Check for User ${userId}: ${jsonResponse.urgencyLevel}`);

    return res.json(jsonResponse);
  } catch (error) {
    console.error("Symptom Check Error:", error);
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.error || error.message || "Failed to process symptom check";
    return res.status(status).json({ message });
  }
};
