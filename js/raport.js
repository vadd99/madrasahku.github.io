
import { db, collection, getDocs, query, where } from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let listMapel = [];
let activePeriode = "Imtihan 1";
let selectedKelasId = null;

// Konfigurasi Bobot Penilaian
const BOBOT_UH = 0.6; // 60%
const BOBOT_IMTIHAN = 0.4; // 40%

let masterData = {}; 
let classAverages = {}; 

let isInitialized = false;
function initRaportView() {
    if (isInitialized) return;
    
    const viewKelas = document.getElementById("view-kelas");
    if (viewKelas) {
        isInitialized = true;
        const selectPeriode = document.getElementById("select-periode-raport");
        if (selectPeriode) activePeriode = selectPeriode.value;
        renderMainView();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRaportView);
} else {
    initRaportView();
}
document.addEventListener("layoutReady", initRaportView);

const observer = new MutationObserver(() => {
    if (document.getElementById("view-kelas") && !isInitialized) {
        initRaportView();
        observer.disconnect(); 
    }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

window.changePeriode = function(val) {
    activePeriode = val;
    if (selectedKelasId) loadSantriRaportList(selectedKelasId); 
};

async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadSantriRaportList(selectedKelasId);
    }
}

async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewTabel = document.getElementById("view-tabel");
    const exportBtn = document.getElementById("export-container");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");
    const btnBack = document.getElementById("btn-back-kelas");

    if (!viewTabel || !gridContainer) return;

    if (btnBack) btnBack.classList.add("hidden");
    if (exportBtn) exportBtn.classList.add("hidden");
    if (viewKelas) viewKelas.classList.remove("hidden");
    if (viewTabel) viewTabel.classList.add("hidden");
    
    document.getElementById("page-title").innerText = "Buku Induk Raport";
    document.getElementById("page-subtitle").innerText = "Pilih kelas untuk melihat rekapitulasi nilai dalam bentuk tabel.";

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
                <div class="kelas-card-item" onclick="openKelasRaport('${kelas.id}')">
                    <div class="kelas-icon-wrapper raport-icon"><i data-lucide="book-open"></i></div>
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

window.openKelasRaport = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    renderMainView();
};

async function loadSantriRaportList(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewTabel = document.getElementById("view-tabel");
    const exportBtn = document.getElementById("export-container");
    const btnBack = document.getElementById("btn-back-kelas");
    const loadingState = document.getElementById("loading-state");
    const tabelContainer = document.getElementById("tabel-container");

    if (viewKelas) viewKelas.classList.add("hidden");
    if (viewTabel) viewTabel.classList.remove("hidden");
    if (btnBack) btnBack.classList.remove("hidden");
    if (exportBtn) exportBtn.classList.add("hidden"); 

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };
    document.getElementById("page-title").innerText = `Induk Raport - ${selectedKelasData.namaKelas}`;
    document.getElementById("page-subtitle").innerText = "Tabel Rekapitulasi Rata-rata UH, Imtihan, dan Nilai Raport Akhir.";

    loadingState.classList.remove("hidden");
    tabelContainer.innerHTML = "";

    try {
        const santriSnap = await getDocs(collection(db, "kelas", kelasId, "santri"));
        listSantri = [];
        santriSnap.forEach(d => listSantri.push({ id: d.id, ...d.data() }));
        listSantri.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

        const mapelSnap = await getDocs(collection(db, "mapel"));
        let rawMapels = [];
        mapelSnap.forEach(d => rawMapels.push(d.data().nama));
        
        // Urutkan mapel sesuai standar Raport
        const orderAgama = ['Al-Qur\'an', 'Tajwid', 'Hadits', 'Tauhid', 'Akhlaq', 'Fiqih', 'Tarikh Islam', 'Bahasa Arab', 'Nahwu', 'Shorof'];
        listMapel = rawMapels.sort((a, b) => {
           const indexA = orderAgama.indexOf(a);
           const indexB = orderAgama.indexOf(b);
           if (indexA === -1 && indexB === -1) return a.localeCompare(b);
           if (indexA === -1) return 1;
           if (indexB === -1) return -1;
           return indexA - indexB;
        });

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
            masterData[santri.id] = { mapel: {}, overallFinal: 0, sumAllFinal: 0 };
            let sumFinalAllMapel = 0;
            let countMapelTested = 0;

            listMapel.forEach(mapelName => {
                let uhData = null;
                const mapelDoc = rawUH.find(r => r.mapel === mapelName);
                if (mapelDoc && mapelDoc.dataNilai) uhData = mapelDoc.dataNilai[santri.id];
                
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

                let finalScore = 0;
                if (countUH > 0 && imtihanScore > 0) {
                    finalScore = (avgUH * BOBOT_UH) + (imtihanScore * BOBOT_IMTIHAN);
                } else if (countUH > 0) {
                    finalScore = avgUH; 
                } else if (imtihanScore > 0) {
                    finalScore = imtihanScore;
                }

                if (countUH > 0 || imtihanScore > 0) {
                    sumFinalAllMapel += Math.round(finalScore);
                    countMapelTested++;
                }

                masterData[santri.id].mapel[mapelName] = {
                    avgUH: avgUH,
                    imtihanScore: imtihanScore,
                    finalScore: Math.round(finalScore) // Bulatkan untuk raport
                };
            });

            masterData[santri.id].sumAllFinal = sumFinalAllMapel;
            if (countMapelTested > 0) {
                masterData[santri.id].overallFinal = sumFinalAllMapel / countMapelTested;
            }
        });

        // Hitung Rata-rata Kelas per Kolom
        classAverages = {
            mapel: {}, // Rata-rata finalScore per mapel
            overallSum: 0,
            overallAvg: 0
        };
        
        let totalAllSums = 0;
        let totalAllAvgs = 0;
        let validSantriCount = 0;

        listMapel.forEach(mapelName => {
            let sumMapel = 0;
            let countSantri = 0;
            
            listSantri.forEach(santri => {
                const finalSc = masterData[santri.id].mapel[mapelName].finalScore;
                if (finalSc > 0) {
                    sumMapel += finalSc;
                    countSantri++;
                }
            });
            classAverages.mapel[mapelName] = countSantri > 0 ? Math.round(sumMapel / countSantri) : 0;
        });
        
        listSantri.forEach(santri => {
            if(masterData[santri.id].sumAllFinal > 0) {
                totalAllSums += masterData[santri.id].sumAllFinal;
                totalAllAvgs += masterData[santri.id].overallFinal;
                validSantriCount++;
            }
        });
        
        if(validSantriCount > 0) {
            classAverages.overallSum = Math.round(totalAllSums / validSantriCount);
            classAverages.overallAvg = totalAllAvgs / validSantriCount;
        }

        renderTabelRaport();
        loadingState.classList.add("hidden");
        if (exportBtn) exportBtn.classList.remove("hidden"); // Munculkan tombol export

    } catch (e) {
        console.error(e);
        loadingState.innerHTML = `<p style="color:red;">Terjadi kesalahan memuat data: ${e.message}</p>`;
    }
}

