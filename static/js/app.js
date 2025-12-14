// ===== MAIN APPLICATION FILE (UI/UX OPTIMIZED V3) =====

let messageInput, sendBtn, attachBtn, messagesArea, chatContent, filePreviewArea;
let selectedFile = null;
let messageCount = 0;

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
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text && !selectedFile) return;

    const currentText = text;
    messageInput.value = '';
    autoResizeTextarea();
    
    // Ẩn welcome
    const welcome = document.querySelector('.welcome-message');
    if(welcome) welcome.style.display = 'none';

    // UI: User Message
    addUserMessage(currentText);
    showTypingIndicator();

    // UX: Disable nút gửi
    setLoadingState(true);

    try {
        const userId = localStorage.getItem("chat_session_id");
        
        // Gọi API
        const response = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: currentText,
                user_id: userId
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        
        hideTypingIndicator();
        
        // Xử lý và hiển thị phản hồi
        processBackendResponse(data.response);

    } catch (error) {
        hideTypingIndicator();
        console.error("API Error:", error);
        addBotMessageHTML(`⚠️ <strong>Lỗi kết nối:</strong> ${error.message}. Vui lòng kiểm tra lại server.`);
    } finally {
        setLoadingState(false);
    }
}

// 4. PARSER NÂNG CAO (Đã sửa đổi để hiển thị ảnh bên cạnh thông tin)
function processBackendResponse(markdownText) {
    let html = markdownText;

    // 1. Định nghĩa Regex để bắt trọn khối sản phẩm theo định dạng từ Backend
    // Định dạng: **Tên** \n ![Alt](URL) \n - 💰 Giá: ... \n - ⭐ Đánh giá: ... \n - 📝 Mô tả: ...
    // Sử dụng cờ 'g' (global) để thay thế tất cả các sản phẩm tìm thấy
    const productBlockRegex = /\*\*(.*?)\*\*\n\s*!\[(.*?)\]\((.*?)\)\n\s*-\s*💰\s*Giá:\s*(.*?)\n\s*-\s*⭐\s*Đánh giá:\s*(.*?)\n\s*-\s*📝\s*Mô tả:\s*(.*?)(?=(\n\s*---\s*\n|$))/g;

    // 2. Thay thế khối markdown bằng HTML của thẻ sản phẩm nằm ngang
    // Hàm replace sẽ chạy cho mỗi lần tìm thấy một khối sản phẩm
    html = html.replace(productBlockRegex, (match, name, alt, imgUrl, price, ratingStr, description) => {
        const rating = ratingStr.split('/')[0] || '4.5'; // Lấy số sao
        
        // Tạo object dữ liệu để truyền vào nút "Chi tiết"
        const productData = {
            name: name.trim(),
            imgUrl: imgUrl.trim(),
            price: price.trim(),
            rating: rating.trim(),
            description: description.trim()
        };
        // Mã hóa dữ liệu để truyền an toàn trong thuộc tính onclick
        const encodedData = encodeURIComponent(JSON.stringify(productData));

        // HTML cho thẻ sản phẩm nằm ngang (Sử dụng inline CSS để đảm bảo hiển thị đúng mà không cần sửa file CSS)
        // Layout: Flexbox, ảnh bên trái, thông tin bên phải
        return `
            <div class="product-card-inline" style="display: flex; gap: 15px; margin: 20px 0; background: rgba(255, 255, 255, 0.5); backdrop-filter: blur(10px); padding: 15px; border-radius: 16px; border: 1px solid rgba(37, 99, 235, 0.1); box-shadow: 0 4px 15px rgba(0,0,0,0.05); transition: transform 0.2s;">
                <div class="product-image-inline" style="flex-shrink: 0; width: 140px; height: 140px; border-radius: 12px; overflow: hidden; background: #fff; display: flex; align-items: center; justify-content: center;">
                    <img src="${productData.imgUrl}" alt="${productData.name}" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                <div class="product-info-inline" style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                    <div class="product-name-inline" style="font-size: 17px; font-weight: 700; margin-bottom: 8px; color: var(--text-primary); line-height: 1.3;">${productData.name}</div>
                    <div class="product-price-inline" style="font-size: 16px; font-weight: 700; color: var(--primary-color); margin-bottom: 8px;">${productData.price}</div>
                    <div class="product-rating-inline" style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px; display: flex; align-items: center;">
                        <span style="color: #ffd700; margin-right: 5px;">⭐</span> ${productData.rating}/5
                    </div>
                    <div class="product-desc-inline" style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; opacity: 0.9;">
                        ${productData.description}
                    </div>
                    <button class="btn-details-inline" onclick="window.openProductPanel('${encodedData}')" style="align-self: flex-start; padding: 8px 16px; font-size: 14px; border: none; background: var(--gradient-primary); color: white; border-radius: 8px; cursor: pointer; font-weight: 600; transition: all 0.2s; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.2);">
                        Xem chi tiết
                    </button>
                </div>
            </div>
        `;
    });

    // 3. Xóa các dấu gạch ngang phân cách (---) còn sót lại trong markdown
    html = html.replace(/\n\s*---\s*\n/g, '\n');

    // 4. Format các phần văn bản còn lại (in đậm, in nghiêng, xuống dòng)
    html = formatText(html);

    // 5. Hiển thị toàn bộ nội dung đã xử lý (text + thẻ sản phẩm) trong một tin nhắn duy nhất
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
                    if(img) img.src = product.imgUrl;
                    
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
window.handleFindStore = function () {
    if (!navigator.geolocation) {
        addBotMessageHTML("⚠️ Trình duyệt không hỗ trợ định vị.");
        return;
    }

    addBotMessageHTML(
      '<i style="color:#666;">📍 Đang xác định vị trí của bạn...</i>'
    );

    const options = {
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 60000
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;

            addUserMessage("📍 Tìm cửa hàng CellPhoneS gần nhất");

            sendMessage(JSON.stringify({
                type: "location",
                lat: latitude,
                lng: longitude
            }));
        },
        (err) => {
            let msg = "Không thể lấy vị trí.";
            if (err.code === 1) msg = "Bạn đã từ chối quyền truy cập vị trí.";
            if (err.code === 2) msg = "Không xác định được vị trí.";
            if (err.code === 3) msg = "Lấy vị trí quá lâu, vui lòng thử lại.";

            addBotMessageHTML(`⚠️ ${msg}`);
        },
        options
    );
};

