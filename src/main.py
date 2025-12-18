from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import os
import sys
import requests
import urllib.parse

# Đảm bảo đường dẫn import đúng
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .agent import agent_manager
from .database import db_manager
from .services import store_service

# ===============================
# KHỞI TẠO
# ===============================
db_manager.initialize_db()

app = FastAPI(title="AI Sales Assistant API")

# ===============================
# CORS
# ===============================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://ai-sales-assistant-hy8z.vercel.app",  # FE của bạn
        "http://localhost:3000",                       # dev local
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===============================
# SCHEMA
# ===============================
class ChatInput(BaseModel):
    message: str
    user_id: str = "guest"

# ===============================
# API CHAT
# ===============================
@app.post("/chat")
async def chat(inp: ChatInput):
    message = inp.message.strip()
    user_id = inp.user_id
    print(f"[CHAT] {user_id}: {message}")

    # ---- GPS ----
    if message.startswith("GPS:"):
        try:
            _, coords = message.split(":")
            lat, lng = coords.split(",")
            reply = store_service.find_nearest_store(float(lat), float(lng))
            return {"response": reply}
        except Exception as e:
            print(f"[GPS ERROR] {e}")
            return {"response": "Xin lỗi, không thể xác định vị trí của bạn lúc này."}

    # ---- AI CHAT ----
    try:
        reply = agent_manager.get_response(user_id, message)
        return {"response": reply}
    except Exception as e:
        print(f"[AI ERROR] {e}")
        return {"response": "Hệ thống đang bận, vui lòng thử lại sau."}


@app.post("/chat")
async def chat(inp: ChatInput):
    message = inp.message.strip()
    user_id = inp.user_id

    print(f"[CHAT] {user_id}: {message}")

    # ==========================================
    # 1. ƯU TIÊN: XỬ LÝ GPS (Nút bấm)
    # ==========================================
    if message.startswith("GPS:"):
        try:
            _, coords = message.split(":")
            lat, lng = coords.split(",")
            reply = store_service.find_nearest_store(float(lat), float(lng))
            return {"response": reply}
        except Exception as e:
            return {"response": "Lỗi xử lý định vị GPS."}

    # ==========================================
    # 2. ƯU TIÊN: XỬ LÝ TÌM ĐỊA ĐIỂM (Nhập tay)
    # ==========================================
    # Danh sách từ khóa kích hoạt chế độ tìm map
    location_keywords = [
        "tìm cửa hàng", "cửa hàng gần", "shop gần", "chi nhánh", 
        "địa chỉ cửa hàng", "ở đâu", "gần đây không"
    ]
    
    # Kiểm tra xem câu chat có chứa từ khóa không
    if any(keyword in message.lower() for keyword in location_keywords):
        # Gọi thẳng hàm tìm kiếm địa điểm, KHÔNG QUA AI
        reply = store_service.find_stores_by_text(message)
        return {"response": reply}

    # ==========================================
    # 3. CÒN LẠI: CHAT VỚI AI (Tư vấn sản phẩm)
    # ==========================================
    try:
        reply = agent_manager.get_response(user_id, message)
        return {"response": reply}

    except Exception as e:
        print(f"[AI ERROR] {e}")
        return {
            "response": "Hệ thống đang bận, vui lòng thử lại sau."
        }

# ===============================
# PROXY IMAGE
# ===============================
@app.get("/proxy-image")
async def proxy_image(url: str = Query(..., description="URL ảnh cần proxy")):
    try:
        decoded_url = urllib.parse.unquote(url)
        response = requests.get(decoded_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10, stream=True)
        if response.status_code != 200: raise HTTPException(status_code=400)
        return StreamingResponse(
            response.iter_content(chunk_size=8192),
            media_type=response.headers.get("content-type", "image/jpeg"),
            headers={"Cache-Control": "public, max-age=3600", "Access-Control-Allow-Origin": "*"}
        )
    except Exception:
        raise HTTPException(status_code=500, detail="Lỗi tải ảnh")

# ===============================
# STATIC FILES (QUAN TRỌNG ĐỂ FE CHẠY ĐƯỢC)
# ===============================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Mount các thư mục con
app.mount("/css", StaticFiles(directory=os.path.join(STATIC_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(STATIC_DIR, "js")), name="js")
# Mount root (đặt cuối cùng)
app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="site")