import { db, collection, getDocs, doc, query, where, setDoc } from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let listMapel = [];
let activePeriode = "Imtihan 1";
let selectedKelasId = null;
let selectedSantriId = null;

// Data Master untuk kalkulasi
// masterData[santriId] = { mapelName: { totalUH, countUH, avgUH, imtihanScore, finalScore } }
let masterData = {}; 

window.closeGuideBoxImtihan = function() {
    const box = document.getElementById("guide-box-imtihan");
    if (box) box.style.display = "none";
};

let isInitialized = false;
function initImtihanView() {
    if (isInitialized) return;
    const viewSantri = document.getElementById("view-santri");
    if (viewSantri) {
        isInitialized = true;
        const selectPeriode = document.getElementById("select-periode-imtihan");
        if (selectPeriode) activePeriode = selectPeriode.value;
        renderMainView();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initImtihanView);
} else {
    initImtihanView();
}
document.addEventListener("layoutReady", initImtihanView);

window.changePeriode = function(val) {
    activePeriode = val;
    if (selectedKelasId) loadSantriImtihanList(selectedKelasId); 
};

async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadSantriImtihanList(selectedKelasId);
    }
}

/* ==========================================
   1. LOAD KELAS (Sama seperti rekap nilai)
   ========================================== */
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewSantri = document.getElementById("view-santri");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");
    const btnBack = document.getElementById("btn-back-kelas");

    if (!viewSantri || !gridContainer) return;

    if (btnBack) btnBack.classList.add("hidden");
    if (viewKelas) viewKelas.classList.remove("hidden");
    if (viewSantri) viewSantri.classList.add("hidden");
    document.getElementById("page-title").innerText = "Rekap Nilai Imtihan";
    document.getElementById("page-subtitle").innerText = "Pilih kelas untuk melihat rekapitulasi nilai akhir santri.";

    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        listKelas = [];
        
        const kelasPromises = querySnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const kelasId = docSnap.id;
            let jumlahSantri = 0;
            try {
                const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
                jumlahSantri = santriSnap.size;
            } catch (e) {}
            return { id: kelasId, namaKelas: data.namaKelas || data.nama, waliKelas: data.waliKelas || "-", jumlahSantri: jumlahSantri };
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
                <div class="kelas-card-item" onclick="openKelasImtihan('${kelas.id}')">
                    <div class="kelas-icon-wrapper imtihan-icon"><i data-lucide="award"></i></div>
                    <div class="kelas-info">
                        <div class="kelas-name">${kelas.namaKelas}</div>
                        <div class="kelas-meta">
                            <span class="meta-badge meta-wali"><i data-lucide="user"></i> ${kelas.waliKelas}</span>
                            <span class="meta-badge meta-santri"><i data-lucide="users"></i> ${kelas.jumlahSantri} Santri</span>
                        </div>
                    </div>
                    <div class="kelas-action"><i data-lucide="chevron-right"></i></div>
                </div>`;
        });
        gridContainer.innerHTML = cardsHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) { console.error("Error load kelas:", error); }
}

window.openKelasImtihan = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    renderMainView();
};

/* ==========================================
   2. LOAD DATA SANTRI & KALKULASI NILAI
   ========================================== */
async function loadSantriImtihanList(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewSantri = document.getElementById("view-santri");
    const btnBack = document.getElementById("btn-back-kelas");

    if (viewKelas) viewKelas.classList.add("hidden");
    if (viewSantri) viewSantri.classList.remove("hidden");
    if (btnBack) btnBack.classList.remove("hidden");

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };
    document.getElementById("page-title").innerText = `Imtihan - ${selectedKelasData.namaKelas}`;
    document.getElementById("page-subtitle").innerText = "Klik nama santri untuk input/lihat nilai tiap mapel.";

    const container = document.getElementById("santri-imtihan-container");
    container.innerHTML = `<div class="empty-state"><i data-lucide="loader-2" class="animate-spin"></i><p>Memuat dan menghitung data nilai...</p></div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    try {
        // 1. Ambil data Santri
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach(d => listSantri.push({ id: d.id, ...d.data() }));
        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        // 2. Ambil data Mapel
        const mapelSnap = await getDocs(collection(db, "mapel"));
        listMapel = [];
        mapelSnap.forEach(d => listMapel.push(d.data().nama));

        // 3. Ambil data Nilai UH (rekap_nilai) periode ini
        const qUH = query(collection(db, "rekap_nilai"), where("kelasId", "==", kelasId), where("imtihan", "==", activePeriode));
        const snapUH = await getDocs(qUH);
        let rawUH = []; // { mapel, dataNilai: { santriId: { UH1: 80, UH2: 90 } } }
        snapUH.forEach(d => rawUH.push(d.data()));

        // 4. Ambil data Nilai Imtihan (rekap_imtihan) periode ini
        // Asumsi struktur docId: kelasId_periode_santriId
        const qImtihan = query(collection(db, "rekap_imtihan"), where("kelasId", "==", kelasId), where("imtihan", "==", activePeriode));
        const snapImtihan = await getDocs(qImtihan);
        let rawImtihan = {}; // rawImtihan[santriId] = { mapelA: 90, mapelB: 85 }
        snapImtihan.forEach(d => {
            const data = d.data();
            rawImtihan[data.santriId] = data.nilaiMapel || {};
        });

        // 5. Olah data ke masterData
        masterData = {};
        listSantri.forEach(santri => {
            masterData[santri.id] = { mapel: {}, overallFinal: 0 };
            let sumFinalAllMapel = 0;
            let countMapelTested = 0;

            listMapel.forEach(mapelName => {
                // Hitung Rata-rata UH
                let uhData = null;
                const mapelDoc = rawUH.find(r => r.mapel === mapelName);
                if (mapelDoc && mapelDoc.dataNilai) {
                    uhData = mapelDoc.dataNilai[santri.id];
                }
                
                let sumUH = 0, countUH = 0, avgUH = 0;
                if (uhData) {
                    Object.values(uhData).forEach(val => {
                        let num = parseFloat(val);
                        if (!isNaN(num)) { sumUH += num; countUH++; }
                    });
                    if (countUH > 0) avgUH = sumUH / countUH;
                }

                // Ambil Nilai Imtihan
                let imtihanScore = 0;
                if (rawImtihan[santri.id] && rawImtihan[santri.id][mapelName]) {
                    imtihanScore = parseFloat(rawImtihan[santri.id][mapelName]);
                }

                // Kalkulasi Nilai Akhir Mapel: (Rata UH + Imtihan) / 2
                // Jika tidak ada UH tapi ada Imtihan, nilai akhir = imtihan
                let finalScore = 0;
                if (countUH > 0 && imtihanScore > 0) finalScore = (avgUH + imtihanScore) / 2;
                else if (countUH > 0) finalScore = avgUH / 2;
                else if (imtihanScore > 0) finalScore = imtihanScore / 2;

                if (countUH > 0 || imtihanScore > 0) {
                    sumFinalAllMapel += finalScore;
                    countMapelTested++;
                }

                masterData[santri.id].mapel[mapelName] = {
                    totalUH: sumUH,
                    countUH: countUH,
                    avgUH: avgUH,
                    imtihanScore: imtihanScore,
                    finalScore: finalScore
                };
            });

            if (countMapelTested > 0) {
                masterData[santri.id].overallFinal = sumFinalAllMapel / countMapelTested;
            }
        });

        renderSantriListDOM();

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="empty-state">Terjadi kesalahan memuat data.</div>`;
    }
}

function renderSantriListDOM() {
    const container = document.getElementById("santri-imtihan-container");
    if (listSantri.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Belum ada santri.</p></div>`;
        return;
    }

    let html = "";
    listSantri.forEach((santri, idx) => {
        const overall = masterData[santri.id].overallFinal.toFixed(1);
        
        html += `
            <div class="absensi-santri-card" onclick="openModalImtihan('${santri.id}')">
                <div class="santri-card-left">
                    <div class="number-badge">${idx + 1}</div>
                    <div class="santri-info">
                        <div class="santri-name">${santri.nama}</div>
                        <div class="santri-rekap-counters">
                            <span style="font-size:0.75rem; color:var(--text-muted);">Klik untuk detail mapel</span>
                        </div>
                    </div>
                </div>
                <div class="santri-card-right">
                    <div class="badge-rata-rata" title="Rata-rata Keseluruhan">
                        <i data-lucide="bar-chart-2" style="width:14px;"></i> ${overall}
                    </div>
                    <i data-lucide="chevron-right" class="chevron-icon"></i>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ==========================================
   3. MODAL DETAIL IMTIHAN
   ========================================== */
window.openModalImtihan = function(santriId) {
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    const kelas = listKelas.find(k => k.id === selectedKelasId);
    
    document.getElementById("modal-santri-nama").innerText = santri.nama;
    document.getElementById("modal-kelas-text").innerText = `${kelas.namaKelas} - ${activePeriode}`;
    
    renderMapelCards();
    updateGrandTotalUI();
    document.getElementById("modal-detail-imtihan").classList.add("active");
};

window.closeModalImtihan = function() {
    document.getElementById("modal-detail-imtihan").classList.remove("active");
};

function renderMapelCards() {
    const container = document.getElementById("mapel-cards-container");
    const dataSantri = masterData[selectedSantriId].mapel;
    
    let html = "";
    listMapel.forEach((mapelName) => {
        const d = dataSantri[mapelName];
        // Konversi ID idMapel agar aman dipakai di HTML ID
        const safeId = mapelName.replace(/[^a-zA-Z0-9]/g, "_");
        
        const valImtihan = d.imtihanScore > 0 ? d.imtihanScore : "";
        
        html += `
            <div class="mapel-imtihan-card">
                <div class="mapel-card-header">
                    <i data-lucide="book" style="color:#64748b;"></i>
                    <h4>${mapelName}</h4>
                </div>
                <div class="imtihan-stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">Total UH</span>
                        <span class="stat-value">${d.totalUH}</span>
                    </div>
                    <div class="stat-box">
                        <span class="stat-label">Rata UH</span>
                        <span class="stat-value">${d.avgUH.toFixed(1)}</span>
                    </div>
                    <div class="stat-box" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2);">
                        <span class="stat-label" style="color: #3b82f6;">Nilai Imtihan</span>
                        <div class="input-imtihan-wrapper">
                            <input type="number" 
                                   id="input-imtihan-${safeId}" 
                                   class="input-imtihan" 
                                   value="${valImtihan}" 
                                   placeholder="0"
                                   onkeyup="recalculateMapel('${mapelName}', '${safeId}')"
                                   onchange="recalculateMapel('${mapelName}', '${safeId}')">
                        </div>
                    </div>
                    <div class="stat-box highlight">
                        <span class="stat-label" style="color: #10b981;">Nilai Akhir</span>
                        <span class="stat-value highlight-text" id="final-score-${safeId}">${d.finalScore.toFixed(1)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// Fungsi dinamis saat nilai diketik
window.recalculateMapel = function(mapelName, safeId) {
    const inputEl = document.getElementById(`input-imtihan-${safeId}`);
    const finalEl = document.getElementById(`final-score-${safeId}`);
    
    let imtihanVal = parseFloat(inputEl.value) || 0;
    const d = masterData[selectedSantriId].mapel[mapelName];
    
    // Update data memori
    d.imtihanScore = imtihanVal;
    
    // Hitung ulang Final Score (Rata UH + Imtihan) / 2
    if (d.countUH > 0 && imtihanVal > 0) d.finalScore = (d.avgUH + imtihanVal) / 2;
    else if (d.countUH > 0) d.finalScore = d.avgUH / 2;
    else if (imtihanVal > 0) d.finalScore = imtihanVal / 2;
    else d.finalScore = 0;
    
    finalEl.innerText = d.finalScore.toFixed(1);
    updateGrandTotalUI();
};

function updateGrandTotalUI() {
    const dataSantri = masterData[selectedSantriId].mapel;
    let sumFinal = 0;
    let countActiveMapel = 0;
    
    Object.keys(dataSantri).forEach(mapelName => {
        const d = dataSantri[mapelName];
        if (d.countUH > 0 || d.imtihanScore > 0) {
            sumFinal += d.finalScore;
            countActiveMapel++;
        }
    });
    
    let overall = 0;
    if (countActiveMapel > 0) overall = sumFinal / countActiveMapel;
    
    masterData[selectedSantriId].overallFinal = overall;
    document.getElementById("grand-total-value").innerText = overall.toFixed(2);
}

/* ==========================================
   4. SIMPAN KE FIREBASE
   ========================================== */
window.simpanNilaiImtihan = async function() {
    const btnSave = document.getElementById("btn-save-imtihan");
    const originalContent = btnSave.innerHTML;
    
    try {
        btnSave.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Menyimpan...`;
        btnSave.disabled = true;
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Siapkan payload (hanya menyimpan inputan imtihan)
        let nilaiMapelToSave = {};
        const dataMapel = masterData[selectedSantriId].mapel;
        Object.keys(dataMapel).forEach(mapel => {
            if (dataMapel[mapel].imtihanScore > 0) {
                nilaiMapelToSave[mapel] = dataMapel[mapel].imtihanScore;
            }
        });

        const docId = `${selectedKelasId}_${activePeriode.replace(/\s+/g, '')}_${selectedSantriId}`;
        const payload = {
            kelasId: selectedKelasId,
            santriId: selectedSantriId,
            imtihan: activePeriode,
            nilaiMapel: nilaiMapelToSave,
            updatedAt: new Date()
        };

        // Simpan menggunakan setDoc (Update atau Create otomatis berdasarkan docId)
        await setDoc(doc(db, "rekap_imtihan", docId), payload);

        // Update UI List di background agar rata-ratanya ikut terupdate
        renderSantriListDOM();

        closeModalImtihan();
        document.getElementById("modal-success-alert").classList.add("active");

    } catch (e) {
        console.error("Gagal menyimpan:", e);
        alert("Terjadi kesalahan saat menyimpan data Imtihan.");
    } finally {
        btnSave.innerHTML = originalContent;
        btnSave.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.closeSuccessModal = function() {
    document.getElementById("modal-success-alert").classList.remove("active");
};
