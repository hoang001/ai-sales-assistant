// ===== MAIN APPLICATION FILE (UI/UX OPTIMIZED V3) =====

let messageInput, sendBtn, attachBtn, messagesArea, chatContent, filePreviewArea;
let selectedFile = null;
let messageCount = 0;

const API_URL = "https://faddiest-overcasuistical-mollie.ngrok-free.dev";

// Helper function to get image URL with proxy fallback
function getProxyImageUrl(originalUrl) {
    // If no URL provided, return a default placeholder
    if (!originalUrl) {
        return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=';
    }
    
    // If it's already a data URL, return as is
    if (originalUrl.startsWith('data:')) {
        return originalUrl;
    }
    
    // If it's already an absolute URL, use it directly
    if (originalUrl.startsWith('http')) {
        return originalUrl;
    }
    
    // For relative URLs, try to construct absolute URL
    try {
        // Try to create a URL object using the current page's origin
        return new URL(originalUrl, window.location.origin).toString();
    } catch (e) {
        console.warn('Invalid image URL:', originalUrl);
        // Fallback to the original URL (might not work for relative paths)
        return originalUrl;
    }
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


// ==========================================
// 3. LOGIC GỬI TIN (CÓ STREAMING)
// ==========================================

// =========================================================
// HÀM GỬI TIN NHẮN (STREAMING + KEEP ALIVE)
// =========================================================
async function sendMessage(msgOverride = null) {
    // 1. CHUẨN BỊ DỮ LIỆU GỬI ĐI
    const text = msgOverride || messageInput.value.trim();
    if (!text && !selectedFile) return;

    if (!msgOverride) {
        messageInput.value = '';
        autoResizeTextarea(); // Reset chiều cao ô nhập
    }

    const welcome = document.querySelector('.welcome-message');
    if(welcome) welcome.style.display = 'none';

    // Chỉ hiện tin nhắn người dùng nếu không phải là lệnh GPS ngầm
    if (!text.startsWith("GPS:")) {
        addUserMessage(text);
    }
    
    setLoadingState(true);

    // 2. TẠO BONG BÓNG CHAT CỦA BOT (MỚI)
    messageCount++;
    const botMsgDiv = document.createElement('div');
    botMsgDiv.className = 'message bot';
    botMsgDiv.id = `msg-${messageCount}`;
    
    // 👇 QUAN TRỌNG: Mặc định hiển thị con trỏ ngay lập tức để không bị trống
    // Lúc này người dùng sẽ thấy bong bóng có con trỏ nhấp nháy
    botMsgDiv.innerHTML = `<div class="message-content"><span class="cursor-effect">█</span></div>`; 
    messagesArea.appendChild(botMsgDiv);
    scrollToBottom();

    const contentDiv = botMsgDiv.querySelector('.message-content');
    let fullText = ""; 

    try {
        const userId = localStorage.getItem("chat_session_id");
        
        // Gọi API
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                message: text,
                user_id: userId
            })
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        // 3. XỬ LÝ STREAMING (ĐỌC DỮ LIỆU TỪNG CHÚT MỘT)
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Giải mã đoạn dữ liệu vừa nhận (chunk)
            const chunk = decoder.decode(value, { stream: true });
            
            // Cộng dồn vào biến tổng
            fullText += chunk;

            // Cập nhật giao diện NGAY LẬP TỨC
            // formatText: giúp xuống dòng đúng
            // Thêm con trỏ █ ở cuối để tạo hiệu ứng đang gõ
            contentDiv.innerHTML = formatText(fullText) + '<span class="cursor-effect">█</span>';
            
            // Tự động cuộn xuống dưới cùng để người dùng đọc được
            if (typeof chatContent !== 'undefined') {
                chatContent.scrollTop = chatContent.scrollHeight;
            }
        }

        // 4. KẾT THÚC STREAM: XỬ LÝ MARKDOWN VÀ THẺ SẢN PHẨM
        // Lúc này dữ liệu đã về hết, ta xóa con trỏ đi và render thẻ đẹp
        processBackendResponse(fullText, contentDiv);

    } catch (error) {
        console.error("Stream Error:", error);
        // Nếu lỗi, hiện thông báo đỏ ngay trong bong bóng đó
        contentDiv.innerHTML = formatText(fullText) + `<br><div style="color:red; font-weight:bold; margin-top:5px; padding:5px; background:#ffe6e6; border-radius:4px;">⚠️ Lỗi: ${error.message}</div>`;
    } finally {
        setLoadingState(false);
    }
}


