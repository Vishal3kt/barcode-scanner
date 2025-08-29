// Enhanced mock database with more products
const mockProducts = {
    '0123456789012': {
        name: 'Organic Apple Juice',
        price: '$4.99',
        brand: 'Nature\'s Best',
        description: '100% organic apple juice, 1L bottle, no added sugars'
    },
    '0123456789013': {
        name: 'Whole Wheat Bread',
        price: '$3.49',
        brand: 'Baker\'s Choice',
        description: 'Fresh baked whole wheat bread, 20 slices, high fiber'
    },
    '0987654321098': {
        name: 'Premium Coffee Beans',
        price: '$12.99',
        brand: 'Mountain Roast',
        description: 'Single origin arabica beans, medium roast, 250g'
    },
    '1234567890123': {
        name: 'Organic Pasta',
        price: '$2.79',
        brand: 'Italian Delights',
        description: 'Organic durum wheat penne pasta, 500g package'
    },
    '5901234123457': {
        name: 'Greek Yogurt',
        price: '$6.49',
        brand: 'Pure Greek',
        description: '0% fat Greek style yogurt, 500g container'
    },
    // Add more test barcodes for better testing
    '012000050084': {
        name: 'Coca Cola Classic',
        price: '$1.99',
        brand: 'Coca Cola',
        description: '12 fl oz can, classic taste'
    },
    '028400064057': {
        name: 'Doritos Nacho Cheese',
        price: '$3.49',
        brand: 'Frito-Lay',
        description: 'Nacho cheese flavored tortilla chips, 9.25 oz'
    }
};

// App state
let isScanning = false;
let stream = null;
let scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
let lastScanCode = '';
let lastScanTime = 0;
let codeReader = null;
let animationId = null;

// DOM elements
const scanBtn = document.getElementById('scanBtn');
const cameraContainer = document.getElementById('cameraContainer');
const camera = document.getElementById('camera');
const status = document.getElementById('status');
const results = document.getElementById('results');

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    initializeZXing();
    updateStats();
    displayResults();
});

function initializeZXing() {
    try {
        // Initialize ZXing with multiple format support
        codeReader = new ZXing.BrowserMultiFormatReader();

        // Configure hints for better accuracy
        const hints = new Map();
        hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
            ZXing.BarcodeFormat.UPC_A,
            ZXing.BarcodeFormat.UPC_E,
            ZXing.BarcodeFormat.EAN_13,
            ZXing.BarcodeFormat.EAN_8,
            ZXing.BarcodeFormat.CODE_128,
            ZXing.BarcodeFormat.CODE_39,
            ZXing.BarcodeFormat.ITF,
            ZXing.BarcodeFormat.RSS_14,
            ZXing.BarcodeFormat.CODABAR
        ]);
        hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
        hints.set(ZXing.DecodeHintType.ALSO_INVERTED, true);

        codeReader.setHints(hints);
        console.log('ZXing initialized with enhanced settings');

    } catch (error) {
        console.error('ZXing initialization failed:', error);
        updateStatus('❌ Scanner initialization failed', 'error');
    }
}

async function toggleScanning() {
    if (isScanning) {
        stopScanning();
    } else {
        await startScanning();
    }
}

