import { db, collection, getDocs, addDoc, updateDoc, doc, query, where } from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let listMapel = [];
let selectedKelasId = null;
let selectedSantriId = null;
let activeImtihan = "Imtihan 1";
let activeMapel = "";

let todayNilai = {}; 
let initialNilai = {}; 
let todayNilaiDocId = null; 

let activeUhData = {};

// Fungsi untuk mengambil angka dari string "UH X" (mendukung angka biasa & romawi lama)
function getUhNumber(key) {
    const val = key.replace("UH ", "").trim();
    const romanMap = { "I":1, "II":2, "III":3, "IV":4, "V":5, "VI":6, "VII":7, "VIII":8, "IX":9, "X":10 };
    if (romanMap[val]) return romanMap[val];
    return parseInt(val) || 0;
}

// --- FUNGSI UNTUK MENUTUP PANDUAN ---
window.closeGuideBox = function() {
    const box = document.getElementById("guide-box-nilai");
    if (box) {
        box.style.display = "none";
    }
};

// --- METODE INISIALISASI YANG ANTI GAGAL ---
let isInitialized = false;

function initRekapView() {
    if (isInitialized) return;
    
    const viewAbsensi = document.getElementById("view-absensi");
    if (viewAbsensi) {
        isInitialized = true;
        const selectImtihan = document.getElementById("select-imtihan");
        if (selectImtihan) activeImtihan = selectImtihan.value;
        loadMapelFromFirebase();
        renderMainView();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRekapView);
} else {
    initRekapView();
}
document.addEventListener("layoutReady", initRekapView);

const observer = new MutationObserver(() => {
    if (document.getElementById("view-absensi") && !isInitialized) {
        initRekapView();
        observer.disconnect(); 
    }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.changeImtihanPeriod = function(val) {
    activeImtihan = val;
    if (selectedKelasId) loadNilaiSubMenu(selectedKelasId); 
};

window.changeMapel = function(val) {
    // PERBAIKAN: Jika yang dipilih adalah opsi "Tambah Mapel Baru"
    if (val === "ADD_NEW_MAPEL") {
        openModalTambahMapel();
        // Kembalikan kotak pilihan ke mapel sebelumnya agar opsi "Tambah" tidak menempel
        document.getElementById("select-mapel").value = activeMapel || "";
        return;
    }
    
    activeMapel = val;
    if (selectedKelasId) loadNilaiSubMenu(selectedKelasId);
};

async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadNilaiSubMenu(selectedKelasId);
    }
}

async function loadMapelFromFirebase() {
    try {
        const mapelSnap = await getDocs(collection(db, "mapel"));
        listMapel = [];
        mapelSnap.forEach(doc => {
            listMapel.push({ id: doc.id, ...doc.data() });
        });
        
        const selectMapel = document.getElementById("select-mapel");
        if(selectMapel) {
            let options = '<option value="">-- Pilih Mapel --</option>';
            listMapel.forEach(m => {
                options += `<option value="${m.nama}">${m.nama}</option>`;
            });
            
            // PERBAIKAN: Menambahkan opsi Tambah Mapel di dalam dropdown
            options += `<option value="ADD_NEW_MAPEL" style="font-weight:bold; color:#10b981;">+ Tambah Mapel Baru...</option>`;
            
            selectMapel.innerHTML = options;
            if(activeMapel && activeMapel !== "ADD_NEW_MAPEL") selectMapel.value = activeMapel;
        }
    } catch(e) { console.error("Gagal meload daftar mapel", e); }
}

window.openModalTambahMapel = function() {
    document.getElementById("modal-tambah-mapel").classList.add("active");
}
window.closeModalTambahMapel = function() {
    document.getElementById("modal-tambah-mapel").classList.remove("active");
}

window.simpanMapelBaru = async function() {
    const input = document.getElementById("input-nama-mapel").value;
    if(!input) return;
    try {
        await addDoc(collection(db, "mapel"), { nama: input, createdAt: new Date() });
        closeModalTambahMapel();
        await loadMapelFromFirebase();
        
        document.getElementById("select-mapel").value = input;
        activeMapel = input;
        document.getElementById("input-nama-mapel").value = "";
        
        if(selectedKelasId) loadNilaiSubMenu(selectedKelasId);
    } catch(e) { 
        alert("Gagal menyimpan mapel baru."); 
    }
}

