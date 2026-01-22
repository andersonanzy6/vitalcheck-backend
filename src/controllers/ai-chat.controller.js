const AIChat = require("../models/AIChat");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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

    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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
