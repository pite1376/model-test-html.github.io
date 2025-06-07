import requests
import json

API_URL = "https://api.302ai.cn/v1/chat/completions"
MODEL = "claude-sonnet-4-20250514"
YOUR_API_KEY = "YOUR_API_KEY"  # Replace with your actual API key

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": f"Bearer {YOUR_API_KEY}"
}

# Example message payload
data = {
    "model": MODEL,
    "messages": [
        {"role": "user", "content": "Hello, how are you today?"}
    ]
}

try:
    response = requests.post(API_URL, headers=headers, data=json.dumps(data))
    response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)

    print("Response Status Code:", response.status_code)
    print("Response JSON:")
    print(json.dumps(response.json(), indent=4))

except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
    if response is not None:
        print(f"Response content: {response.text}") 