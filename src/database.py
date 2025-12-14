# src/database.py
import sqlite3
import json
import logging
import random
from .config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DatabaseManager:
    def __init__(self):
        self.db_path = settings.DB_PATH

    def get_connection(self):
        return sqlite3.connect(self.db_path)

    def initialize_db(self):
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # 1. Tạo bảng products với cột image_url
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS products (
                id TEXT PRIMARY KEY,
                name TEXT,
                price_int INTEGER,
                stock INTEGER,
                category TEXT,
                discount_rate INTEGER DEFAULT 0,
                rating_avg REAL DEFAULT 0.0,
                review_count INTEGER DEFAULT 0,
                image_url TEXT,
                rag_content TEXT
            )
        ''')
        
        # Tạo bảng orders
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS orders (
                order_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_name TEXT,
                product_name TEXT,
                quantity INTEGER,
                total_price INTEGER,
                address TEXT,
                status TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # 2. Nạp dữ liệu & Tạo khuyến mãi giả lập
        cursor.execute("SELECT count(*) FROM products")
        if cursor.fetchone()[0] == 0:
            logger.info("Database rỗng. Đang nạp dữ liệu và tạo chương trình khuyến mãi...")
            try:
                with open(settings.RAW_DATA_PATH, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for item in data:
                        p_id = item.get("id", item.get("name"))
                        
                        # --- LOGIC RANDOM KHUYẾN MÃI ---
                        # 30% sản phẩm sẽ được giảm giá từ 5% đến 20%
                        discount = 0
                        if random.random() < 0.3: 
                            discount = random.choice([5, 10, 15, 20])
                        # -------------------------------

                        cursor.execute('''
                            INSERT OR IGNORE INTO products 
                            (id, name, price_int, stock, category, image_url, rag_content, discount_rate, rating_avg, review_count)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (
                            p_id,
                            item.get("name"),
                            item.get("price_int"),
                            10,
                            item.get("category"),
                            item.get("image_url", "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=="),
                            item.get("rag_content"),
                            discount,
                            item.get("rating_avg", 0),
                            item.get("review_count", 0)
                        ))
                    conn.commit()
            except Exception as e:
                logger.error(f"Lỗi nạp dữ liệu: {e}")

        conn.close()
        logger.info(f"Database đã sẵn sàng tại {self.db_path}")

db_manager = DatabaseManager()
