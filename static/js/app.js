// ===== MAIN APPLICATION FILE (UI/UX OPTIMIZED V3) =====

let messageInput, sendBtn, attachBtn, messagesArea, chatContent, filePreviewArea;
let selectedFile = null;
let messageCount = 0;

const API_URL = "https://faddiest-overcasuistical-mollie.ngrok-free.dev";

// Helper function để proxy ảnh qua HTTPS (giải quyết Mixed Content)
function getProxyImageUrl(originalUrl) {
    if (!originalUrl || originalUrl.startsWith('data:')) {
        return originalUrl; // Data URLs và empty URLs không cần proxy
    }
    // Encode URL và tạo proxy URL
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${API_URL}/proxy-image?url=${encodedUrl}`;
}

// 1. KHỞI TẠO
document.addEventListener('DOMContentLoaded', () => {
    console.log('AI Assistant Ready - V3 UI');
    
    messageInput = document.getElementById('messageInput');
    sendBtn = document.getElementById('sendBtn');
    attachBtn = document.getElementById('attachBtn');
    messagesArea = document.getElementById('messagesArea');
    chatContent = document.getElementById('chatContent');
    filePreviewArea = document.getElementById('filePreviewArea');
    
    // Init Session ID
    if (!localStorage.getItem("chat_session_id")) {
        localStorage.setItem("chat_session_id", "user_" + Date.now());
    }

    setupEventListeners();
    
    // Ẩn loading overlay
    setTimeout(() => {
        const overlay = document.querySelector('.loading-overlay');
        if (overlay) overlay.style.display = 'none';
        if(messageInput) messageInput.focus();
        autoResizeTextarea();
    }, 1500);
});

// 2. EVENT LISTENERS
function setupEventListeners() {
    // Xử lý gửi tin
    const handleSend = (e) => {
        e.preventDefault();
        if (!sendBtn.disabled) sendMessage();
    };

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    
    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
            }
        });
        // Auto resize
        messageInput.addEventListener('input', autoResizeTextarea);
    }

    // New Chat
    const newChatBtn = document.getElementById('newChatBtn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.setItem("chat_session_id", "user_" + Date.now());
            document.querySelectorAll('.message:not(.welcome-message)').forEach(m => m.remove());
            const welcome = document.querySelector('.welcome-message');
            if(welcome) {
                welcome.style.display = 'block';
                welcome.style.opacity = '1';
            }
            showNotification('Thành công', 'Đã bắt đầu cuộc trò chuyện mới!', 'success');
        });
    }

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        // Load saved theme
        if (localStorage.getItem('theme') === 'dark') {
            document.body.classList.add('dark-theme');
            themeToggle.checked = true;
        }

        themeToggle.addEventListener('change', function() {
            document.body.classList.toggle('dark-theme', this.checked);
            localStorage.setItem('theme', this.checked ? 'dark' : 'light');
        });
    }
}

// 3. LOGIC GỬI TIN
// 3. LOGIC GỬI TIN
async function sendMessage(msgOverride = null) {
    // Nếu có tin nhắn đè (ví dụ từ nút GPS), dùng nó. Nếu không, lấy từ ô nhập liệu.
    const text = msgOverride || messageInput.value.trim();
    
    if (!text && !selectedFile) return;

    // Nếu là tin nhắn người dùng nhập tay thì xóa ô nhập
    if (!msgOverride) {
        messageInput.value = '';
        autoResizeTextarea();
    }
    
    // Ẩn welcome screen
    const welcome = document.querySelector('.welcome-message');
    if(welcome) welcome.style.display = 'none';

    // UI: Hiển thị tin nhắn người dùng (Chỉ hiện nếu không phải là lệnh ngầm GPS)
    if (!text.startsWith("GPS:")) {
        addUserMessage(text);
    }
    
    showTypingIndicator();
    setLoadingState(true);

    try {
        const userId = localStorage.getItem("chat_session_id");
        
        // 👇 QUAN TRỌNG: Sửa đường dẫn fetch thành API_URL
        const response = await fetch(`${API_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: text,
                user_id: userId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        hideTypingIndicator();
        processBackendResponse(data.response);

    } catch (error) {
        hideTypingIndicator();
        console.error("API Error:", error);
        addBotMessageHTML(`⚠️ <strong>Lỗi kết nối:</strong> Không thể gọi tới Backend (${API_URL}). <br>Bạn đã bật Ngrok chưa?`);
    } finally {
        setLoadingState(false);
    }
}



