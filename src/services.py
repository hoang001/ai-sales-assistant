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

    def find_nearest_store(self, lat: float, lng: float):
        """
        Tìm cửa hàng gần nhất dùng Google Places API (v1).
        Trả về: Địa chỉ, toạ độ, điện thoại, website, giờ hoạt động, rating, review, tiện ích.
        """
        api_key = getattr(settings, "PLACES_API_KEY", None)
        if not api_key:
            return "Chưa cấu hình PLACES_API_KEY!"
        
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': api_key,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,'
                             'places.location,places.rating,places.userRatingCount,'
                             'places.websiteUri,places.regularOpeningHours,places.types,'
                             'places.internationalPhoneNumber,places.reviews,places.accessibilityOptions'
        }
        
        payload = {
            "textQuery": "CellphoneS",
            "languageCode": "vi",
            "locationBias": {
                "rectangle": {
                    "low": {
                        "latitude": lat - 0.01,  # Khoảng 1km
                        "longitude": lng - 0.01
                    },
                    "high": {
                        "latitude": lat + 0.01,
                        "longitude": lng + 0.01
                    }
                }
            }
        }
        
        try:
            # Gọi API tìm kiếm
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            
            if not data.get("places"):
                return "Không tìm thấy cửa hàng gần bạn."
                
            # Lấy cửa hàng gần nhất
            shop = data["places"][0]
            
            # Trích xuất thông tin
            name = shop.get("displayName", {}).get("text", "N/A")
            address = shop.get("formattedAddress", "N/A")
            location = shop.get("location", {})
            lat_ = location.get("latitude")
            lng_ = location.get("longitude")
            rating = shop.get("rating", "?")
            user_ratings_total = shop.get("userRatingCount", 0)
            phone = shop.get("internationalPhoneNumber", "N/A")
            website = shop.get("websiteUri", "N/A")
            
            # Xử lý giờ mở cửa
            opening_hours = []
            if "regularOpeningHours" in shop:
                for day in shop["regularOpeningHours"].get("weekdayDescriptions", []):
                    opening_hours.append(day)
            
            # Xử lý đánh giá
            reviews = shop.get("reviews", [])
            review_texts = "".join(
                [f"- {r.get('authorAttribution', {}).get('displayName', 'Ẩn danh')}: "
                 f"'{r.get('originalText', {}).get('text', '')[:100]}...'\n" 
                 for r in reviews[:3]]
            ) if reviews else "Chưa có đánh giá nổi bật."
            
            # Xử lý tiện ích
            amenities = []
            if shop.get("accessibilityOptions", {}).get("wheelchairAccessibleParking"):
                amenities.append("Có lối cho xe lăn")
            if "parking" in str(shop.get("types", [])).lower():
                amenities.append("Có bãi đỗ xe")
            if "wifi" in str(shop.get("types", [])).lower():
                amenities.append("Có Wi-Fi")
                
            # Tạo link Google Maps
            map_link = f"https://www.google.com/maps/search/?api=1&query={lat_},{lng_}"
            
            # Tạo kết quả
            result = f"""
🏠 **{name}**
- Địa chỉ: {address}
- Toạ độ: ({lat_}, {lng_})
- Điện thoại: {phone}
- Website: {website}
- ★ Điểm đánh giá: {rating}/5 (Tổng: {user_ratings_total} đánh giá)
- Giờ mở cửa:
{chr(10).join(opening_hours) if opening_hours else 'Chưa có thông tin.'}
- Tiện ích: {', '.join(amenities) if amenities else 'Đang cập nhật.'}
- Đánh giá người dùng nổi bật:
{review_texts}
- 📍 [Xem trên Google Maps]({map_link})
"""
            return result.strip()
            
        except requests.exceptions.RequestException as e:
            return f"Lỗi kết nối đến Google Places API: {str(e)}"
        except Exception as e:
            return f"Lỗi khi lấy thông tin cửa hàng: {str(e)}"




def find_stores(self, location: str):
        """
        Tìm cửa hàng theo tên địa điểm (Quận/Huyện)
        """
        print(f"📍 Đang tìm cửa hàng tại: {location}")
        
        # Dùng lại cấu hình của SerpAPI nhưng thay đổi tham số tìm kiếm
        params = {
            "engine": "google_maps",
            "q": f"CellphoneS {location}", # Tìm "CellphoneS + Cầu Giấy"
            "type": "search",
            "api_key": settings.SERP_API_KEY,
            "hl": "vi"
        }

        try:
            response = requests.get("https://serpapi.com/search.json", params=params, timeout=10)
            data = response.json()
            results = data.get("local_results", [])

            if not results:
                return f"Khong tim thay cua hang CellphoneS nao o khu vuc '{location}' a."

            # Lấy tối đa 3 cửa hàng để hiển thị cho gọn
            response_text = f"📍 **Danh sách cửa hàng tại {location}:**\n\n"
            
            for store in results[:3]:
                name = store.get("title")
                address = store.get("address")
                rating = store.get("rating", "4.5")
                
                # Tạo link Google Maps
                gps = store.get("gps_coordinates", {})
                lat = gps.get("latitude")
                lng = gps.get("longitude")
                map_url = f"http://maps.google.com/?q={lat},{lng}"

                response_text += f"🏠 **{name}**\n- 📍 {address}\n- ⭐ {rating}/5\n- 🗺️ [Xem bản đồ]({map_url})\n\n"
            
            return response_text

        except Exception as e:
            return f"Loi tim kiem cua hang: {str(e)}"


store_service = StoreService()