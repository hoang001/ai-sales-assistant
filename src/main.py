from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # <--- QUAN TRỌNG
from fastapi.responses import FileResponse  # <--- QUAN TRỌNG
from pydantic import BaseModel
import os
import sys

# Đảm bảo đường dẫn import đúng
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from .agent import agent_manager
from .database import db_manager

# Khởi tạo DB
db_manager.initialize_db()

app = FastAPI(title="AI Sales Assistant")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. MOUNT THƯ MỤC STATIC (Để load CSS, JS) ---
# Lấy đường dẫn tuyệt đối đến thư mục 'static' ở gốc dự án
static_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "static")

# Mount thư mục này vào đường dẫn /static
app.mount("/static", StaticFiles(directory=static_path), name="static")

# --- 2. API CHAT (Logic cũ) ---
class ChatInput(BaseModel):
    message: str
    user_id: str = "guest"

@app.post("/chat")
async def chat(inp: ChatInput):
    message = inp.message.strip()

    # ===============================
    # CASE 1: LOCATION từ Frontend
    # ===============================
    if message.startswith("{"):
        try:
            data = json.loads(message)

            if data.get("type") == "location":
                lat = data.get("lat")
                lng = data.get("lng")

                if lat is None or lng is None:
                    return {
                        "response": "⚠️ Không nhận được tọa độ hợp lệ từ trình duyệt."
                    }

                reply = store_service.find_nearest_store(lat, lng)
                return {"response": reply}

        except Exception as e:
            return {
                "response": "⚠️ Không thể xử lý dữ liệu vị trí của bạn."
            }

    # ===============================
    # CASE 2: CHAT TEXT (logic cũ)
    # ===============================
    reply = agent_manager.get_response(inp.user_id, message)
    return {"response": reply}


# --- 3. TRANG CHỦ (Trả về file HTML) ---
@app.get("/")
async def read_root():
    # Trả về file index.html nằm trong thư mục static
    return FileResponse(os.path.join(static_path, "index.html"))