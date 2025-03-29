const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
const { channelInfo } = require('../config/messageConfig'); // For consistent message formatting

// --- Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Initialize Gemini AI Client (only if API key is present)
let genAI;
if (GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Safety Settings for Gemini (adjust thresholds as needed)
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

async function mariamCommand(sock, chatId, message) {
    // 1. Check if API Key is configured
    if (!GEMINI_API_KEY || !genAI) {
        console.error("GEMINI_API_KEY is not set.");
        await sock.sendMessage(chatId, {
            text: '❌ Configuration error: Gemini API key is missing. Bot owner needs to set the `GEMINI_API_KEY` environment variable.',
            ...channelInfo
        });
        return;
    }

    // 2. Extract user input text
    const userMessage = message.message?.conversation?.trim() ||
                        message.message?.extendedTextMessage?.text?.trim() || '';
    const userInput = userMessage.split(' ').slice(1).join(' ').trim();

    if (!userInput) {
        await sock.sendMessage(chatId, {
            text: '🤔 Please ask Mariam a question!\n\nExample: `.mariam What is the weather like today?`',
            ...channelInfo
        });
        return;
    }

    // 3. Send request to Gemini
    try {
        await sock.sendMessage(chatId, { text: '⏳ Mariam is thinking...', ...channelInfo });

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", safetySettings }); // Use flash for speed

        // Construct a prompt that guides the AI to act as "Mariam"
        // You can refine this prompt for better persona adherence
        const fullPrompt = `You are Mariam, a friendly and helpful AI assistant integrated into a WhatsApp bot. Answer the user's query concisely and clearly. User query: "${userInput}"`;

        console.log(`Sending prompt to Gemini for Mariam: "${userInput}"`); // Debug log
        const result = await model.generateContent(fullPrompt);
        const response = result.response;

        // Check for safety blocks *before* trying to access text()
        if (response.promptFeedback?.blockReason) {
            console.warn(`Gemini request blocked. Reason: ${response.promptFeedback.blockReason}`);
            await sock.sendMessage(chatId, {
                text: `❌ Mariam couldn't process that request due to safety restrictions (${response.promptFeedback.blockReason}). Please try a different query.`,
                ...channelInfo
            });
            return;
        }
         if (!response.candidates || response.candidates.length === 0 || !response.candidates[0].content) {
             console.warn("Gemini response is empty or invalid structure:", JSON.stringify(response, null, 2));
             await sock.sendMessage(chatId, {
                 text: `❌ Mariam received an unexpected empty response from the AI. Please try again.`,
                 ...channelInfo
             });
             return;
         }


        const mariamResponse = response.text(); // Get text after safety check
        console.log("Received response from Gemini for Mariam."); // Debug log

        if (!mariamResponse || mariamResponse.trim() === '') {
             await sock.sendMessage(chatId, { text: '🤔 Mariam seems to be quiet right now. Try asking again!', ...channelInfo });
             return;
        }

        // 4. Send Gemini's response back to WhatsApp
        await sock.sendMessage(chatId, {
            text: mariamResponse,
            ...channelInfo // Add context like forwarding info
        });

    } catch (error) {
        console.error("Error interacting with Gemini (Mariam command):", error);
        await sock.sendMessage(chatId, {
            text: `❌ Sorry, Mariam encountered an error: ${error.message}`,
            ...channelInfo
        });
    }
}

module.exports = mariamCommand;