/* ===================================================
   LOAD DAFTAR KELAS
   =================================================== */
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");
    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    
    const selectorsContainer = document.getElementById("nilai-selectors");
    if (selectorsContainer) selectorsContainer.classList.add("hidden");

    if (!viewAbsensi || !gridContainer) return;

    if (btnBack) btnBack.classList.add("hidden");
    if (pageTitle) pageTitle.innerText = "Rekap Nilai Santri";
    if (pageSubtitle) pageSubtitle.innerText = "Pilih kelas untuk mengelola nilai harian santri.";
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
                <div class="kelas-card-item" onclick="openNilaiSubMenu('${kelas.id}')">
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
        console.error("Gagal mengambil data kelas nilai:", error); 
    }
}

window.openNilaiSubMenu = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    selectedSantriId = null;
    renderMainView();
};

/* ===================================================
   LOAD DAFTAR SANTRI (SUBMENU)
   =================================================== */
async function loadNilaiSubMenu(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const btnBack = document.getElementById("btn-back-kelas");

    const selectorsContainer = document.getElementById("nilai-selectors");
    if (selectorsContainer) selectorsContainer.classList.remove("hidden");

    if (!viewAbsensi) return;

    if (viewKelas) viewKelas.classList.add("hidden");
    if (viewAbsensi) viewAbsensi.classList.remove("hidden");
    if (btnBack) btnBack.classList.remove("hidden");

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };
    document.getElementById("page-title").innerText = `Rekap Nilai - ${selectedKelasData.namaKelas}`;
    
    // PERBAIKAN: Ubah subjudul saat di dalam kelas
    const pageSubtitle = document.getElementById("page-subtitle");
    if (pageSubtitle) pageSubtitle.innerText = "Pilih mapel, lalu klik nama santri untuk menginput nilai.";

    try {
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach((docSnap) => {
            listSantri.push({ id: docSnap.id, ...docSnap.data() });
        });
        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        todayNilai = {};
        todayNilaiDocId = null;
        
        if (activeMapel) {
            const q = query(collection(db, "rekap_nilai"), 
                where("kelasId", "==", kelasId),
                where("imtihan", "==", activeImtihan),
                where("mapel", "==", activeMapel)
            );
            const nilaiSnap = await getDocs(q);
            
            nilaiSnap.forEach(docSnap => {
                todayNilaiDocId = docSnap.id;
                todayNilai = docSnap.data().dataNilai || {};
            });
        }

        initialNilai = JSON.parse(JSON.stringify(todayNilai));
        checkUnsavedChanges(); 
        renderSantriNilaiList();
    } catch (error) { console.error(error); }
}

function checkUnsavedChanges() {
    const btnSave = document.getElementById("btn-save-absensi");
    if (!btnSave) return;
    
    const isChanged = JSON.stringify(todayNilai) !== JSON.stringify(initialNilai);
    if (isChanged && activeMapel) {
        btnSave.removeAttribute("disabled");
    } else {
        btnSave.setAttribute("disabled", "true");
    }
}