function renderTabelRaport() {
    const container = document.getElementById("tabel-container");
    if (listSantri.length === 0) {
        container.innerHTML = `<div class="empty-state"><p>Belum ada santri di kelas ini.</p></div>`;
        return;
    }

    let theadHtml1 = `<tr>
        <th rowspan="2" class="col-no">No</th>
        <th rowspan="2" class="col-nama">Nama Santri</th>`;
    let theadHtml2 = `<tr>`;
    
    // Header Mapel
    listMapel.forEach(mapel => {
        theadHtml1 += `<th colspan="3" class="group-mapel">${mapel}</th>`;
        theadHtml2 += `<th>Rata UH</th><th>Imtihan</th><th>Raport</th>`;
    });
    
    // Header Grand Total
    theadHtml1 += `<th colspan="2" class="group-rekap">REKAP AKHIR</th></tr>`;
    theadHtml2 += `<th>Jumlah</th><th>Rata-rata</th></tr>`;

    // Baris Body
    let tbodyHtml = `<tbody>`;
    listSantri.forEach((santri, idx) => {
        tbodyHtml += `<tr>
            <td class="col-no">${idx + 1}</td>
            <td class="col-nama text-left">${santri.nama}</td>`;
            
        listMapel.forEach(mapel => {
            const d = masterData[santri.id].mapel[mapel];
            const u = d.avgUH > 0 ? d.avgUH.toFixed(1) : "-";
            const i = d.imtihanScore > 0 ? d.imtihanScore : "-";
            const r = d.finalScore > 0 ? d.finalScore : "-";
            
            tbodyHtml += `<td class="text-blue">${u}</td><td>${i}</td><td class="text-green">${r}</td>`;
        });
        
        const sum = masterData[santri.id].sumAllFinal;
        const avg = masterData[santri.id].overallFinal.toFixed(1);
        tbodyHtml += `<td class="text-bold">${sum > 0 ? sum : "-"}</td><td class="text-bold text-green">${avg > 0 ? avg : "-"}</td>`;
        tbodyHtml += `</tr>`;
    });
    tbodyHtml += `</tbody>`;

    // Baris Footer Rata-rata Kelas
    let tfootHtml = `<tfoot><tr>
        <th colspan="2" class="col-nama">Rata-rata Kelas :</th>`;
        
    listMapel.forEach(mapel => {
        const rataStr = classAverages.mapel[mapel] > 0 ? classAverages.mapel[mapel] : "-";
        tfootHtml += `<th>-</th><th>-</th><th>${rataStr}</th>`; // Kolom UH dan Imtihan dikosongkan (bisa diisi jika mau dihitung)
    });
    
    tfootHtml += `<th>${classAverages.overallSum > 0 ? classAverages.overallSum : "-"}</th>
                  <th>${classAverages.overallAvg > 0 ? classAverages.overallAvg.toFixed(1) : "-"}</th>`;
    tfootHtml += `</tr></tfoot>`;

    const fullTable = `<table class="tabel-raport" id="main-tabel-raport">
        <thead>${theadHtml1}${theadHtml2}</thead>
        ${tbodyHtml}
        ${tfootHtml}
    </table>`;

    container.innerHTML = fullTable;
}

// Fitur Export ke Excel menggunakan SheetJS
window.exportToExcel = function() {
    const table = document.getElementById("main-tabel-raport");
    if (!table) return alert("Tabel tidak ditemukan!");
    
    const kelasName = listKelas.find(k => k.id === selectedKelasId)?.namaKelas || "Kelas";
    const fileName = `Rekap_Raport_${kelasName}_${activePeriode.replace(/\s+/g, '')}.xlsx`;

    // Convert tabel HTML to workbook
    const wb = XLSX.utils.table_to_book(table, {sheet: "Rekap Nilai"});
    
    // Download
    XLSX.writeFile(wb, fileName);
};
