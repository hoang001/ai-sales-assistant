from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import os
import sys
import json # <--- Thêm import này
import requests
import urllib.parse

# Đảm bảo đường dẫn import đúng
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .agent import agent_manager
from .database import db_manager
from .services import store_service # <--- QUAN TRỌNG: Import service tìm cửa hàng

# Khởi tạo DB
db_manager.initialize_db()

app = FastAPI(title="AI Sales Assistant")

# --- CẤU HÌNH CORS (Để Ngrok và Vercel kết nối được) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Cho phép tất cả các nguồn (bao gồm Ngrok)
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. MOUNT THƯ MỤC STATIC ---
static_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")
app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- 2. API CHAT ---
class ChatInput(BaseModel):
    message: str
    user_id: str = "guest"


@app.post("/chat")
async def chat(inp: ChatInput):
    message = inp.message.strip()
    user_id = inp.user_id

    print(f"Nhan tin nhan: {message}")

    # ===============================
    # 🎯 TRƯỜNG HỢP 1: XỬ LÝ ĐỊNH VỊ GPS (Nút bấm trên Frontend)
    # ===============================
    if message.startswith("GPS:"):
        try:
            # Tách lấy tọa độ từ chuỗi "GPS:21.02,105.83"
            _, coords = message.split(":")
            lat, lng = coords.split(",")
            
            # Gọi hàm find_nearest_store sử dụng Google Places API (đã sửa)
            reply = store_service.find_nearest_store(float(lat), float(lng))
            
            return {"response": reply}
            
        except Exception as e:
            print(f"Loi GPS: {e}")
            return {"response": "Xin loi, khong the xac dinh vi tri cua ban luc nay."}

    # ===============================
    # 🤖 TRƯỜNG HỢP 2: CHAT VỚI AI (Các câu hỏi thường)
    # ===============================
    # Nếu khách hỏi "Tìm cửa hàng ở Cầu Giấy" -> AI sẽ tự gọi tool find_stores (tìm theo tên)
    try:
        reply = agent_manager.get_response(user_id, message)
        return {"response": reply}
    except Exception as e:
        print(f"Loi AI: {e}")
        return {"response": "He thong dang ban, vui long thu lai sau."}

# --- 3. PROXY IMAGE (GIẢI QUYẾT VẤN ĐỀ MIXED CONTENT) ---
@app.get("/proxy-image")
async def proxy_image(url: str = Query(..., description="URL của ảnh cần proxy")):
    """
    Proxy endpoint để phục vụ ảnh từ URL bên ngoài qua HTTPS.
    Giải quyết vấn đề Mixed Content khi frontend HTTPS load ảnh HTTP.
    """
    try:
        print(f"DEBUG: Received proxy request for URL: {url}")

        # Decode URL if it's encoded
        decoded_url = urllib.parse.unquote(url)
        print(f"DEBUG: Decoded URL: {decoded_url}")

        # Validate URL
        parsed_url = urllib.parse.urlparse(decoded_url)
        if not parsed_url.scheme or not parsed_url.netloc:
            print(f"DEBUG: Invalid URL structure: scheme={parsed_url.scheme}, netloc={parsed_url.netloc}")
            raise HTTPException(status_code=400, detail="URL không hợp lệ")

        print(f"DEBUG: URL validated, fetching from: {decoded_url}")

        # Fetch ảnh từ URL gốc
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(decoded_url, headers=headers, timeout=10, stream=True)

        print(f"DEBUG: External response status: {response.status_code}")
        print(f"DEBUG: External response headers: {dict(response.headers)}")

        if response.status_code != 200:
            print(f"DEBUG: Failed to fetch image, status: {response.status_code}")
            raise HTTPException(status_code=response.status_code, detail="Không thể tải ảnh")

        # Trả về ảnh với headers phù hợp
        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            media_type=response.headers.get('content-type', 'image/jpeg'),
            headers={
                'Cache-Control': 'public, max-age=3600',  # Cache 1 giờ
                'Access-Control-Allow-Origin': '*'
            }
        )

    except requests.exceptions.RequestException as e:
        print(f"Loi proxy anh (request): {e}")
        raise HTTPException(status_code=500, detail="Loi tai anh")
    except Exception as e:
        print(f"Loi proxy anh (general): {e}")
        raise HTTPException(status_code=500, detail="Loi xu ly anh")

# --- 4. TRANG CHỦ ---
@app.get("/")
async def read_root():
    return FileResponse(os.path.join(static_path, "index.html"))