async function startScanning() {
    if (isScanning) return;

    try {
        updateStatus('🚀 Initializing professional scanner...', 'info');
        scanBtn.disabled = true;
        scanBtn.textContent = 'Starting...';

        // Get available video devices
        const videoDevices = await codeReader.listVideoInputDevices();
        console.log('Available cameras:', videoDevices);

        // Prefer back camera for barcode scanning
        let selectedDevice = videoDevices[0];
        for (let device of videoDevices) {
            if (device.label.toLowerCase().includes('back') ||
                device.label.toLowerCase().includes('rear') ||
                device.label.toLowerCase().includes('environment')) {
                selectedDevice = device;
                break;
            }
        }

        console.log('Selected camera:', selectedDevice);

        // Configure high-quality video constraints
        const constraints = {
            video: {
                deviceId: selectedDevice ? selectedDevice.deviceId : undefined,
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
                frameRate: { ideal: 30 },
                focusMode: 'continuous',
                autoGainControl: true,
                noiseSuppression: true,
                echoCancellation: false
            }
        };

        // Start camera stream
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        camera.srcObject = stream;

        await new Promise(resolve => {
            camera.onloadedmetadata = resolve;
        });

        await camera.play();

        // Show camera interface
        cameraContainer.classList.add('active');
        scanBtn.textContent = 'Stop Scanning';
        scanBtn.disabled = false;
        isScanning = true;

        // Start continuous scanning
        startContinuousScanning();

        updateStatus('🎯 Professional scanner active - Position barcode clearly', 'success');

    } catch (error) {
        console.error('Scanner start failed:', error);
        updateStatus('❌ Camera access failed. Check permissions.', 'error');
        resetScanButton();
    }
}

function startContinuousScanning() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const scanFrame = () => {
        if (!isScanning || !camera.videoWidth || !camera.videoHeight) {
            if (isScanning) {
                animationId = requestAnimationFrame(scanFrame);
            }
            return;
        }

        // Set canvas size to match video
        canvas.width = camera.videoWidth;
        canvas.height = camera.videoHeight;

        // Draw current video frame to canvas
        ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);

        try {
            // Get image data for scanning
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Try to decode barcode from current frame
            const result = codeReader.decodeFromImageData(imageData);

            if (result) {
                const code = result.getText();
                const format = result.getBarcodeFormat();

                console.log('✅ Barcode detected:', code, ZXing.BarcodeFormat[format]);
                handleScanResult(code, ZXing.BarcodeFormat[format]);
            }

        } catch (error) {
            // No barcode found in this frame - continue scanning
            if (error.name !== 'NotFoundException') {
                console.log('Scan error:', error.name);
            }
        }

        // Continue scanning
        if (isScanning) {
            animationId = requestAnimationFrame(scanFrame);
        }
    };

    // Start scanning loop
    animationId = requestAnimationFrame(scanFrame);
}

function stopScanning() {
    isScanning = false;

    // Cancel animation frame
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    // Stop camera stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // Reset camera
    if (codeReader) {
        try {
            codeReader.reset();
        } catch (e) {
            console.log('CodeReader reset error:', e);
        }
    }

    // Reset UI
    camera.srcObject = null;
    cameraContainer.classList.remove('active');
    resetScanButton();
    updateStatus('🛑 Scanner stopped', 'info');
}

function resetScanButton() {
    scanBtn.textContent = 'Start Scanning';
    scanBtn.disabled = false;
}

function handleScanResult(code, format) {
    const now = Date.now();

    // Prevent rapid duplicate scans
    if (code === lastScanCode && (now - lastScanTime) < 1500) {
        return;
    }

    lastScanCode = code;
    lastScanTime = now;

    // Enhanced feedback
    provideFeedback();

    // Create scan record
    const scanData = {
        id: now,
        code: code,
        format: format || 'UNKNOWN',
        timestamp: new Date().toISOString(),
        product: mockProducts[code] || null
    };

    // Add to history
    scanHistory.unshift(scanData);

    // Keep only last 50 scans for professional use
    scanHistory = scanHistory.slice(0, 50);

    // Save to storage
    localStorage.setItem('scanHistory', JSON.stringify(scanHistory));

    // Update UI immediately
    updateStats();
    displayResults();

    // Show detailed result
    const productInfo = scanData.product ? scanData.product.name : 'Product Not Found';
    const formatDisplay = format ? format.replace(/_/g, ' ') : 'Unknown Format';

    updateStatus(`✅ ${formatDisplay}: ${productInfo} (${code})`, 'success');

    console.log(`🎯 Professional scan: ${code} [${format}]`);
}

function provideFeedback() {
    // Enhanced vibration pattern
    if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
    }

    // Professional beep sound
    playProfessionalBeep();

    // Visual feedback
    flashScreen();
}