// ==========================================
// 2. XỬ LÝ FORMAT & RENDER THẺ SẢN PHẨM
// ==========================================
function processBackendResponse(markdownText, targetDiv = null) {
    // 1. CHUẨN HÓA DỮ LIỆU
    let html = markdownText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2. TÁCH PHẦN DẪN NHẬP VÀ PHẦN SẢN PHẨM
    // Tìm vị trí bắt đầu của sản phẩm đầu tiên (bắt đầu bằng **Tên...)
    const firstProductIndex = html.search(/\*\*(.*?)\*\*/);
    
    let introText = "";
    let productsText = html;

    if (firstProductIndex > 0) {
        introText = html.substring(0, firstProductIndex);
        productsText = html.substring(firstProductIndex);
    }

    // 3. REGEX (PHIÊN BẢN FIX LỖI TRÀN TEXT)
    const productBlockRegex = /\*\*(.*?)\*\*\s*\n\s*!\[(.*?)\]\((.*?)\)\s*\n\s*-\s*💰\s*Giá:\s*(.*?)\s*\n\s*-\s*⭐\s*Đánh giá:\s*(.*?)\s*\n(?:\s*-\s*⚙️\s*Thông số:\s*(.*?)\s*\n)?\s*-\s*📝\s*Mô tả:\s*([\s\S]*?)(?=\n\s*\*\*|$)/g;

    let hasProduct = false;
    let productsHtml = "";

    // 4. RENDER SẢN PHẨM
    productsHtml = productsText.replace(productBlockRegex, (match, name, alt, imgUrl, price, ratingStr, specs, description) => {
        hasProduct = true;
        
        const rating = ratingStr ? ratingStr.split('/')[0].trim() : '4.5';
        
        const productData = {
            name: name.trim(),
            imgUrl: imgUrl.trim(),
            price: price.trim(),
            rating: rating,
            description: description.replace(/---/g, '').trim(),
            specs: specs ? specs.trim() : ""
        };
        
        const encodedData = encodeURIComponent(JSON.stringify(productData));

        return `
            <div class="product-card-inline" style="display: flex; gap: 15px; margin: 15px 0; background: #fff; padding: 12px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e0e0e0; align-items: start;">
                
                <div class="product-image-inline" style="flex-shrink: 0; width: 120px; height: 120px; border-radius: 8px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center; border: 1px solid #f0f0f0;">
                    <img src="${getProxyImageUrl(productData.imgUrl)}" alt="${productData.name}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">
                </div>

                <div class="product-info-inline" style="flex: 1; display: flex; flex-direction: column; gap: 5px; min-width: 0;">
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

    // 5. GHÉP LẠI
    let finalHtml = "";
    introText = formatText(introText);
    
    if (hasProduct) {
        finalHtml = introText + productsHtml;
    } else {
        finalHtml = formatText(html);
    }

    // 6. CẬP NHẬT UI
    // Nếu có targetDiv (tức là đang update luồng stream cũ), ta sửa trực tiếp vào đó
    if (targetDiv) {
        targetDiv.innerHTML = finalHtml;
        // Scroll lần cuối để đảm bảo nhìn thấy nội dung mới nhất
        chatContent.scrollTop = chatContent.scrollHeight;
    } else {
        // Nếu không (trường hợp gọi từ nơi khác), tạo tin nhắn mới
        addBotMessageHTML(finalHtml);
    }
}

// 5. UI COMPONENTS
function addUserMessage(text) {
    messageCount++;
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';
    msgDiv.id = `msg-${messageCount}`;

    msgDiv.innerHTML = `
        <div class="message-content">
            <p>${escapeHtml(text)}</p>
        </div>
    `;

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
// ================================
// TÌM CỬA HÀNG GẦN NHẤT (GPS FIXED)
// ================================

const GEOLOCATION_OPTIONS = {
    enableHighAccuracy: false, // 🔥 BẮT BUỘC: tránh timeout
    timeout: 20000,            // 20s
    maximumAge: 300000         // cache 5 phút
};

window.handleFindStore = async function () {

    // 1. Trình duyệt không hỗ trợ GPS
    if (!navigator.geolocation) {
        addBotMessageHTML(`
            <div class="store-location-error">
                <p>⚠️ Trình duyệt không hỗ trợ định vị.</p>
                <div class="manual-location-input">
                    <input type="text" id="manualLocation" placeholder="Ví dụ: Quận 1, HCM">
                    <button onclick="searchStoreByLocation()">Tìm kiếm</button>
                </div>
            </div>
        `);
        return;
    }

    // 2. Hiển thị loading
    const loadingMsg = document.createElement('div');
    loadingMsg.className = 'message bot';
    loadingMsg.innerHTML = `
        <div class="store-location-loading">
            <div class="spinner"></div>
            <p>📍 Đang xác định vị trí của bạn...</p>
            <p class="hint">Vui lòng cho phép truy cập vị trí</p>
        </div>
    `;
    messagesArea.appendChild(loadingMsg);
    scrollToBottom();

    try {
        // 3. LẤY GPS
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                GEOLOCATION_OPTIONS
            );
        });

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('[GPS]', lat, lng);

        // 4. Cập nhật UI
        loadingMsg.querySelector('p').textContent = '🔍 Đang tìm cửa hàng gần bạn...';

        // 5. GỬI TOẠ ĐỘ LÊN BACKEND
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                message: `GPS:${lat},${lng}`,
                user_id: localStorage.getItem("chat_session_id") || "guest"
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // 6. HIỂN THỊ KẾT QUẢ
        loadingMsg.remove();
        addBotMessageHTML(data.response || "Không tìm thấy cửa hàng gần bạn.");

    } catch (error) {
        console.error('[GPS ERROR]', error);

        let msg = "Không thể xác định vị trí của bạn.";

        // 🔥 BẮT LỖI ĐÚNG CHUẨN
        if (error.code === 1) {
            msg = "Bạn đã từ chối quyền truy cập vị trí.";
        } else if (error.code === 2) {
            msg = "Không thể truy cập thông tin vị trí.";
        } else if (error.code === 3) {
            msg = "Xác định vị trí quá lâu, vui lòng thử lại.";
        }

        const errorHtml = `
            <div class="store-location-error">
                <p>⚠️ ${msg}</p>
                <div class="manual-location-input">
                    <input type="text" id="manualLocation" placeholder="Ví dụ: Quận 1, HCM">
                    <button onclick="searchStoreByLocation()">Tìm kiếm</button>
                </div>
            </div>
        `;

        if (loadingMsg && loadingMsg.parentNode) {
            loadingMsg.outerHTML = errorHtml;
        } else {
            addBotMessageHTML(errorHtml);
        }
    }
};


// Hàm tìm kiếm cửa hàng theo địa điểm nhập tay
// Hàm tìm kiếm cửa hàng theo địa chỉ nhập tay
window.searchStoreByLocation = async function() {
    const locationInput = document.getElementById('manualLocation');
    if (!locationInput || !locationInput.value.trim()) {
        showNotification('Lỗi', 'Vui lòng nhập địa điểm cần tìm', 'error');
        return;
    }
    
    const location = locationInput.value.trim();
    
    // Thêm tin nhắn người dùng
    addUserMessage(`Tìm cửa hàng ở ${location}`);
    
    try {
        const userId = localStorage.getItem("chat_session_id");
        showTypingIndicator();
        setLoadingState(true);
        
        // Gọi API tìm kiếm cửa hàng
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                message: `Tìm cửa hàng ở ${location}`,
                user_id: userId
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        addBotMessageHTML(data.response || "Không tìm thấy cửa hàng nào phù hợp.");
        
    } catch (error) {
        console.error("Search Error:", error);
        addBotMessageHTML("⚠️ <strong>Lỗi tìm kiếm:</strong> Không thể tìm cửa hàng lúc này. Vui lòng thử lại sau.");
    } finally {
        hideTypingIndicator();
        setLoadingState(false);
        // Xóa nội dung input sau khi gửi
        if (locationInput) locationInput.value = '';
    }
};

// This function is called when the page loads to check if we should automatically find stores
document.addEventListener('DOMContentLoaded', () => {
    // Check if we should automatically find stores (e.g., from a button click)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('findStores') === 'true') {
        // Small delay to ensure everything is loaded
        setTimeout(() => {
            handleFindStore();
        }, 1000);
    }
});


function formatText(text) {
    if (!text) return "";
    let html = text;
    // In đậm: **text** -> <b>text</b>
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    // In nghiêng: *text* -> <i>text</i>
    html = html.replace(/(^|[^\*])\*(?!\*)(.*?)\*/g, '$1<i>$2</i>');
    // Xuống dòng
    html = html.replace(/\n/g, '<br>');
    // Gạch đầu dòng
    html = html.replace(/^- /gm, '• ');
    return html;
}