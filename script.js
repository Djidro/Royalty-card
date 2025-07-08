// Customer Database
let customers = JSON.parse(localStorage.getItem('bakeryCustomers')) || [];
let scannerActive = false;
let currentScannerStream = null;

// DOM Elements
const registrationForm = document.getElementById('registration-form');
const qrResult = document.getElementById('qr-result');
const qrCodeDiv = document.getElementById('qr-code');
const downloadQrBtn = document.getElementById('download-qr');
const displayName = document.getElementById('display-name');
const displayPhone = document.getElementById('display-phone');
const displayPoints = document.getElementById('display-points');

const scanResult = document.getElementById('scan-result');
const scanName = document.getElementById('scan-name');
const scanPhone = document.getElementById('scan-phone');
const scanPoints = document.getElementById('scan-points');
const scanLastVisit = document.getElementById('scan-last-visit');
const addPointBtn = document.getElementById('add-point');
const rewardMessage = document.getElementById('reward-message');

const startScanBtn = document.getElementById('start-scan');
const stopScanBtn = document.getElementById('stop-scan');
const scannerVideo = document.getElementById('scanner-video');
const scannerCanvas = document.getElementById('scanner-canvas');
const scannerCtx = scannerCanvas.getContext('2d');
const scannerStatus = document.getElementById('scanner-status');

const searchInput = document.getElementById('search-customers');
const customersTable = document.getElementById('customers-table').querySelector('tbody');
const exportDataBtn = document.getElementById('export-data');
const clearDataBtn = document.getElementById('clear-data');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        
        // Update active tab button
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update active tab content
        tabContents.forEach(content => content.classList.remove('active'));
        document.getElementById(tabId).classList.add('active');
        
        // Stop scanner when switching tabs
        if (tabId !== 'scan' && scannerActive) {
            stopScanner();
        }
    });
});

// Registration Form
registrationForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value.trim();
    const name = document.getElementById('name').value.trim();
    
    // Validate phone number
    if (!/^\d{10,15}$/.test(phone)) {
        alert('Please enter a valid phone number (10-15 digits)');
        return;
    }
    
    // Check if customer already exists
    const existingCustomer = customers.find(c => c.phone === phone);
    
    if (existingCustomer) {
        alert('Customer with this phone number already exists!');
        displayCustomerQR(existingCustomer);
        return;
    }
    
    // Create new customer
    const newCustomer = {
        phone,
        name,
        points: 0,
        visits: [],
        lastVisit: null,
        registeredDate: new Date().toISOString()
    };
    
    customers.push(newCustomer);
    saveCustomers();
    displayCustomerQR(newCustomer);
    
    // Reset form
    registrationForm.reset();
});