function playProfessionalBeep() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();

        // Create a more professional beep (like store scanners)
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        const filterNode = audioContext.createBiquadFilter();

        oscillator.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Professional scanner frequency
        oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.1);

        // Filter for cleaner sound
        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(2000, audioContext.currentTime);

        // Professional volume curve
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);

    } catch (e) {
        console.log('Audio feedback not available');
    }
}

function flashScreen() {
    // Quick green flash for successful scan
    const flash = document.createElement('div');
    flash.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(40, 167, 69, 0.3);
        z-index: 9999;
        pointer-events: none;
        animation: flash 0.3s ease-out;
    `;

    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 300);

    // Add CSS animation if not exists
    if (!document.querySelector('#flash-animation')) {
        const style = document.createElement('style');
        style.id = 'flash-animation';
        style.textContent = `
            @keyframes flash {
                0% { opacity: 0; }
                50% { opacity: 1; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

function displayResults() {
    if (scanHistory.length === 0) {
        results.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 15px;">🛒</div>
                <div>Professional Scanner Ready</div>
                <div style="font-size: 14px; margin-top: 10px; color: #6c757d;">
                    Supports UPC, EAN, Code 128, and more
                </div>
            </div>
        `;
        return;
    }

    let html = '';
    scanHistory.forEach((scan, index) => {
        const isLatest = index === 0;
        const date = new Date(scan.timestamp);
        const timeString = date.toLocaleString();

        html += `
            <div class="scan-result ${isLatest ? 'latest' : ''}">
                <div class="result-header">
                    <span class="result-type">${scan.format.replace(/_/g, ' ')}</span>
                    <span class="result-time">${timeString}</span>
                </div>
                <div class="barcode-data">${scan.code}</div>
                ${scan.product ? `
                    <div class="product-info">
                        <div class="product-name">✅ ${scan.product.name}</div>
                        <div class="product-price">${scan.product.price}</div>
                        <div class="product-details">
                            <strong>Brand:</strong> ${scan.product.brand}<br>
                            ${scan.product.description}
                        </div>
                    </div>
                ` : `
                    <div class="product-info">
                        <div style="color: #dc3545; font-weight: 600;">
                            ⚠️ Product not in database
                        </div>
                        <div style="color: #6c757d; font-size: 14px; margin-top: 5px;">
                            Barcode scanned successfully but no product information available
                        </div>
                    </div>
                `}
            </div>
        `;
    });

    results.innerHTML = html;
}

function updateStats() {
    const totalScans = scanHistory.length;
    const today = new Date().toDateString();
    const todayScans = scanHistory.filter(scan =>
        new Date(scan.timestamp).toDateString() === today
    ).length;
    const foundProducts = scanHistory.filter(scan => scan.product !== null).length;

    document.getElementById('totalScans').textContent = totalScans;
    document.getElementById('todayScans').textContent = todayScans;
    document.getElementById('foundProducts').textContent = foundProducts;
}

function clearHistory() {
    if (confirm('Clear all scan history? This cannot be undone.')) {
        scanHistory = [];
        localStorage.removeItem('scanHistory');
        updateStats();
        displayResults();
        updateStatus('📋 History cleared', 'info');
    }
}

function updateStatus(message, type = 'info') {
    status.className = `status status-${type}`;
    status.textContent = message;
}

// Enhanced cleanup
window.addEventListener('beforeunload', function () {
    if (isScanning) {
        stopScanning();
    }
});

// Professional mobile handling
document.addEventListener('visibilitychange', function () {
    if (document.hidden && isScanning) {
        console.log('📱 App backgrounded - pausing scanner');
        // Optionally pause scanning to save battery
    } else if (!document.hidden && !isScanning && stream) {
        console.log('📱 App resumed');
    }
});

// Debug and performance monitoring
function getPerformanceStats() {
    return {
        isScanning,
        hasStream: !!stream,
        cameraReady: camera.readyState,
        scanHistory: scanHistory.length,
        lastScan: lastScanCode,
        memoryUsage: performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB'
        } : 'Not available'
    };
}

// Expose for debugging
window.scannerDebug = getPerformanceStats;