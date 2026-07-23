import { 
    db, 
    collection, 
    getDocs, 
    getDoc,
    setDoc, 
    doc,
    query,
    where 
} from "./firebase-init.js";

let listKelas = [];
let listSantri = [];
let selectedKelasId = null;
let selectedSantriId = null;

let activeImtihan = "Imtihan 1";
let todayAttendance = {}; // Menyimpan sementara status absensi hari ini: { santriId: "hadir" | "izin" | "sakit" | "alpa" }
let rekapAttendance = {}; // Menyimpan akumulasi rekap imtihan: { santriId: { izin: 0, sakit: 0, alpa: 0 } }

document.addEventListener("layoutReady", function () {
    renderMainView();
});

function getTodayISO() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayFormatted() {
    const today = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    return today.toLocaleDateString('id-ID', options);
}

window.changeImtihanPeriod = function(val) {
    activeImtihan = val;
    if (selectedKelasId) {
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
   1. DAFTAR KELAS
   =================================================== */
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewAbsensi = document.getElementById("view-absensi");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    btnBack.classList.add("hidden");
    pageTitle.innerText = "Absensi Santri";
    pageSubtitle.innerText = "Pilih kelas untuk mengelola kehadiran santri harian.";

    viewKelas.classList.remove("hidden");
    viewAbsensi.classList.add("hidden");

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
            emptyState.classList.remove("hidden");
            gridContainer.classList.add("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        gridContainer.classList.remove("hidden");

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
        console.error("Gagal mengambil data kelas:", error);
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
    const santriContainer = document.getElementById("santri-absensi-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    const selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas" };

    btnBack.classList.remove("hidden");
    pageTitle.innerText = `Absensi - ${selectedKelasData.namaKelas}`;
    pageSubtitle.innerText = `Daftar presensi santri untuk ${selectedKelasData.namaKelas}.`;

    document.getElementById("today-date-text").innerText = getTodayFormatted();

    viewKelas.classList.add("hidden");
    viewAbsensi.classList.remove("hidden");

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

        const absensiQuery = query(
            collection(db, "absensi"), 
            where("kelasId", "==", kelasId),
            where("imtihan", "==", activeImtihan)
        );
        const absensiSnap = await getDocs(absensiQuery);

        absensiSnap.forEach(docSnap => {
            const data = docSnap.data().kehadiran || {};
            Object.keys(data).forEach(sId => {
                if (rekapAttendance[sId]) {
                    const st = data[sId];
                    if (st === "izin") rekapAttendance[sId].izin++;
                    else if (st === "sakit") rekapAttendance[sId].sakit++;
                    else if (st === "alpa") rekapAttendance[sId].alpa++;
                }
            });
        });

        // C. Ambil / Set Data Absensi Hari Ini (Default: Hadir)
        const todayISO = getTodayISO();
        const todayDocRef = doc(db, "absensi", `${kelasId}_${todayISO}`);
        const todayDocSnap = await getDoc(todayDocRef);

        todayAttendance = {};
        if (todayDocSnap.exists()) {
            todayAttendance = todayDocSnap.data().kehadiran || {};
        }

        // Isi default status 'hadir' jika belum di-set
        listSantri.forEach(s => {
            if (!todayAttendance[s.id]) {
                todayAttendance[s.id] = "hadir";
            }
        });

        // D. Render List Santri UI
        renderSantriAbsensiList();

    } catch (error) {
        console.error("Gagal memuat absensi:", error);
    }
}

function renderSantriAbsensiList() {
    const container = document.getElementById("santri-absensi-container");
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
   3. MODAL EDIT STATUS SEMENTARA
   =================================================== */
window.openModalStatus = function(santriId) {
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    if (!santri) return;

    document.getElementById("modal-santri-nama").innerText = santri.nama;
    document.getElementById("modal-tanggal-text").innerText = getTodayFormatted();

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

window.applySantriStatusChange = function() {
    if (!selectedSantriId) return;

    const radios = document.getElementsByName("status-kehadiran");
    let chosenStatus = "hadir";
    for (let r of radios) {
        if (r.checked) {
            chosenStatus = r.value;
            break;
        }
    }

    todayAttendance[selectedSantriId] = chosenStatus;
    closeModalStatus();
    renderSantriAbsensiList(); // Update UI langsung
};

/* ===================================================
   4. SIMPAN ABSENSI HARI INI KE FIREBASE
   =================================================== */
window.saveTodayAbsensi = async function() {
    if (!selectedKelasId) return;

    const todayISO = getTodayISO();
    const docId = `${selectedKelasId}_${todayISO}`;

    const payload = {
        kelasId: selectedKelasId,
        tanggal: todayISO,
        imtihan: activeImtihan,
        kehadiran: todayAttendance,
        updatedAt: new Date()
    };

    try {
        await setDoc(doc(db, "absensi", docId), payload);
        alert(`Absensi tanggal ${getTodayFormatted()} berhasil disimpan!`);
        await loadAbsensiSubMenu(selectedKelasId); // Reload untuk perbarui rekap akumulasi
    } catch (error) {
        console.error("Gagal menyimpan absensi:", error);
        alert("Gagal menyimpan data absensi.");
    }
};
