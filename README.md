# DeepSeek WhatsApp Bot

This project is a WhatsApp chatbot powered by the DeepSeek AI API, built using Node.js and the Baileys library.

## Features

*   Connects to WhatsApp using the Baileys multi-device authentication.
*   Listens for incoming text messages.
*   Maintains conversation history per chat (in-memory).
*   Uses the DeepSeek AI API to generate context-aware responses.
*   Sends AI-generated responses back to the WhatsApp chat.
*   Prepared for deployment on Heroku.

## Prerequisites

*   **Node.js:** v18.0.0 or higher
*   **npm:** Package manager for Node.js (usually comes with Node.js)
*   **Git:** For cloning the repository.
*   **DeepSeek AI API Key:** You need an API key from [DeepSeek AI Platform](https://platform.deepseek.com/) (You'll need to sign up).
*   **WhatsApp Account:** A WhatsApp account to link the bot to.
*   **Heroku Account & CLI:** (Optional, for deployment) If you want to deploy to Heroku.

## Configuration

The bot requires the following environment variables:

*   `DEEPSEEK_API_KEY`: **Required.** Your API key for accessing the DeepSeek API.
*   `DEEPSEEK_MODEL`: (Optional) The specific DeepSeek chat model name to use. Defaults to `deepseek-chat`. Verify the correct model name in the DeepSeek documentation.
*   `DEEPSEEK_API_URL`: (Optional) The base URL for the DeepSeek API. Defaults to `https://api.deepseek.com/v1/chat/completions`.
*   `LOG_LEVEL`: (Optional) Set the logging level (e.g., `info`, `debug`, `silent`). Defaults to `info`.

## Local Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Eliahhango/deepseek.git
    cd deepseek
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Create `.env` file:** Create a file named `.env` in the project root and add your DeepSeek API key:
    ```dotenv
    DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
    # You can optionally override other config variables here too
    # DEEPSEEK_MODEL=another-deepseek-model
    ```
4.  **Run the bot:**
    ```bash
    npm start
    ```
5.  **Scan QR Code:** On the first run, a QR code will appear in your terminal. Open WhatsApp on your phone, go to **Settings > Linked Devices > Link a Device**, and scan the QR code.
6.  **Test:** Send a message to the linked WhatsApp account. The bot should respond.

## Deployment to Heroku

1.  **Login to Heroku:**
    ```bash
    heroku login
    ```
2.  **Create Heroku App:**
    ```bash
    heroku create your-unique-app-name # Replace with your desired app name
    ```
3.  **Set Config Vars:** Add your DeepSeek API key as a Heroku Config Var. You can set optional variables too.
    ```bash
    heroku config:set DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
    # heroku config:set DEEPSEEK_MODEL=your-chosen-model
    ```
    *(Alternatively, set these via the Heroku dashboard: Your App > Settings > Config Vars)*
4.  **Deploy:** Commit your code (make sure `.env` is in `.gitignore` and not committed) and push to Heroku:
    ```bash
    git add .
    git commit -m "Ready for Heroku deployment"
    git push heroku main # Or your default branch name
    ```
5.  **Scale Worker Dyno:** Ensure the background worker process is running:
    ```bash
    heroku ps:scale worker=1
    ```
6.  **Check Logs & Scan QR Code:** Monitor the logs to see the bot start up:
    ```bash
    heroku logs --tail
    ```
    When the bot starts for the first time on Heroku, it will generate a QR code in the logs. Scan this code with your WhatsApp account (as described in Local Setup step 5).

**Important Note on Heroku Session Persistence:** Heroku's filesystem is ephemeral. The WhatsApp session information stored in the `./auth_info_baileys` directory might be lost if your dyno restarts or you redeploy. This may require you to re-scan the QR code by checking the Heroku logs after such events. For production deployments, consider using external storage (like Redis or a database) for the Baileys auth state.

## How it Works

1.  **Connection:** Uses Baileys to connect to WhatsApp.
2.  **Listening:** Listens for incoming text messages.
3.  **History:** Keeps a short-term history of messages per chat.
4.  **AI Call:** Sends the current message and chat history to the DeepSeek API.
5.  **Response:** Sends the AI's generated response back to the WhatsApp chat. 