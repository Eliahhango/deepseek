import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason,
    makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import pino from 'pino';
import config from './config.js'; // Assuming config.js is set up correctly
import { getChatCompletion } from './deepseek.js';

// Basic logger setup
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Directory to store authentication state
// NOTE: On platforms like Heroku with ephemeral filesystems,
// this auth state might be lost on restarts/deploys, requiring a QR scan again.
// For more robust deployments, consider storing this state externally (e.g., database, Redis).
const AUTH_DIR = './auth_info_baileys';

// In-memory store for conversation history { [jid: string]: message[] }
const conversationHistory = {};
const MAX_HISTORY_LENGTH = 10; // Limit history to prevent excessive API usage

async function connectToWhatsApp() {
    // --- Authentication Setup ---
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    // fetch latest version of WA Web
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
    // --- End Authentication Setup ---

    const sock = makeWASocket({
        version,
        logger: logger.child({ level: 'silent' }), // Use 'debug' for detailed Baileys logs
        printQRInTerminal: true,
        mobile: false,
        auth: {
            creds: state.creds,
            // caching makes the store faster to send/recv messages
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        generateHighQualityLinkPreview: true,
        shouldIgnoreJid: jid => jid?.endsWith('@broadcast'), // Ignore broadcast messages
        // implement other configuration options as needed
    });

    // --- Connection Events ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            logger.info('QR code generated, scan with WhatsApp!');
            // QR code will be printed in the terminal by printQRInTerminal: true
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.error('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
        else if (connection === 'open') {
            logger.info('WhatsApp connection opened!');
        }
    });
    // --- End Connection Events ---

    // --- Save Credentials Event ---
    sock.ev.on('creds.update', saveCreds);
    // --- End Save Credentials Event ---

    // --- Message Handling ---
    sock.ev.on('messages.upsert', async (m) => {
        // console.log(JSON.stringify(m, undefined, 2)) // Log full message object if needed

        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) {
            // Ignore messages sent by the bot itself or empty messages
            return;
        }

        // Get chat ID and message text
        const remoteJid = msg.key.remoteJid;
        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!messageText || !remoteJid) {
            // Ignore non-text messages or messages without a valid JID
            logger.info({ msg: 'Ignoring non-text message or message without JID' });
            return;
        }

        logger.info(`Received message from ${remoteJid}: "${messageText}"`);

        try {
            // Initialize history if it doesn't exist for this JID
            if (!conversationHistory[remoteJid]) {
                conversationHistory[remoteJid] = [];
                // Optional: Add a system prompt if desired
                // conversationHistory[remoteJid].push({ role: 'system', content: 'You are a helpful WhatsApp assistant.' });
            }

            // Append user message to history
            conversationHistory[remoteJid].push({ role: 'user', content: messageText });

            // Trim history: Keep only the last MAX_HISTORY_LENGTH messages.
            // Preserve system message if it exists.
            const history = conversationHistory[remoteJid];
            const systemMessage = history[0]?.role === 'system' ? history[0] : null;
            let startIndex = history.length > MAX_HISTORY_LENGTH ? history.length - MAX_HISTORY_LENGTH : 0;
            // Ensure startIndex doesn't remove the system message if it exists and history is long enough
            if (systemMessage && startIndex === 0 && history.length > MAX_HISTORY_LENGTH) {
                 startIndex = 1;
            }
            conversationHistory[remoteJid] = systemMessage 
                ? [systemMessage, ...history.slice(startIndex)] 
                : history.slice(startIndex);

            // Indicate typing
            await sock.sendPresenceUpdate('composing', remoteJid);

            // Prepare message list for API call (use the potentially trimmed history)
            const messagesForApi = conversationHistory[remoteJid];

            // Get response from DeepSeek
            const deepseekResponse = await getChatCompletion(messagesForApi);

            // Stop typing indicator regardless of success/failure
            await sock.sendPresenceUpdate('paused', remoteJid); 

            // Append assistant response to history
            if (deepseekResponse && deepseekResponse.content) {
                // Append to the original history array *before* sending
                history.push(deepseekResponse); 
                // Apply trimming again *after* adding the response (optional, but keeps consistent length)
                // This logic could be extracted into a function
                const updatedHistory = conversationHistory[remoteJid];
                const updatedSystemMessage = updatedHistory[0]?.role === 'system' ? updatedHistory[0] : null;
                let updatedStartIndex = updatedHistory.length > MAX_HISTORY_LENGTH ? updatedHistory.length - MAX_HISTORY_LENGTH : 0;
                if (updatedSystemMessage && updatedStartIndex === 0 && updatedHistory.length > MAX_HISTORY_LENGTH) {
                     updatedStartIndex = 1;
                }
                 conversationHistory[remoteJid] = updatedSystemMessage 
                    ? [updatedSystemMessage, ...updatedHistory.slice(updatedStartIndex)] 
                    : updatedHistory.slice(updatedStartIndex);

                 // Send DeepSeek response back to WhatsApp
                 logger.info(`Sending response to ${remoteJid}: "${deepseekResponse.content}"`);
                 await sock.sendMessage(remoteJid, { text: deepseekResponse.content });

            } else {
                 logger.error('Received empty or invalid response from DeepSeek');
                 // Handle error case - maybe send a default message
                 await sock.sendMessage(remoteJid, { text: "Sorry, I couldn't get a response from the AI right now." });
                 // Typing indicator already paused
                 return;
            }

        } catch (error) {
            logger.error('Error processing message:', error);
            // Ensure typing indicator is paused on error
            if(remoteJid) { // Check if remoteJid is available
                 try { await sock.sendPresenceUpdate('paused', remoteJid); } catch (e) { /* ignore */ }
            }
            // Optionally send an error message to the user
            try {
                await sock.sendMessage(remoteJid, { text: 'Sorry, an internal error occurred while processing your message.' });
            } catch (sendError) {
                 logger.error('Failed to send error message to user:', sendError);
            }
        }
    });
    // --- End Message Handling ---

    return sock;
}

// Start the connection process
connectToWhatsApp().catch(err => logger.error("Failed to connect to WhatsApp:", err)); 