// ===== PRODUCT DETAILS PANEL =====

document.addEventListener('DOMContentLoaded', () => {
    // Initialize panel elements
    const productPanel = document.getElementById('productPanel');
    const panelContent = document.getElementById('panelContent');
    const closeBtn = document.getElementById('closePanel');
    const chatSection = document.querySelector('.chat-section');

    // Check if elements exist
    if (!productPanel || !panelContent || !closeBtn) {
        console.warn('Product panel elements not found');
        return;
    }


    // Utility function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Generate star rating HTML
    function generateStarRating(rating) {
        const numRating = parseFloat(rating);
        const fullStars = Math.floor(numRating);
        const hasHalfStar = numRating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        
        // Full stars
        for (let i = 0; i < fullStars; i++) {
            stars += '<i class="fas fa-star"></i>';
        }
        
        // Half star
        if (hasHalfStar) {
            stars += '<i class="fas fa-star-half-alt"></i>';
        }
        
        // Empty stars
        for (let i = 0; i < emptyStars; i++) {
            stars += '<i class="far fa-star"></i>';
        }
        
        return stars;
    }

    // Product data for detailed view
    const premiumProducts = {}; // Can be populated with detailed product data later

    // Show product details panel
    window.showProductDetails = function(productName) {
        const product = premiumProducts[productName] || getDefaultProduct(productName);
        
        // Generate HTML for product details
        const html = `
            <div class="product-details-card">
                <!-- Product Header -->
                <div class="product-details-header">
                    <div class="product-details-name">${escapeHtml(product.name)}</div>
                    <div class="product-details-price">${escapeHtml(product.price)}</div>
                </div>
                
                <!-- Product Image -->
                <div class="product-image-container">
                    <img src="${product.image}" alt="${escapeHtml(product.name)}" class="product-detail-image">
                    <div class="image-overlay"></div>
                </div>
                
                <!-- Tagline -->
                ${product.tagline ? `
                <div class="product-tagline">
                    <i class="fas fa-quote-left"></i>
                    ${escapeHtml(product.tagline)}
                </div>
                ` : ''}
                
                <!-- Rating -->
                <div class="product-rating">
                    <div class="rating-stars">
                        ${generateStarRating(product.rating)}
                    </div>
                    <span class="rating-value">${product.rating}/5</span>
                    <span class="rating-count">• ${product.reviews} đánh giá</span>
                    <span style="margin-left: auto; color: #10b981; font-weight: 600;">
                        <i class="fas fa-check-circle" style="margin-right: 6px;"></i>
                        Còn hàng
                    </span>
                </div>
                
                <!-- Badges -->
                <div class="product-details-badges">
                    ${product.badges.map(badge => `
                        <span class="badge badge-${badge.type}">
                            <i class="fas ${badge.icon}"></i>
                            ${escapeHtml(badge.text)}
                        </span>
                    `).join('')}
                </div>
                
                <!-- Highlights -->
                <div class="product-highlights">
                    <div class="highlights-title">
                        <i class="fas fa-fire"></i>
                        Điểm nổi bật
                    </div>
                    <div class="highlights-grid">
                        ${product.highlights.map(highlight => `
                            <div class="highlight-item">
                                ${escapeHtml(highlight)}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Specifications -->
                <h3 class="section-title">
                    <i class="fas fa-microchip"></i>
                    Thông số kỹ thuật
                </h3>
                
                <div class="specs-grid">
                    ${product.specs.map(spec => `
                        <div class="spec-item">
                            <div class="spec-label">
                                <i class="fas fa-circle"></i>
                                ${escapeHtml(spec.label)}
                            </div>
                            <div class="spec-value">${escapeHtml(spec.value)}</div>
                            <span class="spec-desc">${escapeHtml(spec.desc)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Features -->
                <h3 class="section-title">
                    <i class="fas fa-star"></i>
                    Tính năng nổi bật
                </h3>
                
                <div class="features-grid">
                    ${product.features.map(feature => `
                        <div class="feature-item">
                            <div class="feature-icon">
                                <i class="fas ${feature.icon}"></i>
                            </div>
                            <span class="feature-text">${escapeHtml(feature.text)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <!-- Delivery Info -->
                <div class="delivery-info">
                    <div class="delivery-item">
                        <div class="delivery-icon">
                            <i class="fas fa-shipping-fast"></i>
                        </div>
                        <div class="delivery-text">
                            <div class="delivery-title">${product.delivery}</div>
                            <div class="delivery-subtitle">Miễn phí vận chuyển</div>
                        </div>
                    </div>
                    <div class="delivery-item">
                        <div class="delivery-icon">
                            <i class="fas fa-headset"></i>
                        </div>
                        <div class="delivery-text">
                            <div class="delivery-title">${product.support}</div>
                            <div class="delivery-subtitle">Tư vấn miễn phí</div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="details-actions">
                    <button class="details-btn btn-details-primary" onclick="window.handleFindStore()">
                        <i class="fas fa-map-marker-alt"></i> Tìm cửa hàng gần nhất
                    </button>
                    <button class="details-btn btn-details-secondary" 
                        data-name="${escapeHtml(product.name)}" 
                        onclick="window.handleConsulting(this.getAttribute('data-name'), true)">
                        <i class="fas fa-comments"></i> Tư vấn & So sánh
                    </button>
                </div>
                
                <!-- Support Note -->
                <div class="support-note">
                    <div class="note-icon">
                        <i class="fas fa-phone-alt"></i>
                    </div>
                    <p>Cần hỗ trợ? Gọi ngay <strong>1900 1234</strong></p>
                    <small>Đội ngũ chuyên gia sẽ tư vấn và hỗ trợ bạn 24/7</small>
                </div>
            </div>
        `;
        
        // Set panel content
        panelContent.innerHTML = html;
        
        
        // Show panel
        productPanel.classList.add('active');
        if (chatSection) {
            chatSection.classList.add('with-panel');
        }
    };

    // Default product template
    function getDefaultProduct(productName) {
        return {
            name: productName,
            tagline: 'Sản phẩm chất lượng cao',
            price: 'Liên hệ để biết giá',
            rating: '4.5',
            reviews: '0',
            image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAwIiBoZWlnaHQ9IjUwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjRjNGNEY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==',
            badges: [
                { type: 'warranty', text: 'Bảo hành 12 tháng', icon: 'fa-shield-alt' },
                { type: 'shipping', text: 'Giao hàng toàn quốc', icon: 'fa-shipping-fast' }
            ],
            highlights: [
                'Chất lượng đảm bảo',
                'Giá cả cạnh tranh',
                'Bảo hành chính hãng',
                'Hỗ trợ tận tình'
            ],
            specs: [
                { label: 'Thông tin', value: 'Đang cập nhật', desc: 'Vui lòng liên hệ để biết thông tin chi tiết' }
            ],
            features: [
                { icon: 'fa-shield-alt', text: 'Bảo hành chính hãng' },
                { icon: 'fa-shipping-fast', text: 'Giao hàng miễn phí' },
                { icon: 'fa-headset', text: 'Hỗ trợ 24/7' },
                { icon: 'fa-exchange-alt', text: 'Đổi trả dễ dàng' }
            ],
            delivery: 'Giao hàng nhanh',
            support: 'Tư vấn miễn phí'
        };
    }

    // Close panel
    function closePanel() {
        productPanel.classList.remove('active');
        if (chatSection) {
            chatSection.classList.remove('with-panel');
        }
        
        // Clear content with fade out animation
        panelContent.style.opacity = '0';
        panelContent.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            panelContent.innerHTML = '';
            panelContent.style.opacity = '1';
            panelContent.style.transform = 'translateY(0)';
        }, 300);
    }

    // Event listeners
    closeBtn.addEventListener('click', closePanel);
    
    // Close on Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && productPanel.classList.contains('active')) {
            closePanel();
        }
    });
});