import requests

# Test the fixes
url = "http://localhost:8000/chat"
query = "laptop gaming"
data = {"message": query, "user_id": "test"}

print(f"Testing: {query}")
response = requests.post(url, json=data)
result = response.json()
response_text = result['response']

print(f"Status: {response.status_code}")
print(f"Response length: {len(response_text)}")
print(f"Has products: {'Gia:' in response_text or chr(0x1F4B0) in response_text}")
print(f"Response preview: {response_text[:200]}")

# Check for data URLs in response
has_data_urls = 'data:image/svg+xml;base64,' in response_text
print(f"Uses data URLs for placeholders: {has_data_urls}")