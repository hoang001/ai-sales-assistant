import os
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Tải key
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# 2. Liệt kê các model
print("Danh sách các model bạn có thể dùng:")
for m in genai.list_models():
    # Chỉ hiện các model có khả năng tạo nội dung (chat)
    if 'generateContent' in m.supported_generation_methods:
        print(f"- {m.name}")