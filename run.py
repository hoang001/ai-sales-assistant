import uvicorn
import os
import sys

# Thêm thư mục hiện tại vào đường dẫn hệ thống để Python tìm thấy 'src'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("\n" + "="*60)
    print("AI SALES ASSISTANT - BACKEND PRO STARTED")
    print("="*60)
    port = int(os.getenv('PORT', '8000'))
    print(f"Server URL:      http://localhost:{port}")
    print(f"Swagger UI:      http://localhost:{port}/docs")
    print("="*60 + "\n")

    # Chạy server (trỏ vào file main.py nằm trong thư mục src)
    try:
        port = int(os.getenv('PORT', '8000'))
        uvicorn.run("src.main:app", host="0.0.0.0", port=port, reload=False)
    except Exception as e:
        print(f"❌ Lỗi khởi động: {e}")