// Display QR Code
function displayCustomerQR(customer) {
    displayName.textContent = customer.name;
    displayPhone.textContent = customer.phone;
    displayPoints.textContent = `${customer.points}/10`;
    
    // Clear previous QR code
    qrCodeDiv.innerHTML = '<div class="loading">Generating QR code...</div>';
    
    // Generate new QR code after a slight delay to allow DOM update
    setTimeout(() => {
        try {
            qrCodeDiv.innerHTML = '';
            new QRCode(qrCodeDiv, {
                text: customer.phone,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        } catch (error) {
            console.error("QR generation error:", error);
            qrCodeDiv.innerHTML = '<div class="error">Failed to generate QR code</div>';
        }
    }, 100);
    
    qrResult.classList.remove('hidden');
}

// Download QR Code
downloadQrBtn.addEventListener('click', function() {
    const canvas = qrCodeDiv.querySelector('canvas');
    if (!canvas) {
        alert('Please generate a QR code first');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `bakery-loyalty-${displayPhone.textContent}.png`;
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Scanner Functions
startScanBtn.addEventListener('click', startScanner);
stopScanBtn.addEventListener('click', stopScanner);

async function startScanner() {
    try {
        scannerStatus.textContent = "Starting camera...";
        startScanBtn.disabled = true;
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        currentScannerStream = stream;
        scannerVideo.srcObject = stream;
        scannerActive = true;
        
        scannerVideo.onloadedmetadata = () => {
            scannerVideo.play();
            startScanBtn.classList.add('hidden');
            stopScanBtn.classList.remove('hidden');
            scannerStatus.textContent = "Scanning... Point camera at QR code";
            requestAnimationFrame(scanFrame);
        };
        
    } catch (err) {
        console.error("Camera error:", err);
        scannerStatus.textContent = "Camera access denied or not available";
        startScanBtn.disabled = false;
    }
}

function stopScanner() {
    if (currentScannerStream) {
        currentScannerStream.getTracks().forEach(track => track.stop());
        currentScannerStream = null;
    }
    
    scannerActive = false;
    scannerVideo.srcObject = null;
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
    scannerStatus.textContent = "Camera not active";
    startScanBtn.disabled = false;
}

function scanFrame() {
    if (!scannerActive) return;
    
    if (scannerVideo.readyState >= scannerVideo.HAVE_ENOUGH_DATA) {
        scannerCanvas.hidden = false;
        scannerCanvas.width = scannerVideo.videoWidth;
        scannerCanvas.height = scannerVideo.videoHeight;
        
        scannerCtx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
        const imageData = scannerCtx.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code) {
            handleScannedCode(code.data);
        } else {
            requestAnimationFrame(scanFrame);
        }
    } else {
        requestAnimationFrame(scanFrame);
    }
}

function handleScannedCode(data) {
    const customer = customers.find(c => c.phone === data);
    
    if (customer) {
        stopScanner();
        displayScanResult(customer);
    } else {
        scannerStatus.textContent = "Customer not found. Please register first.";
        setTimeout(() => {
            scannerStatus.textContent = "Scanning... Point camera at QR code";
            requestAnimationFrame(scanFrame);
        }, 2000);
    }
}

function displayScanResult(customer) {
    scanName.textContent = customer.name;
    scanPhone.textContent = customer.phone;
    scanPoints.textContent = `${customer.points}/10`;
    scanLastVisit.textContent = customer.lastVisit ? 
        new Date(customer.lastVisit).toLocaleString() : 'Never visited';
    
    scanResult.classList.remove('hidden');
    rewardMessage.classList.add('hidden');
}

// Add Point
addPointBtn.addEventListener('click', function() {
    const phone = scanPhone.textContent;
    const customerIndex = customers.findIndex(c => c.phone === phone);
    
    if (customerIndex !== -1) {
        const customer = customers[customerIndex];
        customer.points += 1;
        customer.visits.push(new Date().toISOString());
        customer.lastVisit = new Date().toISOString();
        
        // Check for reward
        if (customer.points >= 10) {
            customer.points = 0;
            rewardMessage.classList.remove('hidden');
            // In a real app, you might want to notify the admin here
        }
        
        customers[customerIndex] = customer;
        saveCustomers();
        displayScanResult(customer);
        
        // Update the customer in the table if on that tab
        renderCustomersTable(searchInput.value);
    }
});

// Customer Database Table
function renderCustomersTable(filter = '') {
    customersTable.innerHTML = '';
    
    const filteredCustomers = filter 
        ? customers.filter(c => 
            c.name.toLowerCase().includes(filter.toLowerCase()) || 
            c.phone.includes(filter))
        : customers;
    
    if (filteredCustomers.length === 0) {
        customersTable.innerHTML = '<tr><td colspan="5" class="no-customers">No customers found</td></tr>';
        return;
    }
    
    filteredCustomers.forEach(customer => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.points}/10</td>
            <td>${customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'Never'}</td>
            <td class="actions">
                <button class="view-btn" data-phone="${customer.phone}">View</button>
                <button class="delete-btn" data-phone="${customer.phone}">Delete</button>
            </td>
        `;
        
        customersTable.appendChild(row);
    });
    
    // Add event listeners to buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const phone = this.getAttribute('data-phone');
            const customer = customers.find(c => c.phone === phone);
            if (customer) {
                displayCustomerQR(customer);
                document.querySelector('[data-tab="register"]').click();
            }
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this customer?')) {
                const phone = this.getAttribute('data-phone');
                customers = customers.filter(c => c.phone !== phone);
                saveCustomers();
                renderCustomersTable(searchInput.value);
                
                // If we're viewing this customer, hide the QR
                if (displayPhone.textContent === phone) {
                    qrResult.classList.add('hidden');
                }
            }
        });
    });
}

// Search Customers
searchInput.addEventListener('input', function() {
    renderCustomersTable(this.value);
});

// Export Data
exportDataBtn.addEventListener('click', function() {
    if (customers.length === 0) {
        alert('No customer data to export');
        return;
    }
    
    const dataStr = JSON.stringify(customers, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bakery-customers-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // For Google Sheets integration, you would replace this with actual API calls
    console.log("In a real implementation, this would export to Google Sheets");
});

// Clear All Data
clearDataBtn.addEventListener('click', function() {
    if (confirm('WARNING: This will delete ALL customer data. Are you sure?')) {
        customers = [];
        localStorage.removeItem('bakeryCustomers');
        renderCustomersTable();
        qrResult.classList.add('hidden');
        scanResult.classList.add('hidden');
    }
});

// Save customers to localStorage
function saveCustomers() {
    localStorage.setItem('bakeryCustomers', JSON.stringify(customers));
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    renderCustomersTable();
    
    // Check if there's a hash in the URL to open a specific tab
    if (window.location.hash) {
        const tabId = window.location.hash.substring(1);
        const tabBtn = document.querySelector(`[data-tab="${tabId}"]`);
        if (tabBtn) tabBtn.click();
    }
    
    // Add a demo customer if the database is empty (for testing)
    if (customers.length === 0) {
        customers.push({
            phone: "1234567890",
            name: "Demo Customer",
            points: 5,
            visits: [
                new Date(Date.now() - 86400000 * 7).toISOString(),
                new Date(Date.now() - 86400000 * 5).toISOString(),
                new Date(Date.now() - 86400000 * 3).toISOString(),
                new Date(Date.now() - 86400000 * 2).toISOString(),
                new Date(Date.now() - 86400000).toISOString()
            ],
            lastVisit: new Date(Date.now() - 86400000).toISOString(),
            registeredDate: new Date(Date.now() - 86400000 * 10).toISOString()
        });
        saveCustomers();
        renderCustomersTable();
    }
});