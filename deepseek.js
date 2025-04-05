import axios from 'axios';
import config from './config.js';

// Function to get a chat completion from DeepSeek
// We'll maintain a simple conversation history
async function getChatCompletion(messages) {
    try {
        console.log('Sending request to DeepSeek API...');
        // Log the request payload for debugging (optional, remove in production)
        // console.log('Request Payload:', JSON.stringify({ model: 'deepseek-chat', messages: messages }, null, 2));

        const response = await axios.post(
            config.deepseekApiUrl,
            {
                model: config.deepseekModel, // Use model from config
                messages: messages, // Array of message objects { role: 'user'/'assistant', content: '...' }
                // Add other parameters like temperature, max_tokens if needed
                // stream: false, // Set to true if you want streaming responses
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.deepseekApiKey}`
                }
            }
        );

        // Log the full response for debugging (optional)
        // console.log('API Response:', JSON.stringify(response.data, null, 2));

        // --- Adjust response parsing based on DeepSeek API documentation --- 
        // Assuming the response structure is similar to OpenAI's:
        if (response.data && response.data.choices && response.data.choices.length > 0) {
            const reply = response.data.choices[0].message;
            if (reply && reply.content) {
                 console.log('Received reply from DeepSeek.');
                return reply; // Return the whole message object { role: 'assistant', content: '...' }
            } else {
                console.error('Error: Invalid response format from DeepSeek API (missing content).', response.data);
                return { role: 'assistant', content: 'Sorry, I received an unexpected response from the AI.' };
            }
        } else {
            console.error('Error: Invalid response format from DeepSeek API (missing choices).', response.data);
            return { role: 'assistant', content: 'Sorry, I received an invalid response structure from the AI.' };
        }
        // --- End of parsing --- 

    } catch (error) {
        console.error('Error calling DeepSeek API:');
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            console.error('Status:', error.response.status);
            console.error('Headers:', error.response.headers);
            console.error('Data:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('Request Error:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error Message:', error.message);
        }
        return { role: 'assistant', content: 'Sorry, I encountered an error trying to reach the AI.' };
    }
}

export { getChatCompletion }; 