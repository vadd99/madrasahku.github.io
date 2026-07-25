
import { db, collection, getDocs, doc, query, where, setDoc } from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let listMapel = [];
let activePeriode = "Imtihan 1";
let selectedKelasId = null;
let selectedSantriId = null;

// Konfigurasi Bobot Penilaian
const BOBOT_UH = 0.6; // 60%
const BOBOT_IMTIHAN = 0.4; // 40%

// Data Master untuk kalkulasi
let masterData = {}; 

window.closeGuideBoxImtihan = function() {
    const box = document.getElementById("guide-box-imtihan");
    if (box) box.style.display = "none";
};

let isInitialized = false;
function initImtihanView() {
    if (isInitialized) return;
    
    const viewKelas = document.getElementById("view-kelas");
    if (viewKelas) {
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

const observer = new MutationObserver(() => {
    if (document.getElementById("view-kelas") && !isInitialized) {
        initImtihanView();
        observer.disconnect(); 
    }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

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
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach(d => listSantri.push({ id: d.id, ...d.data() }));
        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        const mapelSnap = await getDocs(collection(db, "mapel"));
        listMapel = [];
        mapelSnap.forEach(d => listMapel.push(d.data().nama));

        const qUH = query(collection(db, "rekap_nilai"), where("kelasId", "==", kelasId), where("imtihan", "==", activePeriode));
        const snapUH = await getDocs(qUH);
        let rawUH = []; 
        snapUH.forEach(d => rawUH.push(d.data()));

        const qImtihan = query(collection(db, "rekap_imtihan"), where("kelasId", "==", kelasId), where("imtihan", "==", activePeriode));
        const snapImtihan = await getDocs(qImtihan);
        let rawImtihan = {}; 
        snapImtihan.forEach(d => {
            const data = d.data();
            rawImtihan[data.santriId] = data.nilaiMapel || {};
        });

        masterData = {};
        listSantri.forEach(santri => {
            masterData[santri.id] = { mapel: {}, overallFinal: 0, totalMapelCount: 0, sumAllFinal: 0 };
            let sumFinalAllMapel = 0;
            let countMapelTested = 0;

            listMapel.forEach(mapelName => {
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

                let imtihanScore = 0;
                if (rawImtihan[santri.id] && rawImtihan[santri.id][mapelName]) {
                    imtihanScore = parseFloat(rawImtihan[santri.id][mapelName]);
                }

                // --- PEMBARUAN LOGIKA KALKULASI NILAI AKHIR (PEMBOBOTAN STANDAR) ---
                let finalScore = 0;
                if (countUH > 0 && imtihanScore > 0) {
                    // Bobot 60% UH, 40% Imtihan
                    finalScore = (avgUH * BOBOT_UH) + (imtihanScore * BOBOT_IMTIHAN);
                } else if (countUH > 0) {
                    // Jika belum ada nilai imtihan, nilai sementara murni dari UH
                    finalScore = avgUH; 
                } else if (imtihanScore > 0) {
                     // Jika tidak ada nilai UH tapi ikut imtihan (kasus jarang)
                    finalScore = imtihanScore;
                }

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

            // Menyimpan total mapel dan total nilai untuk ditampilkan di rapor
            masterData[santri.id].totalMapelCount = countMapelTested;
            masterData[santri.id].sumAllFinal = sumFinalAllMapel;

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
                            <span style="font-size:0.75rem; color:var(--text-muted);">Klik untuk detail mapel & Rekap Raport</span>
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

// Fungsi helper mengubah angka menjadi huruf
function terbilang(angka) {
    if(angka === 0) return 'Nol';
    
    // Pembulatan angka ke integer terdekat untuk raport
    angka = Math.round(angka); 
    
    const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
    let hasil = "";

    if (angka < 12) {
        hasil = huruf[angka];
    } else if (angka < 20) {
        hasil = terbilang(angka - 10) + " Belas";
    } else if (angka < 100) {
        hasil = terbilang(Math.floor(angka / 10)) + " Puluh " + terbilang(angka % 10);
    } else if (angka === 100) {
        hasil = "Seratus";
    }
    
    return hasil.trim();
}

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
    
    // Kategori untuk Raport (berdasarkan gambar)
    const orderAgama = ['Al-Qur\'an', 'Tajwid', 'Hadits', 'Tauhid', 'Akhlaq', 'Fiqih', 'Tarikh Islam', 'Bahasa Arab', 'Nahwu', 'Shorof'];
    
    let html = "";
    
    // Sort Mapel, pastikan yang ada di form raport muncul duluan
    const sortedMapels = listMapel.sort((a, b) => {
       const indexA = orderAgama.indexOf(a);
       const indexB = orderAgama.indexOf(b);
       if (indexA === -1 && indexB === -1) return a.localeCompare(b);
       if (indexA === -1) return 1;
       if (indexB === -1) return -1;
       return indexA - indexB;
    });

    sortedMapels.forEach((mapelName) => {
        const d = dataSantri[mapelName];
        if(!d) return; // Skip if mapel somehow doesn't exist for santri
        
        const safeId = mapelName.replace(/[^a-zA-Z0-9]/g, "_");
        const valImtihan = d.imtihanScore > 0 ? d.imtihanScore : "";
        
        // Pembulatan nilai akhir untuk Raport
        const finalRounded = Math.round(d.finalScore);
        const finalHuruf = d.finalScore > 0 ? terbilang(finalRounded) : "-";
        
        html += `
            <div class="mapel-imtihan-card">
                <div class="mapel-card-header">
                    <i data-lucide="book" style="color:#64748b;"></i>
                    <h4>${mapelName}</h4>
                </div>
                <div class="imtihan-stats-grid">
                    <div class="stat-box">
                        <span class="stat-label">Rata UH (60%)</span>
                        <span class="stat-value">${d.avgUH.toFixed(1)}</span>
                    </div>
                    
                    <div class="stat-box" style="background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2);">
                        <span class="stat-label" style="color: #3b82f6;">Imtihan (40%)</span>
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
                        <span class="stat-label" style="color: #10b981;">Nilai Raport (Angka)</span>
                        <span class="stat-value highlight-text" id="final-score-${safeId}">${finalRounded}</span>
                    </div>
                    
                    <div class="stat-box highlight-huruf">
                        <span class="stat-label" style="color: #d97706;">Nilai Raport (Huruf)</span>
                        <span class="stat-value-sm highlight-text-huruf" id="final-huruf-${safeId}">${finalHuruf}</span>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Tambahan Bagian Rekap Bawah Raport
    html += `
        <div class="raport-summary-card">
            <h4><i data-lucide="clipboard-list"></i> Data untuk Bagian Bawah Raport</h4>
            <div class="summary-flex">
                <div class="sum-item">
                    <span class="sum-label">Jumlah Nilai</span>
                    <span class="sum-val" id="raport-jumlah-nilai">0</span>
                </div>
                <div class="sum-item">
                    <span class="sum-label">Rata-rata</span>
                    <span class="sum-val" id="raport-rata-rata">0</span>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

window.recalculateMapel = function(mapelName, safeId) {
    const inputEl = document.getElementById(`input-imtihan-${safeId}`);
    const finalEl = document.getElementById(`final-score-${safeId}`);
    const hurufEl = document.getElementById(`final-huruf-${safeId}`);
    
    let imtihanVal = parseFloat(inputEl.value) || 0;
    const d = masterData[selectedSantriId].mapel[mapelName];
    
    d.imtihanScore = imtihanVal;
    
    // Kalkulasi pembobotan ulang
    if (d.countUH > 0 && imtihanVal > 0) {
        d.finalScore = (d.avgUH * BOBOT_UH) + (imtihanVal * BOBOT_IMTIHAN);
    } else if (d.countUH > 0) {
        d.finalScore = d.avgUH; 
    } else if (imtihanVal > 0) {
        d.finalScore = imtihanVal;
    } else {
        d.finalScore = 0;
    }
    
    const finalRounded = Math.round(d.finalScore);
    
    finalEl.innerText = finalRounded;
    hurufEl.innerText = d.finalScore > 0 ? terbilang(finalRounded) : "-";
    
    updateGrandTotalUI();
};

function updateGrandTotalUI() {
    const dataSantri = masterData[selectedSantriId].mapel;
    let sumFinal = 0;
    let countActiveMapel = 0;
    
    Object.keys(dataSantri).forEach(mapelName => {
        const d = dataSantri[mapelName];
        if (d.countUH > 0 || d.imtihanScore > 0) {
            // Untuk jumlah nilai raport pakai angka bulat
            sumFinal += Math.round(d.finalScore);
            countActiveMapel++;
        }
    });
    
    let overall = 0;
    if (countActiveMapel > 0) overall = sumFinal / countActiveMapel;
    
    masterData[selectedSantriId].sumAllFinal = sumFinal;
    masterData[selectedSantriId].overallFinal = overall;
    
    // Update UI Header
    document.getElementById("grand-total-value").innerText = overall.toFixed(1);
    
    // Update UI Rekap Bawah Raport (jika ada di DOM)
    const sumTotalEl = document.getElementById("raport-jumlah-nilai");
    const avgTotalEl = document.getElementById("raport-rata-rata");
    
    if(sumTotalEl) sumTotalEl.innerText = sumFinal;
    if(avgTotalEl) avgTotalEl.innerText = overall.toFixed(1);
}

window.simpanNilaiImtihan = async function() {
    const btnSave = document.getElementById("btn-save-imtihan");
    const originalContent = btnSave.innerHTML;
    
    try {
        btnSave.innerHTML = `<i data-lucide="loader-2" class="animate-spin"></i> Menyimpan...`;
        btnSave.disabled = true;
        if (typeof lucide !== 'undefined') lucide.createIcons();

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

        await setDoc(doc(db, "rekap_imtihan", docId), payload);
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