function processBackendResponse(markdownText) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/772e6c34-8e9c-4956-87f2-19b17c23545b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:processBackendResponse',message:'Processing backend response',data:{response_length:markdownText.length,has_products:markdownText.includes('💰 Giá:')},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // 1. CHUẨN HÓA DỮ LIỆU (QUAN TRỌNG)
    // Chuyển đổi tất cả các kiểu xuống dòng (\r\n, \r) thành \n chuẩn
    let html = markdownText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. REGEX NÂNG CẤP (LINH HOẠT HƠN)
    // - \s* : Chấp nhận mọi khoảng trắng hoặc xuống dòng thừa
    // - (?:...)? : Nhóm không bắt buộc (để tránh lỗi nếu thiếu dòng "Thông số")
    // - [\s\S]*? : Lấy nội dung mô tả kể cả khi có xuống dòng
    const productBlockRegex = /\*\*(.*?)\*\*\s*\n\s*!\[(.*?)\]\((.*?)\)\s*\n\s*-\s*💰\s*Giá:\s*(.*?)\s*\n\s*-\s*⭐\s*Đánh giá:\s*(.*?)\s*\n(?:\s*-\s*⚙️\s*Thông số:\s*(.*?)\s*\n)?\s*-\s*📝\s*Mô tả:\s*([\s\S]*?)(?=(\n\s*---|[\s\S]*$))/g;

    let hasProduct = false;

    // 3. THAY THẾ MARKDOWN BẰNG HTML THẺ SẢN PHẨM
    html = html.replace(productBlockRegex, (match, name, alt, imgUrl, price, ratingStr, specs, description) => {
        hasProduct = true;
        
        // Xử lý rating (Lấy số sao đầu tiên)
        const rating = ratingStr ? ratingStr.split('/')[0].trim() : '4.5';
        
        // Tạo object dữ liệu
        const productData = {
            name: name.trim(),
            imgUrl: imgUrl.trim(),
            price: price.trim(),
            rating: rating,
            description: description.trim(),
            specs: specs ? specs.trim() : "" // Nếu không có thông số thì để rỗng
        };
        
        const encodedData = encodeURIComponent(JSON.stringify(productData));

        // Render HTML (Card nằm ngang giống ảnh 2)
        return `
            <div class="product-card-inline" style="display: flex; gap: 15px; margin: 15px 0; background: #fff; padding: 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e0e0e0; align-items: start;">
                
                <div class="product-image-inline" style="flex-shrink: 0; width: 120px; height: 120px; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; border: 1px solid #f0f0f0;">
                    <img src="${getProxyImageUrl(productData.imgUrl)}" alt="${productData.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">
                </div>

                <div class="product-info-inline" style="flex: 1; display: flex; flex-direction: column; gap: 5px;">
                    <div style="font-size: 16px; font-weight: 700; color: #333; line-height: 1.3;">${productData.name}</div>
                    
                    <div style="font-size: 15px; font-weight: 700; color: #d70018;">${productData.price}</div>
                    
                    <div style="font-size: 13px; color: #666; display: flex; align-items: center;">
                        <span style="color: #ffd700; margin-right: 4px;">⭐</span> ${productData.rating}/5
                    </div>

                    ${productData.specs ? 
                        `<div style="font-size: 12px; background: #f4f6f8; padding: 4px 8px; border-radius: 4px; color: #555; margin-top: 2px;">
                            ⚙️ ${productData.specs}
                        </div>` : ''
                    }

                    <div style="font-size: 13px; color: #555; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                        ${productData.description}
                    </div>
                    
                    <button onclick="window.openProductPanel('${encodedData}')" 
                        style="align-self: flex-start; margin-top: 8px; padding: 6px 14px; font-size: 13px; border: none; background: #007bff; color: white; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s; box-shadow: 0 2px 4px rgba(0,123,255,0.2);">
                        Xem chi tiết
                    </button>
                </div>
            </div>
        `;
    });

    // 4. NẾU KHÔNG PHẢI SẢN PHẨM -> FORMAT TEXT THƯỜNG
    if (!hasProduct) {
        // In đậm, in nghiêng, xuống dòng
        html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
        html = html.replace(/\n/g, '<br>');
    } else {
        // Xóa các dấu phân cách --- thừa
        html = html.replace(/\n\s*---\s*\n/g, '');
    }

    addBotMessageHTML(html);
}

