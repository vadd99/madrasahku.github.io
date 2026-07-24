import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc 
} from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let selectedKelasId = null;
let selectedSantriId = null;

let activeImtihan = "Imtihan 1";
let todayAttendance = {}; 
let rekapAttendance = {}; 

// Variabel untuk melacak apakah hari ini sudah ada data absensi di database
let todayAbsensiDocId = null; 

// --- PENANGANAN INISIALISASI AMAN ---
function initAbsensiView() {
    if (document.getElementById("view-absensi")) {
        const selectEl = document.getElementById("select-imtihan");
        if (selectEl) {
            activeImtihan = selectEl.value;
        }
        renderMainView();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAbsensiView);
} else {
    initAbsensiView();
}

document.addEventListener("layoutReady", function () {
    initAbsensiView();
});

// Format Tanggal untuk ID Database (YYYY-MM-DD)
function getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Format Tanggal untuk Tampilan di Layar (Contoh: Rabu, 24 Juli 2026)
function getTodayFormatted() {
    const today = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return today.toLocaleDateString('id-ID', options);
}

// Pindah Periode Imtihan
window.changeImtihanPeriod = function(val) {
    activeImtihan = val;
    if (selectedKelasId) {
        // Muat ulang data absensi untuk menampilkan rekap imtihan yang baru dipilih
        loadAbsensiSubMenu(selectedKelasId); 
    }
};

async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadAbsensiSubMenu(selectedKelasId);
    }
}

/* ===================================================
   1. LOAD DAFTAR KELAS (DARI DATABASE)
   =================================================== */
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    if (!viewAbsensi || !gridContainer) return;

    if (btnBack) btnBack.classList.add("hidden");
    if (pageTitle) pageTitle.innerText = "Absensi Santri";
    if (pageSubtitle) pageSubtitle.innerText = "Pilih kelas untuk mengelola kehadiran santri harian.";

    if (viewKelas) viewKelas.classList.remove("hidden");
    if (viewAbsensi) viewAbsensi.classList.add("hidden");

    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        listKelas = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            listKelas.push({
                id: docSnap.id,
                namaKelas: data.namaKelas || data.nama || "Kelas Tanpa Nama",
                waliKelas: data.waliKelas || "-"
            });
        });

        // Urutkan kelas secara berurutan
        listKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true }));

        if (listKelas.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            if (gridContainer) gridContainer.classList.add("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        if (gridContainer) gridContainer.classList.remove("hidden");

        let cardsHtml = "";
        listKelas.forEach((kelas) => {
            cardsHtml += `
                <div class="kelas-card-item" onclick="openAbsensiSubMenu('${kelas.id}')">
                    <div class="kelas-info">
                        <div class="kelas-name">${kelas.namaKelas}</div>
                        <div class="kelas-count">Wali: ${kelas.waliKelas}</div>
                    </div>
                    <i data-lucide="chevron-right" class="chevron-icon"></i>
                </div>
            `;
        });

        gridContainer.innerHTML = cardsHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error("Gagal mengambil data kelas absensi:", error);
    }
}

/* ===================================================
   2. SUB-MENU ABSENSI SANTRI PER KELAS
   =================================================== */
window.openAbsensiSubMenu = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    selectedSantriId = null;
    renderMainView();
};

