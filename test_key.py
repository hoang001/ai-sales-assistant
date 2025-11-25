import os
import google.generativeai as genai
from dotenv import load_dotenv

# 1. Tải key từ file .env
load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

# 2. Cấu hình
genai.configure(api_key=api_key)

# 3. Gọi thử model Gemini 1.5 Flash (nhanh và miễn phí)
model = genai.GenerativeModel('gemini-2.5-flash-lite')

print("Đang gửi tin nhắn tới Gemini...")
response = model.generate_content("Chào bạn, hãy giới thiệu ngắn gọn về bản thân.")

# 4. In kết quả
print("Phản hồi từ AI:")
print(response.text)

#- models/gemini-flash-lite-latest
#- models/gemini-pro-latest
#- models/gemini-2.5-flash-lite
#- models/gemini-2.5-flash-image-preview
#- models/gemini-2.5-flash-image
#- models/gemini-2.5-flash-preview-09-2025
#- models/gemini-2.5-flash-lite-preview-09-2025
#- models/gemini-3-pro-preview
#- models/gemini-3-pro-image-preview
#- models/nano-banana-pro-preview
#- models/gemini-robotics-er-1.5-preview
#- models/gemini-2.5-computer-use-preview-10-2025