import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const config = {
    deepseekApiKey: process.env.DEEPSEEK_API_KEY,
    deepseekApiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions', // Verify this URL
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat' // Verify this model name
};

// Basic validation
if (!config.deepseekApiKey) {
    console.error('Error: DEEPSEEK_API_KEY is not set in the .env file.');
    console.error('Please create a .env file and add your DeepSeek API key.');
    console.error('Example .env file content: DEEPSEEK_API_KEY=your_api_key_here');
    process.exit(1); // Exit if API key is missing
}

export default config; 