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
    }
};

// App state
let isScanning = false;
let stream = null;
let scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
let lastScanCode = '';
let lastScanTime = 0;

// DOM elements
const scanBtn = document.getElementById('scanBtn');
const cameraContainer = document.getElementById('cameraContainer');
const camera = document.getElementById('camera');
const status = document.getElementById('status');
const results = document.getElementById('results');

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    updateStats();
    displayResults();
});

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
        updateStatus('Requesting camera access...', 'info');
        scanBtn.disabled = true;
        scanBtn.textContent = 'Starting...';

        // Simplified camera constraints for better mobile compatibility
        const constraints = {
            video: {
                facingMode: 'environment',  // Use back camera
                width: { ideal: 640 },      // Lower resolution for better performance
                height: { ideal: 480 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        camera.srcObject = stream;

        // Wait for video to be ready
        await new Promise(resolve => {
            camera.onloadedmetadata = resolve;
        });

        await camera.play();

        // Show camera interface
        cameraContainer.classList.add('active');
        scanBtn.textContent = 'Stop Scanning';
        scanBtn.disabled = false;

        // Initialize scanner with improved settings
        await initializeScanner();

        isScanning = true;
        updateStatus('📷 Scanning active - Position barcode in the blue frame', 'success');

    } catch (error) {
        console.error('Camera access error:', error);
        updateStatus('❌ Camera access denied. Please allow camera permissions.', 'error');
        resetScanButton();
    }
}

function initializeScanner() {
    return new Promise((resolve, reject) => {
        // Simplified, more reliable configuration
        const config = {
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: camera
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "upc_reader",
                    "upc_e_reader"
                ],
                multiple: false
            },
            locate: true,
            locator: {
                patchSize: "medium",
                halfSample: true  // Better performance on mobile
            },
            numOfWorkers: 2,
            frequency: 10,  // Reduced frequency for mobile performance
            area: {
                top: "30%",
                right: "30%",
                left: "30%",
                bottom: "30%"
            }
        };

        Quagga.init(config, function (err) {
            if (err) {
                console.error('Quagga initialization error:', err);
                reject(err);
                return;
            }

            console.log('Quagga initialized successfully');
            Quagga.start();

            // Simplified detection with lower threshold
            Quagga.onDetected(function (result) {
                if (!isScanning) return;

                const code = result.codeResult.code;
                const format = result.codeResult.format;

                console.log('Barcode detected:', code, format);

                // More lenient detection - any valid barcode
                if (code && code.length >= 8) {
                    handleScanResult(code, format);
                }
            });

            // Add processing event for debugging
            Quagga.onProcessed(function (result) {
                if (!result) return;

                // Log processing attempts (for debugging)
                if (result.codeResult) {
                    console.log('Processing result:', result.codeResult.code);
                }
            });

            resolve();
        });
    });
}

function stopScanning() {
    isScanning = false;

    // Stop Quagga
    try {
        Quagga.stop();
        console.log('Quagga stopped');
    } catch (e) {
        console.log('Quagga stop error:', e);
    }

    // Stop camera stream
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    // Reset UI
    camera.srcObject = null;
    cameraContainer.classList.remove('active');
    resetScanButton();
    updateStatus('Scanner stopped', 'info');
}

function resetScanButton() {
    scanBtn.textContent = 'Start Scanning';
    scanBtn.disabled = false;
}

function handleScanResult(code, format) {
    const now = Date.now();

    // Prevent rapid duplicate scans (reduced time)
    if (code === lastScanCode && (now - lastScanTime) < 2000) {
        return;
    }

    lastScanCode = code;
    lastScanTime = now;

    // Vibration feedback on mobile
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    // Audio feedback (optional)
    playBeep();

    // Create scan record
    const scanData = {
        id: now,
        code: code,
        format: format.toUpperCase(),
        timestamp: new Date().toISOString(),
        product: mockProducts[code] || null
    };

    // Add to history
    scanHistory.unshift(scanData);

    // Keep only last 25 scans
    scanHistory = scanHistory.slice(0, 25);

    // Save to storage
    localStorage.setItem('scanHistory', JSON.stringify(scanHistory));

    // Update UI
    updateStats();
    displayResults();

    // Show result
    const productInfo = scanData.product ? scanData.product.name : 'Unknown Product';
    updateStatus(`✅ Successfully scanned: ${productInfo} (${code})`, 'success');

    console.log(`Detected barcode: ${code} (${format})`);
}

function playBeep() {
    // Create audio feedback for successful scan
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
        console.log('Audio feedback not available');
    }
}

function displayResults() {
    if (scanHistory.length === 0) {
        results.innerHTML = `
            <div class="empty-state">
                <div style="font-size: 3rem; margin-bottom: 15px;">📱</div>
                <div>No scans yet - Start scanning to see results</div>
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
                    <span class="result-type">${scan.format}</span>
                    <span class="result-time">${timeString}</span>
                </div>
                <div class="barcode-data">${scan.code}</div>
                ${scan.product ? `
                    <div class="product-info">
                        <div class="product-name">${scan.product.name}</div>
                        <div class="product-price">${scan.product.price}</div>
                        <div class="product-details">
                            <strong>Brand:</strong> ${scan.product.brand}<br>
                            ${scan.product.description}
                        </div>
                    </div>
                ` : `
                    <div class="product-info">
                        <div style="color: #6c757d; font-style: italic;">
                            Product information not available
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
    if (confirm('Are you sure you want to clear all scan history?')) {
        scanHistory = [];
        localStorage.removeItem('scanHistory');
        updateStats();
        displayResults();
        updateStatus('Scan history cleared', 'info');
    }
}

function updateStatus(message, type = 'info') {
    status.className = `status status-${type}`;
    status.textContent = message;
}

// Handle page unload cleanup
window.addEventListener('beforeunload', function () {
    if (isScanning) {
        stopScanning();
    }
});

// Handle mobile app lifecycle
document.addEventListener('visibilitychange', function () {
    if (document.hidden && isScanning) {
        console.log('App backgrounded');
    } else if (!document.hidden && stream && !isScanning) {
        console.log('App resumed');
    }
});

// Debug function - can be removed in production
function debugScanner() {
    console.log('Scanner state:', {
        isScanning,
        hasStream: !!stream,
        cameraReady: camera.readyState,
        scanHistory: scanHistory.length
    });
}