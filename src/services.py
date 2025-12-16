import urllib.parse
import json
import os
from .database import db_manager
from .config import settings
import unicodedata
import requests
import math

GOOGLE_API_KEY = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
# Import Search Engine
try:
    from src.search_engine import StoreSearchEngine
except ImportError:
    StoreSearchEngine = None

class StoreService:
    def __init__(self):
        print("Dang tai RAG Engine...")
        self.rag = StoreSearchEngine() if StoreSearchEngine else None

    def search_products(self, query: str, limit: int = 10):
        """
        Tìm kiếm sản phẩm bằng RAG Vector + SQL.
        Trả về định dạng Markdown bao gồm: Ảnh, Giá, Đánh giá, Thông số.
        """
        if not self.rag: return "Hệ thống tìm kiếm đang bảo trì."

        # 1. Tìm kiếm Vector (Tìm theo ý hiểu)
        results = self.rag.search(query, k=limit)

        # Debug log
        print(f"DEBUG: RAG search completed for '{query}', results: {len(results) if results else 0}")

        if not results: return "Không tìm thấy sản phẩm nào phù hợp."
        
        conn = db_manager.get_connection()
        cursor = conn.cursor()
        
        response_text = ""
        print(f"\n--- DEBUG TIM ANH ({len(results)} ket qua) ---")
        
        for doc in results:
            name = doc.metadata.get('name')
            
            # [QUAN TRỌNG] Lấy thêm cột 'rag_content' để hiển thị thông số kỹ thuật cho Frontend V4
            # Dùng LIKE để tìm kiếm linh hoạt hơn (tránh lỗi lệch tên)
            cursor.execute("SELECT price_int, image_url, discount_rate, rating_avg, review_count, rag_content FROM products WHERE name LIKE ? LIMIT 1", (f"%{name}%",))
            row = cursor.fetchone()
            
            if row:
                original_price, img_url, discount, rating, reviews, specs_text = row
                
                print(f"Tim thay SQL: {name[:50]} | Anh: {str(img_url)[:30]}...")

                # 1. Xử lý URL ảnh an toàn
                if img_url and len(str(img_url)) > 5:
                    img_url = urllib.parse.quote(img_url, safe=":/?#[]@!$&'()*+,;=")
                else:
                    img_url = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=="

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
                
                # Logic: Luôn bắt đầu bằng icon tiền để Frontend dễ bắt
                if discount > 0:
                    price_str = f"{final_price:,.0f}đ"
                else:
                    price_str = f"{original_price:,.0f}đ"
                
                # 5. Tạo Markdown chuẩn (Frontend bắt buộc phải theo format này)
                # QUAN TRỌNG: Phải có chữ "Giá:", "Đánh giá:", "Thông số:", "Mô tả:"
                response_text += f"""
                    **{name}**
                    ![{name}]({img_url})
                    - 💰 Giá: {price_str}
                    - ⭐ Đánh giá: {rating}/5 ({reviews} đánh giá)
                    - ⚙️ Thông số: {short_specs}
                    - 📝 Mô tả: {doc.page_content[:150]}...
                    ---
                """

        # Debug log
        print(f"DEBUG: Returning response for '{query}', length: {len(response_text)}")

        return response_text.strip()

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
            status = f"CON {stock} chiec" if stock > 0 else "HET HANG"
            return f"Sản phẩm **{name}**\n- Tình trạng: {status}\n- Giá hiện tại: {final_price:,.0f}đ (Đã giảm {discount}%)"
        return "Không tìm thấy sản phẩm này."

    def remove_accents(self, input_str):
        if not input_str: return ""
        nfkd_form = unicodedata.normalize('NFKD', input_str)
        return "".join([c for c in nfkd_form if not unicodedata.combining(c)])


    # ===============================
    # HÀM TÍNH KHOẢNG CÁCH (KM)
    # ===============================
    def haversine(lat1, lng1, lat2, lng2):
        R = 6371  # km
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        dphi = math.radians(lat2 - lat1)
        dlambda = math.radians(lng2 - lng1)

        a = (
            math.sin(dphi / 2) ** 2
            + math.cos(phi1)
            * math.cos(phi2)
            * math.sin(dlambda / 2) ** 2
        )
        return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


    def find_nearest_store(self, lat: float, lng: float):
        import math
        import requests

        api_key = getattr(settings, "GOOGLE_MAPS_API_KEY", None)
        if not api_key:
            return "<b>⚠️ Chưa cấu hình GOOGLE_MAPS_API_KEY</b>"

        # -----------------------
        # Hàm tính khoảng cách
        # -----------------------
        def haversine(lat1, lng1, lat2, lng2):
            R = 6371
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlambda = math.radians(lng2 - lng1)
            a = (
                math.sin(dphi / 2) ** 2
                + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
            )
            return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        url = "https://places.googleapis.com/v1/places:searchText"

        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": api_key,
            "X-Goog-FieldMask": (
                "places.id,"
                "places.displayName,"
                "places.formattedAddress,"
                "places.location,"
                "places.rating,"
                "places.userRatingCount,"
                "places.websiteUri,"
                "places.regularOpeningHours,"
                "places.types,"
                "places.internationalPhoneNumber,"
                "places.reviews,"
                "places.accessibilityOptions,"
                "places.photos"
            ),
        }

        payload = {
            "textQuery": "CellphoneS",
            "languageCode": "vi",
            "locationBias": {
                "rectangle": {
                    "low": {"latitude": lat - 0.05, "longitude": lng - 0.05},
                    "high": {"latitude": lat + 0.05, "longitude": lng + 0.05},
                }
            },
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()

            places = data.get("places", [])
            if not places:
                return "<b>❌ Không tìm thấy cửa hàng CellphoneS gần bạn.</b>"

            # Lọc đúng CellphoneS + tính khoảng cách
            candidates = []
            for p in places:
                name = p.get("displayName", {}).get("text", "").lower()
                if "cellphones" in name:
                    loc = p.get("location", {})
                    if "latitude" in loc and "longitude" in loc:
                        p["_distance"] = haversine(
                            lat, lng, loc["latitude"], loc["longitude"]
                        )
                        candidates.append(p)

            if not candidates:
                return "<b>❌ Không có cửa hàng CellphoneS phù hợp.</b>"

            shop = min(candidates, key=lambda x: x["_distance"])

            # -----------------------
            # Trích xuất dữ liệu
            # -----------------------
            name = shop.get("displayName", {}).get("text", "CellphoneS")
            address = shop.get("formattedAddress", "N/A")
            location = shop.get("location", {})
            lat_, lng_ = location.get("latitude"), location.get("longitude")

            rating = shop.get("rating", "N/A")
            rating_count = shop.get("userRatingCount", 0)
            phone = shop.get("internationalPhoneNumber", "N/A")
            website = shop.get("websiteUri", "")

            opening_hours = shop.get("regularOpeningHours", {}).get(
                "weekdayDescriptions", []
            )

            # Ảnh cửa hàng
            photo_url = ""
            photos = shop.get("photos", [])
            if photos:
                photo_name = photos[0].get("name")
                if photo_name:
                    photo_url = (
                        f"https://places.googleapis.com/v1/{photo_name}/media"
                        f"?key={api_key}&maxWidthPx=800"
                    )

            map_link = f"https://www.google.com/maps/search/?api=1&query={lat_},{lng_}"

            # -----------------------
            # HTML OUTPUT (QUAN TRỌNG)
            # -----------------------
            html = f"""
            <div class="store-card">
                {f'<img src="{photo_url}" class="store-image" alt="Hình ảnh cửa hàng {name}" />' if photo_url else ''}
                <h3>{name}</h3>
                <p>📍 {address}</p>
                <p>📐 Cách bạn <b>{shop["_distance"]:.2f} km</b></p>
                <div class="rating">
                    ⭐ {rating}/5 <span class="rating-count">({rating_count} đánh giá)</span>
                </div>
                <p>☎️ <a href="tel:{phone.replace(' ', '')}">{phone}</a></p>
                {f'<p>🌐 <a href="{website}" target="_blank" rel="noopener noreferrer">{website}</a></p>' if website else ''}
                <p>
                    <a href="{map_link}" target="_blank" rel="noopener noreferrer" class="map-link">
                        🗺 Xem trên Google Maps
                    </a>
                </p>
            </div>
            """
            return html.strip()

        except requests.exceptions.RequestException as e:
            return f"<b>❌ Lỗi kết nối Google Places API:</b> {e}"
        except Exception as e:
            return f"<b>❌ Lỗi xử lý dữ liệu:</b> {e}"




def geocode_location(self, location: str):
    """
    Geocode địa điểm tiếng Việt (VD: 'Mỹ Đình', 'sân vận động Mỹ Đình')
    bằng Google Geocoding API, có context Hà Nội – Việt Nam
    """
    api_key = settings.GOOGLE_MAPS_API_KEY
    if not api_key:
        raise Exception("Chưa cấu hình GOOGLE_MAPS_API_KEY")

    # ==========================
    # CHUẨN HÓA QUERY
    # ==========================
    query = location.strip().lower()

    # Fix typo phổ biến
    query = query.replace("đinhg", "đình")

    # Nếu chưa có Hà Nội / Việt Nam → thêm context
    if "hà nội" not in query:
        query = f"{query}, Hà Nội"
    if "việt nam" not in query:
        query = f"{query}, Việt Nam"

    url = "https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        "address": query,
        "key": api_key,
        "language": "vi",
        "region": "vn"
    }

    response = requests.get(url, params=params, timeout=10)
    data = response.json()

    if data.get("status") != "OK" or not data.get("results"):
        raise Exception(f"Không geocode được địa điểm: {location}")

    # ==========================
    # ƯU TIÊN KẾT QUẢ PHÙ HỢP
    # ==========================
    PRIORITY_TYPES = {
        "stadium",
        "neighborhood",
        "sublocality",
        "sublocality_level_1",
        "political"
    }

    for result in data["results"]:
        types = set(result.get("types", []))
        if types & PRIORITY_TYPES:
            loc = result["geometry"]["location"]
            return loc["lat"], loc["lng"]

    # ==========================
    # FALLBACK: LẤY KẾT QUẢ ĐẦU
    # ==========================
    loc = data["results"][0]["geometry"]["location"]
    return loc["lat"], loc["lng"]




store_service = StoreService()