function renderSantriNilaiList() {
    const container = document.getElementById("santri-absensi-container");
    if (!container) return;

    if (listSantri.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Belum ada data santri di kelas ini.</p></div>`;
        return;
    }

    let listHtml = "";
    listSantri.forEach((santri, index) => {
        const nilaiSantri = todayNilai[santri.id] || {};
        
        let keysTerisi = Object.keys(nilaiSantri).filter(k => nilaiSantri[k] !== "" && nilaiSantri[k] !== null && nilaiSantri[k] !== undefined);
        
        // Mengurutkan keys menggunakan helper getUhNumber
        keysTerisi.sort((a, b) => getUhNumber(a) - getUhNumber(b));

        const hasNilai = keysTerisi.length > 0;
        let rightContent = "";

        if (hasNilai) {
            let rincianList = keysTerisi.map(k => `<span class="nilai-mini-badge"><b>${k}</b>: ${nilaiSantri[k]}</span>`);
            rightContent = `<div class="nilai-badge-container">${rincianList.join("")}</div>`;
        } else {
            rightContent = `<span class="badge-status badge-status-empty" style="font-size: 0.7rem; font-weight: normal; text-transform: none;">BELUM ADA NILAI</span>`;
        }

        listHtml += `
            <div class="absensi-santri-card" onclick="openModalNilai('${santri.id}')">
                <div class="santri-card-left">
                    <div class="number-badge">${index + 1}</div>
                    <div class="santri-info">
                        <div class="santri-name">${santri.nama}</div>
                        <div class="santri-rekap-counters">
                            <span class="rekap-pill">Mapel: <b>${activeMapel || "-"}</b></span>
                        </div>
                    </div>
                </div>
                <div class="santri-card-right">
                    ${rightContent}
                    <i data-lucide="edit-3" class="chevron-icon"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = listHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.openModalNilai = function(santriId) {
    if(!activeMapel) {
        alert("Silakan pilih Mapel terlebih dahulu atau tambahkan Mapel baru.");
        return;
    }
    
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    
    document.getElementById("modal-santri-nama-nilai").innerText = santri.nama;
    document.getElementById("modal-mapel-text").innerText = activeMapel;

    activeUhData = todayNilai[santriId] ? { ...todayNilai[santriId] } : {};
    
    // Default nilai menggunakan angka biasa
    if(Object.keys(activeUhData).length === 0) {
        activeUhData["UH 1"] = "";
    }
    
    renderUhInputs();
    document.getElementById("modal-input-nilai").classList.add("active");
};

window.closeModalNilai = function() {
    document.getElementById("modal-input-nilai").classList.remove("active");
};

function renderUhInputs() {
    const container = document.getElementById("uh-inputs-container");
    container.innerHTML = "";
    
    // Mengurutkan inputan di dalam modal
    const sortedKeys = Object.keys(activeUhData).sort((a, b) => getUhNumber(a) - getUhNumber(b));
    
    sortedKeys.forEach((uhKey) => {
        container.innerHTML += `
            <div class="uh-input-row" style="display:flex; gap:10px; margin-bottom:12px; align-items:center;">
                <label style="width:55px; font-weight:700; color:var(--text-main); font-size: 0.9rem;">${uhKey}</label>
                <input type="number" id="input-${uhKey.replace(/\s+/g, '-')}" value="${activeUhData[uhKey]}" class="form-input-sm" style="flex:1; padding:10px;" placeholder="Masukkan Nilai...">
                <button class="btn-cancel" style="padding:10px; border:none; border-radius:6px; background:rgba(239, 68, 68, 0.15); color:#ef4444; cursor:pointer;" onclick="deleteUh('${uhKey}')">
                    <i data-lucide="trash-2" style="width:18px;"></i>
                </button>
            </div>
        `;
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function saveDOMtoActiveUh() {
    Object.keys(activeUhData).forEach(key => {
        const el = document.getElementById(`input-${key.replace(/\s+/g, '-')}`);
        if(el) activeUhData[key] = el.value;
    });
}

window.addUhInput = function() {
    saveDOMtoActiveUh();
    
    // Mencari angka terbesar, lalu ditambah 1
    let maxNum = 0;
    Object.keys(activeUhData).forEach(key => {
        const num = getUhNumber(key);
        if (num > maxNum) maxNum = num;
    });
    
    activeUhData[`UH ${maxNum + 1}`] = "";
    renderUhInputs();
};

window.deleteUh = function(key) {
    saveDOMtoActiveUh();
    delete activeUhData[key];
    renderUhInputs();
};

window.simpanNilaiSantriModal = function() {
    saveDOMtoActiveUh();
    todayNilai[selectedSantriId] = activeUhData;
    
    closeModalNilai();
    renderSantriNilaiList(); 
    checkUnsavedChanges(); 
};

window.saveAllNilai = async function() {
    if (!selectedKelasId || !activeMapel) return;

    const payload = {
        kelasId: selectedKelasId,
        imtihan: activeImtihan,
        mapel: activeMapel,
        dataNilai: todayNilai,
        updatedAt: new Date()
    };

    try {
        const btnSave = document.getElementById('btn-save-absensi');
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i><span>Menyimpan...</span>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        if (todayNilaiDocId) {
            await updateDoc(doc(db, "rekap_nilai", todayNilaiDocId), payload);
        } else {
            const docRef = await addDoc(collection(db, "rekap_nilai"), payload);
            todayNilaiDocId = docRef.id;
        }
        
        btnSave.innerHTML = originalText;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        initialNilai = JSON.parse(JSON.stringify(todayNilai));
        checkUnsavedChanges();
        
        document.getElementById("success-message").innerText = `Rekap nilai mapel ${activeMapel} berhasil disimpan ke database.`;
        document.getElementById("modal-success-alert").classList.add("active");
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error(error);
        alert("Gagal menyimpan data nilai ke Firebase.");
    }
};

window.closeSuccessModal = function() {
    document.getElementById("modal-success-alert").classList.remove("active");
};
