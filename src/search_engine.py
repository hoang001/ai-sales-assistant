from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
import os
import re
from .config import settings

class StoreSearchEngine:
    def __init__(self):
        self.embedding_model = HuggingFaceEmbeddings(
            model_name="keepitreal/vietnamese-sbert"
        )
        
        if os.path.exists(settings.VECTOR_DB_PATH) and os.listdir(settings.VECTOR_DB_PATH):
            self.vector_db = Chroma(
                persist_directory=str(settings.VECTOR_DB_PATH),
                embedding_function=self.embedding_model
            )
            print(f"RAG: Da ket noi DB tai {settings.VECTOR_DB_PATH}")
        else:
            self.vector_db = None
            print("⚠️ RAG: Chưa có dữ liệu Vector.")

    # --- HÀM 1: BÓC TÁCH GIÁ (Giữ nguyên) ---
    def extract_price_intent(self, query: str):
        text = query.lower().replace(".", "").replace(",", "")
        match = re.search(r"(\d+)\s*(tr|triệu|m|k|nghìn|củ)", text)
        if not match: return None, None
            
        number = int(match.group(1))
        unit = match.group(2)
        price_value = number * 1_000_000 if unit in ['tr', 'triệu', 'm', 'củ'] else number * 1_000
            
        min_price = None
        max_price = None
        
        if "dưới" in text or "tối đa" in text:
            max_price = price_value
        elif "trên" in text or "tối thiểu" in text:
            min_price = price_value
        else:
            min_price = int(price_value * 0.9)
            max_price = int(price_value * 1.1)
            
        return min_price, max_price

    # --- HÀM 2: BÓC TÁCH DANH MỤC (MỚI) ---
    def detect_category(self, query: str):
        """Phát hiện xem khách muốn tìm loại sản phẩm nào"""
        q = query.lower()
        print(f"DEBUG: Detecting category for '{q}'")

        if "laptop" in q or "máy tính" in q or "macbook" in q or "gaming" in q:
            print(f"DEBUG: Category detected: Laptop for '{q}'")
            return "Laptop"
        if "điện thoại" in q or "iphone" in q or "samsung" in q or "smartphone" in q:
            return "Điện thoại" # Hoặc "Mobile" tùy data của bạn
        if "tablet" in q or "ipad" in q or "máy tính bảng" in q:
            return "Tablet"
        if "đồng hồ" in q or "watch" in q:
            return "Đồng hồ thông minh"
        print(f"DEBUG: No category detected for '{q}'")
        return None

    def search(self, query: str, k=5):
        if not self.vector_db: return []

        # 1. Phân tích ý định (Giá + Danh mục)
        min_p, max_p = self.extract_price_intent(query)
        category = self.detect_category(query)

        print(f"DEBUG: Starting search for '{query}', category: {category}")

        print(f"Query: '{query}' | Target: {category} | Gia: {min_p}-{max_p}")

        # --- CHIẾN THUẬT 1: TÌM KIẾM CHÍNH XÁC (Ưu tiên số 1) ---
        conditions = []
        if min_p: conditions.append({"price": {"$gte": min_p}})
        if max_p: conditions.append({"price": {"$lte": max_p}})
        if category: conditions.append({"category": category})

        strict_filter = {"$and": conditions} if len(conditions) > 1 else (conditions[0] if conditions else None)
        
        try:
            results = self.vector_db.similarity_search(query, k=k, filter=strict_filter)

            print(f"DEBUG: Strict search results: {len(results)} for '{query}'")

            # Nếu tìm thấy hàng đúng ý -> Trả về luôn
            if results:
                print(f"   => SUCCESS: Tim thay {len(results)} ket qua chinh xac.")
                return results

        except Exception as e:
            print(f"DEBUG: Strict search error for '{query}': {str(e)}")
            print(f"   => WARNING: Loi search strict: {str(e)}")

        # --- CHIẾN THUẬT 2: NỚI LỎNG GIÁ (Nếu bước 1 không ra gì) ---
        # Chỉ giữ lại điều kiện Category (Loại bỏ điều kiện Giá)
        print("   => ⚠️ Không tìm thấy hàng đúng giá. Đang nới lỏng bộ lọc...")
        
        fallback_conditions = []
        if category: fallback_conditions.append({"category": category})
        
        # Nếu đang tìm Laptop mà kho hết Laptop 17tr -> Tìm đại Laptop bất kỳ (để AI có cái mà tư vấn)
        fallback_filter = fallback_conditions[0] if fallback_conditions else None
        
        try:
            results = self.vector_db.similarity_search(query, k=k, filter=fallback_filter)
            print(f"   => FALLBACK: Tim thay {len(results)} ket qua thay the.")

            print(f"DEBUG: Fallback search results: {len(results)} for '{query}'")

            # Đánh dấu vào metadata để AI biết đây là hàng thay thế
            for doc in results:
                doc.page_content += " [LƯU Ý: Sản phẩm này có giá khác mức khách yêu cầu, hãy tư vấn khéo léo]"

            return results
        except Exception as e:
            print(f"DEBUG: Fallback search error for '{query}': {str(e)}")
            print(f"   => ERROR: Loi search fallback: {str(e)}")
            return []