// Hàm format text cơ bản cho phần không phải sản phẩm
function formatText(text) {
    let html = text;
    // In đậm: **text** -> <b>text</b>
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // In nghiêng: *text* -> <i>text</i> (Tránh conflict với **)
    html = html.replace(/(^|[^\*])\*(?!\*)(.*?)\*/g, '$1<i>$2</i>');
    // Xuống dòng
    html = html.replace(/\n/g, '<br>');
    // Gạch đầu dòng
    html = html.replace(/^- /gm, '• ');
    return html;
}

// 5. UI COMPONENTS
function addUserMessage(text) {
    messageCount++;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';
    msgDiv.id = `msg-${messageCount}`;
    msgDiv.innerHTML = `<div class="message-content"><p>${escapeHtml(text)}</p></div>`;
    messagesArea.appendChild(msgDiv);
    animateMessage(msgDiv);
    scrollToBottom();
}

// Hàm hiển thị tin nhắn bot hỗ trợ HTML (cho cả text và thẻ sản phẩm)
function addBotMessageHTML(htmlContent) {
    messageCount++;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message bot';
    msgDiv.id = `msg-${messageCount}`;
    // Sử dụng innerHTML để trình duyệt render các thẻ HTML của sản phẩm
    msgDiv.innerHTML = `<div class="message-content">${htmlContent}</div>`;
    
    if (messagesArea) {
        messagesArea.appendChild(msgDiv);
        animateMessage(msgDiv);
        scrollToBottom();
    }
}

// Hàm mở Panel (Được gọi từ nút "Xem chi tiết" trong thẻ sản phẩm)
// Cần khai báo global (window.) để có thể gọi từ thuộc tính onclick
window.openProductPanel = function(encodedJson) {
    try {
        // Giải mã dữ liệu sản phẩm
        const product = JSON.parse(decodeURIComponent(encodedJson));
        
        // Gọi hàm hiển thị panel (từ file panel.js)
        if (typeof window.showProductDetails === 'function') {
            window.showProductDetails(product.name); 
            
            // Cập nhật dữ liệu thực vào panel sau khi nó được render
            setTimeout(() => {
                const panel = document.getElementById('panelContent');
                if(panel) {
                    const img = panel.querySelector('.product-detail-image');
                    if(img) img.src = getProxyImageUrl(product.imgUrl);
                    
                    const price = panel.querySelector('.product-details-price');
                    if(price) price.textContent = product.price;

                    const ratingVal = panel.querySelector('.rating-value');
                    if(ratingVal) ratingVal.textContent = `${product.rating}/5`;
                    
                    // Cập nhật mô tả vào phần highlight hoặc một chỗ phù hợp
                    const highlights = panel.querySelector('.highlights-grid');
                    if(highlights && product.description) {
                         highlights.innerHTML = `<div class="highlight-item">${product.description}</div>`;
                    }
                }
            }, 100);
        }
    } catch (e) {
        console.error("Lỗi mở panel:", e);
        showNotification('Lỗi', 'Không thể mở chi tiết sản phẩm.', 'error');
    }
};

