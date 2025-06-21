from llama_api_client import LlamaAPIClient
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

# Initialize the Llama API client
client = LlamaAPIClient(
    api_key=os.environ.get("LLAMA_API_KEY"),
    base_url="https://api.llama.com/v1/",
)

# Start the conversation loop
print("Welcome to the Llama Chat! Type 'exit' to end the conversation.")
conversation_history = []

while True:
    # Get user input
    user_input = input("You: ")

    # Exit the loop if the user types 'exit'
    if user_input.lower() == 'exit':
        print("Goodbye!")
        break

    # Add the user's message to the conversation history
    conversation_history.append({"role": "user", "content": user_input})

    # Send the conversation history to the model
    response = client.chat.completions.create(
        model="Llama-4-Maverick-17B-128E-Instruct-FP8",
        messages=conversation_history,
    )

    # Extract the assistant's reply
    assistant_reply = response.completion_message.content.text

    # Print the assistant's reply
    print(f"Llama: {assistant_reply}")

    # Add the assistant's reply to the conversation history
    conversation_history.append({"role": "assistant", "content": assistant_reply})
