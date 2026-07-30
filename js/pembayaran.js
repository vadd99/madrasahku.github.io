import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    doc,
    query,
    where 
} from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let selectedKelasId = null;
let selectedSantriId = null;

let activeTahun = "2026/2027";
let currentPaymentData = {}; 
let paymentDocId = null; 

const daftarBulan = ["Juli", "Agustus", "September", "Oktober", "November", "Desember", "Januari", "Februari", "Maret", "April", "Mei", "Juni"];

window.closeGuideBox = function() {
    const box = document.getElementById("guide-box-pembayaran");
    if (box) box.style.display = "none";
};

document.addEventListener("layoutReady", function () {
    const selectEl = document.getElementById("select-tahun");
    if (selectEl) {
        activeTahun = selectEl.value;
    }
    renderMainView();
});

window.changeTahunAjaran = function(val) {
    activeTahun = val;
    if (selectedKelasId) loadPembayaranSubMenu(selectedKelasId); 
};

async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadPembayaranSubMenu(selectedKelasId);
    }
}

// 1. LOAD DAFTAR KELAS
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewPembayaran = document.getElementById("view-pembayaran");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");
    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const selectors = document.getElementById("pembayaran-selectors");

    if (!viewPembayaran || !gridContainer) return;

    if (btnBack) btnBack.classList.add("hidden");
    if (pageTitle) pageTitle.innerText = "Rekap Pembayaran";
    if (selectors) selectors.classList.add("hidden");
    
    viewKelas.classList.remove("hidden");
    viewPembayaran.classList.add("hidden");

    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        listKelas = [];
        
        const kelasPromises = querySnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const santriSnap = await getDocs(collection(db, "kelas", docSnap.id, "santri"));
            return {
                id: docSnap.id,
                namaKelas: data.namaKelas || data.nama || "Kelas Tanpa Nama",
                waliKelas: data.waliKelas || "-",
                jumlahSantri: santriSnap.size
            };
        });

        listKelas = await Promise.all(kelasPromises);
        listKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true }));

        if (listKelas.length === 0) {
            emptyState.classList.remove("hidden");
            gridContainer.classList.add("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        gridContainer.classList.remove("hidden");

        let cardsHtml = "";
        listKelas.forEach((kelas) => {
            cardsHtml += `
                <div class="kelas-card-item" onclick="openPembayaranSubMenu('${kelas.id}')">
                    <div class="kelas-icon-wrapper"><i data-lucide="users"></i></div>
                    <div class="kelas-info">
                        <div class="kelas-name">${kelas.namaKelas}</div>
                        <div class="kelas-meta">
                            <span class="meta-badge meta-wali"><i data-lucide="user"></i> Wali: ${kelas.waliKelas}</span>
                            <span class="meta-badge meta-santri"><i data-lucide="user-check"></i> ${kelas.jumlahSantri} Santri</span>
                        </div>
                    </div>
                    <div class="kelas-action"><i data-lucide="chevron-right"></i></div>
                </div>
            `;
        });

        gridContainer.innerHTML = cardsHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error("Gagal mengambil kelas:", error);
    }
}

// 2. SUB-MENU PEMBAYARAN SANTRI
window.openPembayaranSubMenu = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    selectedSantriId = null;
    renderMainView();
};

async function loadPembayaranSubMenu(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewPembayaran = document.getElementById("view-pembayaran");
    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const selectors = document.getElementById("pembayaran-selectors");

    selectors.classList.remove("hidden");
    const selectedKelasData = listKelas.find(k => k.id === kelasId);
    
    btnBack.classList.remove("hidden");
    pageTitle.innerText = `Pembayaran - ${selectedKelasData.namaKelas}`;
    
    viewKelas.classList.add("hidden");
    viewPembayaran.classList.remove("hidden");

    try {
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach((docSnap) => {
            listSantri.push({ id: docSnap.id, ...docSnap.data() });
        });
        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        currentPaymentData = {};
        paymentDocId = null; 

        const q = query(collection(db, "pembayaran_bulanan"), 
                  where("kelasId", "==", kelasId), 
                  where("tahunAjaran", "==", activeTahun));
        
        const paySnap = await getDocs(q);
        
        if (!paySnap.empty) {
            const docData = paySnap.docs[0];
            paymentDocId = docData.id;
            currentPaymentData = docData.data().dataPembayaran || {};
        }

        listSantri.forEach(s => {
            if (!currentPaymentData[s.id]) {
                currentPaymentData[s.id] = [];
            }
        });

        renderSantriPembayaranList();
    } catch (error) {
        console.error("Gagal memuat data pembayaran:", error);
    }
}

function getCurrentMonthTargetIndex() {
    const currentMonth = new Date().getMonth(); 
    const monthMapping = {
        6: 0, 7: 1, 8: 2, 9: 3, 10: 4, 11: 5, 
        0: 6, 1: 7, 2: 8, 3: 9, 4: 10, 5: 11  
    };
    return monthMapping[currentMonth] || 0;
}

