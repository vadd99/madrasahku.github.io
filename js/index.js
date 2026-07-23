// Menunggu sampai Layout selesai dimuat oleh main.js
document.addEventListener("layoutReady", function () {
    console.log("Halaman Dashboard Siap!");
    
    // Nanti logika fetch data ke Flask/API ditempatkan di sini
    // Contoh: loadDashboardStats();
});
