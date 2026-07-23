// Memuat File Layout Tunggal (Header & Sidebar) Secara Otomatis
document.addEventListener("DOMContentLoaded", function () {
    const layoutWrapper = document.getElementById("layout-wrapper");
    const pageContentTemplate = document.getElementById("page-content");

    if (!layoutWrapper) return;

    // Fetch file layout.html dari root
    fetch("layout.html")
        .then(response => {
            if (!response.ok) {
                throw new Error("Gagal memuat komponen layout");
            }
            return response.text();
        })
        .then(layoutHtml => {
            // Pasang layout utama
            layoutWrapper.innerHTML = layoutHtml;

            // Masukkan isi konten halaman dari tag <template id="page-content">
            const targetContainer = document.getElementById("main-content-target");
            if (targetContainer && pageContentTemplate) {
                targetContainer.appendChild(pageContentTemplate.content.cloneNode(true));
            }

            // Inisialisasi Fitur Utama
            initTheme();
            highlightActiveMenu();
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }

            // Beritahu script halaman (index.js/guru.js) bahwa Layout sudah siap!
            document.dispatchEvent(new Event("layoutReady"));
        })
        .catch(err => {
            console.error("Error Layout Loader:", err);
        });
});

// Otomatis tandai menu sidebar aktif sesuai nama file HTML
function highlightActiveMenu() {
    let currentPath = window.location.pathname.split("/").pop();
    if (!currentPath || currentPath === "") currentPath = "index.html";

    const navItems = document.querySelectorAll(".nav-item");
    navItems.forEach(item => {
        const itemPath = item.getAttribute("data-path");
        if (itemPath === currentPath) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });
}

// Toggle Sidebar Mobile
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
    }
}

// Inisialisasi Tema dari LocalStorage
function initTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');
    const savedTheme = localStorage.getItem('theme') || 'dark';

    if (savedTheme === 'dark') {
        body.classList.add('dark');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    } else {
        body.classList.remove('dark');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    }
}

// Handler Switch Tema Terang / Gelap
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById('theme-icon');

    if (body.classList.contains('dark')) {
        body.classList.remove('dark');
        localStorage.setItem('theme', 'light');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'moon');
    } else {
        body.classList.add('dark');
        localStorage.setItem('theme', 'dark');
        if (themeIcon) themeIcon.setAttribute('data-lucide', 'sun');
    }
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Modal Logout Functions
function handleLogout() {
    const modal = document.getElementById('notification-modal');
    if (modal) modal.classList.add('active');
}

function closeLogoutModal() {
    const modal = document.getElementById('notification-modal');
    if (modal) modal.classList.remove('active');
}

function confirmLogout() {
    closeLogoutModal();
    // Tambahkan aksi hapus session / redirect login di sini
}
