import os
import requests
import base64

from dotenv import load_dotenv

load_dotenv()

def image_to_base64(image_path):
  with open(image_path, "rb") as img:
    return base64.b64encode(img.read()).decode('utf-8')

base64_image = image_to_base64("pig.jpeg")

print("API Key:", os.environ.get('LLAMA_API_KEY'))

response = requests.post(
	url="https://api.llama.com/v1/chat/completions",
	headers={
		"Content-Type": "application/json",
	    "Authorization": f"Bearer {os.environ.get('LLAMA_API_KEY')}"
	},
	json={
		"model": "Llama-4-Maverick-17B-128E-Instruct-FP8",
		"messages": [
			{
				"role": "user",
				"content": [
					{
                        "type": "text",
                        "text": "What does this image contain?",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                        },
                    },
				],
			},
		]
	}
)

response_data = response.json()
text_content = response_data['completion_message']['content']['text']

print(text_content)
