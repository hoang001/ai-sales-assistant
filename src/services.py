import urllib.parse
import json
import os
from .database import db_manager
from .config import settings
import unicodedata
import requests


GOOGLE_API_KEY = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
# Import Search Engine
try:
    from src.search_engine import StoreSearchEngine
except ImportError:
    StoreSearchEngine = None

class StoreService:
    def __init__(self):
        print("⏳ Đang tải RAG Engine...")
        self.rag = StoreSearchEngine() if StoreSearchEngine else None

    def search_products(self, query: str, limit: int = 10):
        """
        Tìm kiếm sản phẩm bằng RAG Vector + SQL.
        Trả về định dạng Markdown bao gồm: Ảnh, Giá, Đánh giá, Thông số.
        """
        if not self.rag: return "Hệ thống tìm kiếm đang bảo trì."
        
        # 1. Tìm kiếm Vector (Tìm theo ý hiểu)
        results = self.rag.search(query, k=limit)
        if not results: return "Không tìm thấy sản phẩm nào phù hợp."
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        response_text = ""
        print(f"\n--- DEBUG TÌM ẢNH ({len(results)} kết quả) ---")
        
        for doc in results:
            name = doc.metadata.get('name')
            
            # [QUAN TRỌNG] Lấy thêm cột 'rag_content' để hiển thị thông số kỹ thuật cho Frontend V4
            # Dùng LIKE để tìm kiếm linh hoạt hơn (tránh lỗi lệch tên)
            cursor.execute("SELECT price_int, image_url, discount_rate, rating_avg, review_count, rag_content FROM products WHERE name LIKE ? LIMIT 1", (f"%{name}%",))
            row = cursor.fetchone()
            
            if row:
                original_price, img_url, discount, rating, reviews, specs_text = row
                
                print(f"✅ Tìm thấy SQL: {name} | Ảnh: {str(img_url)[:30]}...")

                # 1. Xử lý URL ảnh an toàn
                if img_url and len(str(img_url)) > 5:
                    img_url = urllib.parse.quote(img_url, safe=":/?#[]@!$&'()*+,;=")
                else:
                    img_url = "https://via.placeholder.com/300x300?text=No+Image"

                # 2. Xử lý dữ liệu hiển thị (Rating, Stars)
                rating = rating if rating else 0
                reviews = reviews if reviews else 0
                star_icon = "⭐" * int(round(rating)) if rating > 0 else ""

                # 3. Xử lý thông số kỹ thuật (Cắt ngắn cho gọn để hiển thị đẹp trên Card)
                if specs_text:
                    # Loại bỏ phần tên lặp lại ở đầu chuỗi rag_content
                    # Ví dụ: "Sản phẩm: iPhone 15. Cấu hình:..." -> "Cấu hình:..."
                    short_specs = specs_text.replace(f"Sản phẩm: {name}.", "").strip()
                    # Lấy khoảng 150 ký tự đầu tiên
                    short_specs = short_specs[:160] + "..." if len(short_specs) > 160 else short_specs
                else:
                    short_specs = "Đang cập nhật..."

                # 4. Tính giá khuyến mãi
                final_price = original_price * (1 - discount/100)
                
                if discount > 0:
                    price_display = f"🔥 **{final_price:,.0f}đ** (Giảm {discount}% - Gốc: ~{original_price:,.0f}đ~)"
                else:
                    price_display = f"💰 **{original_price:,.0f}đ**"
                
                # 5. Tạo Markdown chuẩn (Frontend bắt buộc phải theo format này để render thẻ)
                # Format: **Tên** \n ![Ảnh](URL) \n - Giá \n - Rating \n - Thông số \n - Mô tả
                response_text += f"""
**{name}**
![{name}]({img_url})
- {price_display}
- {star_icon} **{rating}/5** ({reviews} đánh giá)
- ⚙️ Thông số: {short_specs}
- 📝 *{doc.page_content[:100]}...*
---
"""
            else:
                print(f"❌ Không tìm thấy trong SQL: {name} (Sẽ mất ảnh)")
                # Fallback: Trả về thông tin cơ bản từ Vector DB nếu không khớp SQL
                price_vec = doc.metadata.get('price', 0)
                response_text += f"- **{name}** (Giá tham khảo: {price_vec:,.0f}đ)\n"

        conn.close()
        return response_text

    def check_stock(self, product_name: str):
        """Kiểm tra tồn kho"""
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT name, price_int, stock, discount_rate FROM products WHERE name LIKE ?", (f"%{product_name}%",))
        item = cursor.fetchone()
        conn.close()
        
        if item:
            name, price, stock, discount = item
            final_price = price * (1 - discount/100)
            status = f"✅ CÒN {stock} chiếc" if stock > 0 else "❌ HẾT HÀNG"
            return f"Sản phẩm **{name}**\n- Tình trạng: {status}\n- Giá hiện tại: {final_price:,.0f}đ (Đã giảm {discount}%)"
        return "Không tìm thấy sản phẩm này."

    def remove_accents(self, input_str):
        if not input_str: return ""
        nfkd_form = unicodedata.normalize('NFKD', input_str)
        return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


def find_nearest_store(self, lat: float, lng: float):
    """
    Tìm cửa hàng CellPhoneS gần nhất dựa trên tọa độ GPS
    Sử dụng SerpAPI (Google Maps engine)
    """

    print(f"📍 Tìm CellPhoneS gần vị trí: {lat}, {lng}")

    params = {
        "engine": "google_maps",
        "q": "CellphoneS",
        "ll": f"@{lat},{lng},14z",
        "type": "search",
        "api_key": settings.SERP_API_KEY,
        "hl": "vi"
    }

    try:
        response = requests.get("https://serpapi.com/search.json", params=params, timeout=10)
        data = response.json()

        results = data.get("local_results", [])
        if not results:
            return "❌ Em không tìm thấy cửa hàng CellPhoneS nào gần vị trí của anh/chị."

        # 👉 CHỈ LẤY CỬA HÀNG GẦN NHẤT
        store = results[0]

        name = store.get("title")
        address = store.get("address")
        rating = store.get("rating", "N/A")
        reviews = store.get("reviews", 0)
        gps = store.get("gps_coordinates", {})

        dest_lat = gps.get("latitude")
        dest_lng = gps.get("longitude")

        # Link Google Maps chỉ đường (chuẩn mobile & web)
        map_url = (
            "https://www.google.com/maps/dir/?api=1"
            f"&destination={dest_lat},{dest_lng}"
        )

        # 👉 CÂU TRẢ LỜI ĐÚNG Ý TƯỞNG BẠN MÔ TẢ
        response_text = f"""
📍 **Đây là cửa hàng CellPhoneS gần bạn nhất mà em tìm được:**

🏠 **{name}**  
📍 {address}  
⭐ {rating}/5 ({reviews} đánh giá)

🗺️ **[Chỉ đường đến cửa hàng trên Google Maps]({map_url})**

    Anh/chị chỉ cần bấm vào link trên, Google Maps sẽ tự động mở và chỉ đường cho mình ạ 👍
    Anh/Chị có thể ghé qua để trải nghiệm sản phẩm thực tế và được nhân viên tư vấn chuyên sâu hơn nhé! 💡

📦 **Lưu ý:** Nếu cửa hàng tạm hết hàng mẫu bạn thích, đừng lo lắng! Các bạn nhân viên sẽ hỗ trợ nhập hàng về cho bạn chỉ trong vòng **2-3 ngày** thôi ạ.
"""


        return response_text.strip()

    except Exception as e:
        return f"⚠️ Lỗi khi kết nối Google Maps: {str(e)}"


store_service = StoreService()