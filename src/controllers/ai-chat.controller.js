const AIChat = require("../models/AIChat");
const Groq = require("groq-sdk");
const { symptomCheckCache } = require("../utils/cache");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Available Groq models: mixtral-8x7b-32768, llama2-70b-4096
const GROQ_MODEL = process.env.GROQ_MODEL || "mixtral-8x7b-32768";

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

    // Get AI response using Groq
    // Build system + conversation history
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add previous conversation history
    for (const msg of conversation.messages) {
      messages.push({
        role: msg.sender === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({ role: "user", content: message });

    const result = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    });
    const aiResponse = result.choices[0].message.content;

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

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Based on this health consultation conversation, provide a brief summary (3-4 sentences) of the key points discussed:

${conversation.messages
          .map((msg) => `${msg.sender.toUpperCase()}: ${msg.content}`)
          .join("\n")}

Summary:`,
      },
    ];

    const result = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 512,
    });
    const summary = result.choices[0].message.content;

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

    if (!process.env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is missing in environment");
      return res.status(500).json({ message: "AI service not configured. Please contact support." });
    }

    // Check cache first to reduce API calls
    const cacheKey = symptomCheckCache.generateKey(messages);
    const cachedResponse = symptomCheckCache.get(cacheKey);
    if (cachedResponse) {
      console.log(`[CACHE HIT] Symptom check for User ${userId}`);
      return res.json({ ...cachedResponse, fromCache: true });
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

    // Build messages array for Groq API
    const apiMessages = [
      { role: "system", content: SYMPTOM_CHECK_PROMPT },
      ...messages.map((m) => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content,
      })),
    ];

    const result = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: apiMessages,
      temperature: 0.5,
      max_tokens: 1024,
    });
    const responseText = result.choices[0].message.content;

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
    console.log(`[CACHE MISS] Symptom Check for User ${userId}: ${jsonResponse.urgencyLevel}`);

    // Cache the response for future requests
    symptomCheckCache.set(cacheKey, jsonResponse);

    return res.json(jsonResponse);
  } catch (error) {
    console.error("Symptom Check Error:", error);
    const status = error?.response?.status || 500;
    const message = error?.response?.data?.error || error.message || "Failed to process symptom check";
    return res.status(status).json({ message });
  }
};
