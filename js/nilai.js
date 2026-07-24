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
const romanNumerals = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

function initRekapView() {
    if (document.getElementById("view-absensi")) {
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

window.changeImtihanPeriod = function(val) {
    activeImtihan = val;
    if (selectedKelasId) loadNilaiSubMenu(selectedKelasId); 
};

window.changeMapel = function(val) {
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
            selectMapel.innerHTML = options;
            if(activeMapel) selectMapel.value = activeMapel;
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

async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const btnBack = document.getElementById("btn-back-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");
    const emptyState = document.getElementById("empty-state-kelas");
    
    if (btnBack) btnBack.classList.add("hidden");
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
    } catch (error) { console.error(error); }
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

async function loadNilaiSubMenu(kelasId) {
    document.getElementById("view-kelas").classList.add("hidden");
    document.getElementById("view-absensi").classList.remove("hidden");
    document.getElementById("btn-back-kelas").classList.remove("hidden");

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };
    document.getElementById("page-title").innerText = `Rekap Nilai - ${selectedKelasData.namaKelas}`;

    try {
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach((docSnap) => {
            listSantri.push({ id: docSnap.id, ...docSnap.data() });
        });

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
        const countUh = Object.keys(nilaiSantri).filter(k => nilaiSantri[k] !== "").length;
        
        let badgeClass = countUh > 0 ? "badge-status-hadir" : "badge-status-empty";
        let statusLabel = countUh > 0 ? `${countUh} Nilai Terisi` : "BELUM ADA NILAI";

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
                    <span class="badge-status ${badgeClass}">${statusLabel}</span>
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
    
    if(Object.keys(activeUhData).length === 0) {
        activeUhData["UH I"] = "";
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
    
    Object.keys(activeUhData).forEach((uhKey) => {
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
    const currentCount = Object.keys(activeUhData).length;
    const nextRoman = romanNumerals[currentCount] || (currentCount + 1);
    activeUhData[`UH ${nextRoman}`] = "";
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
        
        if (todayNilaiDocId) {
            await updateDoc(doc(db, "rekap_nilai", todayNilaiDocId), payload);
        } else {
            const docRef = await addDoc(collection(db, "rekap_nilai"), payload);
            todayNilaiDocId = docRef.id;
        }
        
        btnSave.innerHTML = originalText;
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