function renderSantriPembayaranList() {
    const container = document.getElementById("santri-pembayaran-container");
    if (!container) return;

    const currentTargetIdx = getCurrentMonthTargetIndex();
    let listHtml = "";

    listSantri.forEach((santri, index) => {
        const paidMonths = currentPaymentData[santri.id] || [];
        
        let lastPaidMonth = "";
        let maxIdx = -1;
        paidMonths.forEach(bln => {
            let idx = daftarBulan.indexOf(bln);
            if (idx > maxIdx) {
                maxIdx = idx;
                lastPaidMonth = bln;
            }
        });

        let badgeClass = "";
        let statusLabel = "";
        let infoText = "";

        // Logika Teks Simpel (Tidak Bertumpuk)
        if (maxIdx >= currentTargetIdx) {
            badgeClass = "badge-status-lunas";
            statusLabel = "LUNAS";
            infoText = `<span class="text-success">Lunas s/d bulan ini</span>`;
        } else if (maxIdx >= 0) {
            badgeClass = "badge-status-sebagian";
            statusLabel = "MENUNGGAK";
            let telat = currentTargetIdx - maxIdx;
            infoText = `<span class="text-warning">Terakhir: ${lastPaidMonth} (${telat} bln nunggak)</span>`;
        } else {
            badgeClass = "badge-status-nunggak";
            statusLabel = "BELUM BAYAR";
            let telat = currentTargetIdx + 1; 
            infoText = `<span class="text-danger">Belum bayar sama sekali (${telat} bln nunggak)</span>`;
        }

        listHtml += `
            <div class="absensi-santri-card" onclick="openModalBayar('${santri.id}')">
                <div class="santri-card-left">
                    <div class="number-badge">${index + 1}</div>
                    <div class="santri-info">
                        <div class="santri-name">${santri.nama}</div>
                        <div class="santri-payment-info">${infoText}</div>
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

// 3. MODAL CHECKBOX BULAN
window.openModalBayar = function(santriId) {
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    if (!santri) return;

    document.getElementById("modal-santri-nama").innerText = santri.nama;

    const container = document.getElementById("bulan-checkbox-container");
    const paidMonths = currentPaymentData[santriId] || [];
    
    let gridHtml = "";
    daftarBulan.forEach(bulan => {
        const isChecked = paidMonths.includes(bulan) ? "checked" : "";
        gridHtml += `
            <label class="status-option-card checkbox-mode option-hadir">
                <input type="checkbox" name="bulan-bayar" value="${bulan}" ${isChecked}>
                <div class="status-card-body"><span>${bulan}</span></div>
            </label>
        `;
    });
    
    container.innerHTML = gridHtml;
    document.getElementById("modal-status-bayar").classList.add("active");
};

window.closeModalBayar = function() {
    document.getElementById("modal-status-bayar").classList.remove("active");
};

// 4. SIMPAN LANGSUNG KE FIREBASE DARI DALAM MODAL
window.applySantriPembayaran = async function() {
    if (!selectedSantriId || !selectedKelasId) return;

    const btnSave = document.getElementById('btn-save-modal');
    const originalText = btnSave.innerHTML;
    
    // Ubah tombol jadi loading
    btnSave.innerHTML = `<i data-lucide="loader-2" class="animate-spin" style="margin-right: 8px;"></i>Menyimpan...`;
    btnSave.disabled = true;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Ambil data checkbox
    const checkboxes = document.querySelectorAll('input[name="bulan-bayar"]:checked');
    let selectedMonths = [];
    checkboxes.forEach(cb => selectedMonths.push(cb.value));

    // Update state lokal
    currentPaymentData[selectedSantriId] = selectedMonths;

    // Siapkan Payload Firebase
    const payload = {
        kelasId: selectedKelasId,
        tahunAjaran: activeTahun,
        dataPembayaran: currentPaymentData,
        updatedAt: new Date()
    };

    try {
        if (paymentDocId) {
            const docRef = doc(db, "pembayaran_bulanan", paymentDocId);
            await updateDoc(docRef, payload);
        } else {
            const docRef = await addDoc(collection(db, "pembayaran_bulanan"), payload);
            paymentDocId = docRef.id; // Simpan ID agar editan berikutnya cukup Update
        }
        
        closeModalBayar();
        renderSantriPembayaranList(); // Re-render tampilan list 
        showSuccessModal(`Data pembayaran ${listSantri.find(s => s.id === selectedSantriId).nama} berhasil diperbarui.`);
    } catch (error) {
        console.error("Gagal menyimpan pembayaran:", error);
        alert("Gagal menyimpan data pembayaran. Periksa koneksi internet.");
    } finally {
        // Kembalikan status tombol seperti semula
        btnSave.innerHTML = originalText;
        btnSave.disabled = false;
    }
};

/* --- FUNGSI CUSTOM ALERT --- */
window.showSuccessModal = function(msg) {
    document.getElementById("success-message").innerText = msg;
    document.getElementById("modal-success-alert").classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeSuccessModal = function() {
    document.getElementById("modal-success-alert").classList.remove("active");
};