async function loadAbsensiSubMenu(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    if (!viewAbsensi) return;

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };

    if (btnBack) btnBack.classList.remove("hidden");
    if (pageTitle) pageTitle.innerText = `Absensi - ${selectedKelasData.namaKelas}`;
    if (pageSubtitle) pageSubtitle.innerText = `Daftar presensi santri untuk ${selectedKelasData.namaKelas}.`;

    const elDate = document.getElementById("today-date-text");
    if (elDate) elDate.innerText = getTodayFormatted();

    if (viewKelas) viewKelas.classList.add("hidden");
    if (viewAbsensi) viewAbsensi.classList.remove("hidden");

    try {
        // A. Ambil Daftar Santri di Kelas Ini
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach((docSnap) => {
            listSantri.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        // B. Hitung Rekap Kehadiran Santri pada Imtihan Aktif
        rekapAttendance = {};
        listSantri.forEach(s => {
            rekapAttendance[s.id] = { izin: 0, sakit: 0, alpa: 0 };
        });

        // C. Ambil semua absensi dari Database menggunakan fungsi standar getDocs
        const absensiSnap = await getDocs(collection(db, "absensi"));
        
        const todayISO = getTodayISO();
        todayAttendance = {};
        todayAbsensiDocId = null; // Reset ID dokumen setiap memuat kelas

        absensiSnap.forEach(docSnap => {
            const data = docSnap.data();
            
            // Cek apakah data ini untuk kelas yang sedang dibuka
            if (data.kelasId === kelasId) {
                
                // 1. Tambahkan ke perhitungan Rekap jika Imtihan sesuai pilihan
                if (data.imtihan === activeImtihan) {
                    const kehadiranData = data.kehadiran || {};
                    Object.keys(kehadiranData).forEach(sId => {
                        if (rekapAttendance[sId]) {
                            const st = kehadiranData[sId];
                            if (st === "izin") rekapAttendance[sId].izin++;
                            else if (st === "sakit") rekapAttendance[sId].sakit++;
                            else if (st === "alpa") rekapAttendance[sId].alpa++;
                        }
                    });
                }

                // 2. Cek apakah dokumen ini adalah absensi HARI INI
                if (data.tanggal === todayISO) {
                    todayAbsensiDocId = docSnap.id; // Menyimpan ID dokumen agar bisa di-Update nanti
                    todayAttendance = data.kehadiran || {};
                }
            }
        });

        // D. Isi default status 'hadir' untuk santri yang belum diabsen sama sekali hari ini
        listSantri.forEach(s => {
            if (!todayAttendance[s.id]) {
                todayAttendance[s.id] = "hadir";
            }
        });

        // E. Render List Santri
        renderSantriAbsensiList();

    } catch (error) {
        console.error("Gagal memuat data absensi:", error);
    }
}

function renderSantriAbsensiList() {
    const container = document.getElementById("santri-absensi-container");
    if (!container) return;

    if (listSantri.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Belum ada data santri di kelas ini.</p></div>`;
        return;
    }

    let listHtml = "";
    listSantri.forEach((santri, index) => {
        const currentStatus = todayAttendance[santri.id] || "hadir";
        const rekap = rekapAttendance[santri.id] || { izin: 0, sakit: 0, alpa: 0 };

        let badgeClass = "badge-status-hadir";
        let statusLabel = "HADIR";

        if (currentStatus === "izin") { badgeClass = "badge-status-izin"; statusLabel = "IZIN"; }
        else if (currentStatus === "sakit") { badgeClass = "badge-status-sakit"; statusLabel = "SAKIT"; }
        else if (currentStatus === "alpa") { badgeClass = "badge-status-alpa"; statusLabel = "ALPA"; }

        listHtml += `
            <div class="absensi-santri-card" onclick="openModalStatus('${santri.id}')">
                <div class="santri-card-left">
                    <div class="number-badge">${index + 1}</div>
                    <div class="santri-info">
                        <div class="santri-name">${santri.nama}</div>
                        <div class="santri-rekap-counters">
                            <span class="rekap-pill rekap-izin">Izin: <b>${rekap.izin}</b></span>
                            <span class="rekap-pill rekap-sakit">Sakit: <b>${rekap.sakit}</b></span>
                            <span class="rekap-pill rekap-alpa">Alpa: <b>${rekap.alpa}</b></span>
                        </div>
                    </div>
                </div>

                <div class="santri-card-right">
                    <span class="badge-status ${badgeClass}">${statusLabel}</span>
                    <i data-lucide="chevron-right" class="chevron-icon"></i>
                </div>
            </div>
        `;
    });

    container.innerHTML = listHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ===================================================
   3. MODAL EDIT STATUS KEHADIRAN (KLIK NAMA SANTRI)
   =================================================== */
window.openModalStatus = function(santriId) {
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    if (!santri) return;

    const elName = document.getElementById("modal-santri-nama");
    const elDate = document.getElementById("modal-tanggal-text");
    if (elName) elName.innerText = santri.nama;
    if (elDate) elDate.innerText = getTodayFormatted();

    // Centang otomatis radio button sesuai dengan status kehadiran saat ini
    const currentStatus = todayAttendance[santriId] || "hadir";
    const radios = document.getElementsByName("status-kehadiran");
    for (let r of radios) {
        r.checked = (r.value === currentStatus);
    }

    const modal = document.getElementById("modal-status-absensi");
    if (modal) modal.classList.add("active");
};

window.closeModalStatus = function() {
    const modal = document.getElementById("modal-status-absensi");
    if (modal) modal.classList.remove("active");
};

// Menerapkan perubahan status dari Modal
window.applySantriStatusChange = function() {
    if (!selectedSantriId) return;

    // Ambil nilai dari radio button yang dipilih
    let chosenStatus = "hadir";
    const checkedRadio = document.querySelector('input[name="status-kehadiran"]:checked');
    if (checkedRadio) {
        chosenStatus = checkedRadio.value;
    }

    // Update penyimpanan sementara
    todayAttendance[selectedSantriId] = chosenStatus;
    
    closeModalStatus();
    
    // Render ulang list agar badge status berubah (dari Hadir -> Izin dsb)
    renderSantriAbsensiList();
};

/* ===================================================
   4. SIMPAN ABSENSI HARI INI KE FIREBASE (TANPA setDoc)
   =================================================== */
window.saveTodayAbsensi = async function() {
    if (!selectedKelasId) return;

    const payload = {
        kelasId: selectedKelasId,
        tanggal: getTodayISO(),
        imtihan: activeImtihan,
        kehadiran: todayAttendance,
        updatedAt: new Date()
    };

    try {
        const btnSave = document.querySelector('.btn-save-absensi');
        const originalText = btnSave.innerHTML;
        
        // Ubah teks tombol jadi loading
        btnSave.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>Menyimpan...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // LOGIKA PENYIMPANAN AMAN (Menggantikan setDoc)
        if (todayAbsensiDocId) {
            // Jika dokumen absensi untuk hari ini sudah ada, kita Update isinya
            const absensiDocRef = doc(db, "absensi", todayAbsensiDocId);
            await updateDoc(absensiDocRef, payload);
        } else {
            // Jika belum ada absensi untuk hari ini, kita Tambahkan dokumen baru
            await addDoc(collection(db, "absensi"), payload);
        }
        
        // Kembalikan tombol seperti semula
        btnSave.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        alert(`Data absensi tanggal ${getTodayFormatted()} berhasil disimpan ke database!`);
        
        // Load ulang agar rekap otomatis ter-update di layar
        await loadAbsensiSubMenu(selectedKelasId);
    } catch (error) {
        console.error("Gagal menyimpan absensi:", error);
        alert("Gagal menyimpan data absensi. Periksa koneksi internet.");
    }
};
