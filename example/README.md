# LLMFlow Examples

This directory contains example scripts to test and demonstrate LLMFlow functionality.

## Chat Simulation

The `chat-simulation.js` script simulates a realistic 10-message conversation between a user and an AI assistant.

### Running the Simulation

1. Make sure LLMFlow is running:
   ```bash
   # In the root directory
   npm start
   ```

2. Set your OpenAI API key and run the simulation:
   ```bash
   # From the example directory
   OPENAI_API_KEY=sk-your-key-here node chat-simulation.js
   
   # Or use npm scripts
   OPENAI_API_KEY=sk-your-key-here npm run chat
   ```

3. Watch the conversation unfold in the terminal and view the captured data in the dashboard at http://localhost:3000

### What the Simulation Does

The script creates a natural conversation flow:
1. User greets the AI
2. AI responds
3. User asks about the capital of France
4. AI provides information
5. User asks follow-up about landmarks
6. AI lists famous landmarks
7. User switches topic to Italy's capital
8. AI provides information
9. User asks to compare the two cities (testing context retention)
10. AI compares Paris and Rome

This demonstrates:
- Context building across multiple messages
- Token usage accumulation
- Cost tracking
- Response time monitoring
- Error handling

### Customization

You can modify the `conversationFlow` array in the script to test different conversations or add more messages.