function showTypingIndicator() {
    const div = document.createElement('div');
    div.id = 'typingIndicator';
    div.className = 'message bot typing-indicator';
    div.innerHTML = `
        <div class="message-content">
            <div class="ai-thinking-loader">
                <div class="loader__bar"></div><div class="loader__bar"></div>
                <div class="loader__bar"></div>
            </div>
        </div>`;
    messagesArea.appendChild(div);
    scrollToBottom();
}

function hideTypingIndicator() {
    const el = document.getElementById('typingIndicator');
    if (el) el.remove();
}

// 6. HELPER FUNCTIONS
function scrollToBottom() {
    setTimeout(() => {
        chatContent.scrollTo({ top: chatContent.scrollHeight, behavior: 'smooth' });
    }, 100);
}

function setLoadingState(isLoading) {
    if (sendBtn) {
        sendBtn.disabled = isLoading;
        sendBtn.style.opacity = isLoading ? '0.7' : '1';
    }
    if (!isLoading && messageInput) {
        messageInput.focus();
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function autoResizeTextarea() {
    if (!messageInput) return;
    messageInput.style.height = 'auto';
    messageInput.style.height = (messageInput.scrollHeight) + 'px';
}

function animateMessage(element) {
    element.style.animation = 'messageAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
}

function showNotification(title, msg, type) {
    // Sử dụng lại hệ thống thông báo cũ nếu có
    const container = document.getElementById('notificationContainer');
    if(container) {
        const notif = document.createElement('div');
        notif.className = type === 'success' ? 'success-notification' : 'error-notification';
        // HTML thông báo đơn giản hóa
        notif.innerHTML = `
            <div class="icon-container">
                <i class="fas ${type === 'success' ? 'fa-check' : 'fa-exclamation'} icon"></i>
            </div>
            <div class="message-text-container">
                <p class="message-text">${title}</p>
                <p class="sub-text">${msg}</p>
            </div>
        `;
        container.appendChild(notif);
        setTimeout(() => {
            notif.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    } else {
        console.log(`[${type}] ${title}: ${msg}`);
    }
}



/* --- THÊM VÀO CUỐI FILE app.js --- */

// Xử lý nút: Tư vấn & So sánh
window.handleConsulting = function(productName, needCompare = false) {
    const consultMsg = `Tôi muốn biết thêm thông tin về ${productName} và so sánh điểm mạnh, yếu của nó với các sản phẩm được chọn khác`;
    try {
        if (messageInput) {
            messageInput.value = consultMsg;
            setTimeout(() => { messageInput.focus(); sendMessage(); }, 50);
        } else {
            addUserMessage(consultMsg);
            setTimeout(() => sendMessage(), 50);
        }
        // Auto-close panel if open
        const panel = document.getElementById('productPanel');
        if (panel && panel.classList.contains('active')) {
            const closeBtn = document.getElementById('closePanel');
            if (closeBtn) closeBtn.click();
        }
    } catch (e) {
        console.error('handleConsulting error', e);
        showNotification('Lỗi', 'Không thể gửi yêu cầu tư vấn.', 'error');
    }
};

// --- XỬ LÝ NÚT TÌM CỬA HÀNG (UPDATED FOR GOOGLE MAPS API) ---
// --- XỬ LÝ NÚT TÌM CỬA HÀNG ---
window.handleFindStore = function () {
    if (!navigator.geolocation) {
        addBotMessageHTML("⚠️ Trình duyệt không hỗ trợ định vị.");
        return;
    }

    addBotMessageHTML('<div style="color:#666; font-style:italic;">📍 Đang xác định vị trí... (Vui lòng chọn Allow)</div>');

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;

            // UI: Báo cho người dùng biết đã gửi
            addUserMessage("📍 Đã gửi vị trí hiện tại.");

            // Gửi tọa độ về Backend theo đúng format "GPS:..."
            sendMessage(`GPS:${lat},${lon}`);
        },
        (err) => {
            let msg = "Không thể lấy vị trí.";
            if (err.code === 1) msg = "Bạn đã từ chối quyền vị trí.";
            addBotMessageHTML(`⚠️ ${msg} Vui lòng nhập: <b>"Tìm cửa hàng ở [Tên Quận]"</b>`);
        },
        options
    );
};

