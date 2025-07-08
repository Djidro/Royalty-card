// Customer Database
let customers = JSON.parse(localStorage.getItem('bakeryCustomers')) || [];

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

const searchInput = document.getElementById('search-customers');
const customersTable = document.getElementById('customers-table').querySelector('tbody');
const exportDataBtn = document.getElementById('export-data');

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
    });
});

// Registration Form
registrationForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value.trim();
    const name = document.getElementById('name').value.trim();
    
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
        lastVisit: null
    };
    
    customers.push(newCustomer);
    saveCustomers();
    displayCustomerQR(newCustomer);
    
    // Reset form
    registrationForm.reset();
});

function displayCustomerQR(customer) {
    displayName.textContent = customer.name;
    displayPhone.textContent = customer.phone;
    displayPoints.textContent = `${customer.points}/10`;
    
    // Generate QR code with phone number
    QRCode.toCanvas(qrCodeDiv, customer.phone, { width: 200 }, function(error) {
        if (error) console.error(error);
    });
    
    qrResult.classList.remove('hidden');
}

// Download QR Code
downloadQrBtn.addEventListener('click', function() {
    const canvas = qrCodeDiv.querySelector('canvas');
    const link = document.createElement('a');
    link.download = `bakery-loyalty-${displayPhone.textContent}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

// QR Code Scanner
let scannerStream = null;

startScanBtn.addEventListener('click', async function() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        scannerVideo.srcObject = stream;
        scannerStream = stream;
        
        startScanBtn.classList.add('hidden');
        stopScanBtn.classList.remove('hidden');
        scanResult.classList.add('hidden');
        
        // Start scanning loop
        scannerVideo.play();
        requestAnimationFrame(scanQR);
    } catch (err) {
        console.error("Error accessing camera:", err);
        alert("Could not access camera. Please ensure you've granted camera permissions.");
    }
});

stopScanBtn.addEventListener('click', function() {
    if (scannerStream) {
        scannerStream.getTracks().forEach(track => track.stop());
        scannerStream = null;
    }
    
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
});

function scanQR() {
    if (scannerVideo.readyState === scannerVideo.HAVE_ENOUGH_DATA) {
        scannerCanvas.hidden = false;
        scannerCanvas.width = scannerVideo.videoWidth;
        scannerCanvas.height = scannerVideo.videoHeight;
        
        scannerCtx.drawImage(scannerVideo, 0, 0, scannerCanvas.width, scannerCanvas.height);
        const imageData = scannerCtx.getImageData(0, 0, scannerCanvas.width, scannerCanvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
        });
        
        if (code) {
            const phoneNumber = code.data;
            const customer = customers.find(c => c.phone === phoneNumber);
            
            if (customer) {
                stopScanBtn.click();
                displayScanResult(customer);
            } else {
                alert("Customer not found. Please register first.");
            }
        } else {
            requestAnimationFrame(scanQR);
        }
    } else {
        requestAnimationFrame(scanQR);
    }
}

function displayScanResult(customer) {
    scanName.textContent = customer.name;
    scanPhone.textContent = customer.phone;
    scanPoints.textContent = `${customer.points}/10`;
    scanLastVisit.textContent = customer.lastVisit ? new Date(customer.lastVisit).toLocaleString() : 'Never';
    
    scanResult.classList.remove('hidden');
    rewardMessage.classList.add('hidden');
}

// Add Point
addPointBtn.addEventListener('click', function() {
    const phone = scanPhone.textContent;
    const customer = customers.find(c => c.phone === phone);
    
    if (customer) {
        customer.points += 1;
        customer.visits.push(new Date().toISOString());
        customer.lastVisit = new Date().toISOString();
        
        // Check for reward
        if (customer.points >= 10) {
            customer.points = 0;
            rewardMessage.classList.remove('hidden');
        }
        
        saveCustomers();
        displayScanResult(customer);
        
        // Update Google Sheets
        updateGoogleSheets(customer);
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
    
    filteredCustomers.forEach(customer => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${customer.name}</td>
            <td>${customer.phone}</td>
            <td>${customer.points}/10</td>
            <td>${customer.lastVisit ? new Date(customer.lastVisit).toLocaleDateString() : 'Never'}</td>
            <td>
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
            displayCustomerQR(customer);
            document.querySelector('[data-tab="register"]').click();
        });
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this customer?')) {
                const phone = this.getAttribute('data-phone');
                customers = customers.filter(c => c.phone !== phone);
                saveCustomers();
                renderCustomersTable(searchInput.value);
            }
        });
    });
}

// Search Customers
searchInput.addEventListener('input', function() {
    renderCustomersTable(this.value);
});

// Export to Google Sheets
exportDataBtn.addEventListener('click', function() {
    if (customers.length === 0) {
        alert('No customer data to export');
        return;
    }
    
    // Format data for Google Sheets
    const data = customers.map(customer => ({
        name: customer.name,
        phone: customer.phone,
        points: customer.points,
        lastVisit: customer.lastVisit ? new Date(customer.lastVisit).toLocaleString() : 'Never',
        totalVisits: customer.visits.length
    }));
    
    // Google Sheets API would go here
    // For now, we'll just show a message
    alert(`Data for ${customers.length} customers would be exported to Google Sheets.\n\nIn a real implementation, this would connect to your Google Sheet.`);
    
    // This is where you would integrate with the Google Sheets API
    // You would need to use the Google Sheets API JavaScript client
    // and authenticate with your Google account
});

// Helper function to update Google Sheets (simplified)
function updateGoogleSheets(customer) {
    // In a real implementation, this would send data to your Google Sheet
    console.log(`Updating Google Sheets for customer: ${customer.name} (${customer.phone})`);
    
    // Example of what you might do with the Google Sheets API:
    // 1. Authenticate with Google
    // 2. Find the row for this customer (or add a new row)
    // 3. Update the points and last visit date
    // 4. Add a new row to the visit history
    
    // For now, we'll just log it
    console.log({
        name: customer.name,
        phone: customer.phone,
        points: customer.points,
        lastVisit: customer.lastVisit,
        totalVisits: customer.visits.length
    });
}

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
});
