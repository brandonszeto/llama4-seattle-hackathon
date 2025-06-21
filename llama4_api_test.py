from llama_api_client import LlamaAPIClient
from dotenv import load_dotenv

import os

# Load environment variables from .env file
load_dotenv()

# API key sanity check
api_key = os.environ.get("LLAMA_API_KEY")
# print(f"API KEY: {api_key}")

client = LlamaAPIClient(
    api_key=os.environ.get("LLAMA_API_KEY"),
    base_url="https://api.llama.com/v1/",
)

response = client.chat.completions.create(
    model="Llama-4-Maverick-17B-128E-Instruct-FP8",
    messages=[
        {"role": "user", "content": "Hello Llama! Can you give me a quick intro?"},
    ],
)

print(response.completion_message.content.text)
