import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    setDoc
} from "./firebase-init.js";

// Variable Penyimpanan Sementara dari Firebase
let listKelas = [];       // Menyimpan daftar dokumen kelas
let listSantri = [];      // Menyimpan daftar santri pada kelas yang dipilih
let listGuru = [];        // Menyimpan daftar guru dari database

let selectedKelasId = null;
let selectedKelasData = null;
let selectedSantriId = null;

// --- PENANGANAN INISIALISASI AMAN (Mencegah Bentrok & Race Condition Template) ---
function initSantriView() {
    // KUNCI PERBAIKAN: Hanya jalankan jika elemen UNIK halaman santri (#view-santri) ada di DOM
    if (document.getElementById("view-santri")) {
        renderMainView();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSantriView);
} else {
    initSantriView();
}

// Mendengarkan event saat layout template selesai di-render oleh main.js
document.addEventListener("layoutReady", function () {
    initSantriView();
});

// Render Tampilan Utama (Cek Tampilan Kelas atau Sub-Menu Santri)
async function renderMainView() {
    if (selectedKelasId === null) {
        await loadKelasFromFirebase();
    } else {
        await loadSantriFromFirebase(selectedKelasId);
    }
}

/* ===================================================
   1. LOGIKA KELAS (FIREBASE)
   =================================================== */

// Load Data Guru dari Collection "guru" di Firestore
async function loadGuruFromFirebase() {
    try {
        const querySnapshot = await getDocs(collection(db, "guru"));
        listGuru = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.nama) {
                listGuru.push({
                    id: docSnap.id,
                    nama: data.nama
                });
            }
        });

        // Sort Nama Guru A-Z
        listGuru.sort((a, b) => a.nama.localeCompare(b.nama));
    } catch (error) {
        console.error("Gagal mengambil data guru:", error);
    }
}

// Load Data Kelas dari Collection "kelas" di Firestore & Hitung Santri Realtime
async function loadKelasFromFirebase() {
    const viewKelas = document.getElementById("view-kelas");
    const viewSantri = document.getElementById("view-santri");
    const emptyState = document.getElementById("empty-state-kelas");
    const gridContainer = document.getElementById("kelas-grid-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    const btnTambahKelas = document.getElementById("btn-tambah-kelas");
    const btnTambahSantri = document.getElementById("btn-tambah-santri");

    // Validasi Keberadaan Halaman Santri
    if (!viewSantri || !viewKelas || !gridContainer) return;

    // Atur Toolbar Santri
    if (btnBack) btnBack.classList.add("hidden");
    if (pageTitle) pageTitle.innerText = "Data Santri Per Kelas";
    if (pageSubtitle) pageSubtitle.innerText = "Pilih kelas untuk melihat atau mengelola data santri.";
    if (btnTambahKelas) btnTambahKelas.classList.remove("hidden");
    if (btnTambahSantri) btnTambahSantri.classList.add("hidden");

    viewKelas.classList.remove("hidden");
    viewSantri.classList.add("hidden");

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
                totalSantri: santriSnap.size
            };
        });

        listKelas = await Promise.all(kelasPromises);

        // Sorting Angka Alami (Natural Numerical Sort: Kelas 1, Kelas 2, Kelas 10)
        listKelas.sort((a, b) => {
            return a.namaKelas.localeCompare(b.namaKelas, undefined, { 
                numeric: true, 
                sensitivity: 'base' 
            });
        });

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
                <div class="kelas-card-item" onclick="openSantriSubMenu('${kelas.id}')">
                    <div class="kelas-info">
                        <div class="kelas-name">${kelas.namaKelas}</div>
                        <div class="kelas-count">${kelas.totalSantri} santri</div>
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

// Open Modal Tambah / Edit Kelas (Populate List Guru Ke Dropdown)
window.openModalKelas = async function(isEdit = false) {
    const modal = document.getElementById("modal-kelas");
    const title = document.getElementById("modal-kelas-title");
    const inputNama = document.getElementById("nama-kelas-input");
    const selectWali = document.getElementById("wali-kelas-input");

    // Load data guru terbaru dari database
    await loadGuruFromFirebase();

    // Populate Option Pilihan Guru
    let waliOptions = `<option value="">-- Pilih Wali Kelas --</option>`;
    listGuru.forEach((guru) => {
        waliOptions += `<option value="${guru.nama}">${guru.nama}</option>`;
    });
    if (selectWali) selectWali.innerHTML = waliOptions;

    if (isEdit && selectedKelasData) {
        if (title) title.innerText = "Edit Data Kelas";
        if (inputNama) inputNama.value = selectedKelasData.namaKelas || "";

        const currentWali = selectedKelasData.waliKelas !== "-" ? selectedKelasData.waliKelas : "";
        
        if (currentWali && !listGuru.some(g => g.nama === currentWali)) {
            if (selectWali) selectWali.innerHTML += `<option value="${currentWali}">${currentWali}</option>`;
        }
        if (selectWali) selectWali.value = currentWali;
    } else {
        if (title) title.innerText = "Tambah Kelas Baru";
        if (inputNama) inputNama.value = "";
        if (selectWali) selectWali.value = "";
    }

    if (modal) modal.classList.add("active");
};

window.closeModalKelas = function() {
    const modal = document.getElementById("modal-kelas");
    if (modal) modal.classList.remove("active");
};

window.saveKelasData = async function(event) {
    event.preventDefault();
    const inputNama = document.getElementById("nama-kelas-input");
    const selectWali = document.getElementById("wali-kelas-input");
    const namaKelas = inputNama ? inputNama.value.trim() : "";
    const waliKelas = selectWali ? selectWali.value.trim() : "";
    
    if (!namaKelas) return;

    try {
        const modalTitleEl = document.getElementById("modal-kelas-title");
        const isEditMode = modalTitleEl && modalTitleEl.innerText.includes("Edit");

        if (selectedKelasId && isEditMode) {
            const docRef = doc(db, "kelas", selectedKelasId);
            await updateDoc(docRef, {
                namaKelas: namaKelas,
                waliKelas: waliKelas || "-"
            });
        } else {
            await addDoc(collection(db, "kelas"), {
                namaKelas: namaKelas,
                waliKelas: waliKelas || "-",
                createdAt: new Date()
            });
        }

        closeModalKelas();
        await renderMainView();
    } catch (error) {
        console.error("Gagal menyimpan kelas:", error);
        alert("Gagal menyimpan data kelas.");
    }
};

window.deleteKelasData = async function() {
    if (!selectedKelasId) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus "${selectedKelasData.namaKelas}"? Seluruh data santri di kelas ini juga akan terhapus.`)) return;

    try {
        await deleteDoc(doc(db, "kelas", selectedKelasId));
        alert("Kelas berhasil dihapus.");
        window.goBackToKelasList();
    } catch (error) {
        console.error("Gagal menghapus kelas:", error);
        alert("Gagal menghapus data kelas.");
    }
};

/* ===================================================
   2. LOGIKA SUB-MENU SANTRI & STATISTIK (FIREBASE)
   =================================================== */

window.openSantriSubMenu = function(kelasId) {
    selectedKelasId = kelasId;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    selectedKelasData = null;
    selectedSantriId = null;
    renderMainView();
};

async function loadSantriFromFirebase(kelasId) {
    const viewKelas = document.getElementById("view-kelas");
    const viewSantri = document.getElementById("view-santri");
    const emptyState = document.getElementById("empty-state-santri");
    const listContainer = document.getElementById("santri-list-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    const btnTambahKelas = document.getElementById("btn-tambah-kelas");
    const btnTambahSantri = document.getElementById("btn-tambah-santri");

    if (!viewSantri) return;

    if (listKelas.length === 0) {
        try {
            const querySnapshot = await getDocs(collection(db, "kelas"));
            listKelas = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                namaKelas: docSnap.data().namaKelas || docSnap.data().nama || "Kelas",
                waliKelas: docSnap.data().waliKelas || "-"
            }));
        } catch (e) {
            console.error("Gagal fetch list kelas:", e);
        }
    }

    selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas", waliKelas: "-" };

    if (btnBack) btnBack.classList.remove("hidden");
    if (pageTitle) pageTitle.innerText = `Data Santri - ${selectedKelasData.namaKelas}`;
    if (pageSubtitle) pageSubtitle.innerText = `Daftar nama-nama santri yang terdaftar di ${selectedKelasData.namaKelas}.`;
    if (btnTambahKelas) btnTambahKelas.classList.add("hidden");
    if (btnTambahSantri) btnTambahSantri.classList.remove("hidden");

    const subKelasTitle = document.getElementById("sub-kelas-title");
    if (subKelasTitle) subKelasTitle.innerText = selectedKelasData.namaKelas;

    if (viewKelas) viewKelas.classList.add("hidden");
    if (viewSantri) viewSantri.classList.remove("hidden");

    try {
        const santriRef = collection(db, "kelas", kelasId, "santri");
        const querySnapshot = await getDocs(santriRef);
        
        listSantri = [];
        querySnapshot.forEach((docSnap) => {
            listSantri.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        const totalSantri = listSantri.length;
        let countLaki = 0;
        let countPerempuan = 0;

        listSantri.forEach((s) => {
            const jk = (s.jenisKelamin || s.jk || "").toLowerCase();
            if (jk.includes("laki") || jk === "l") {
                countLaki++;
            } else if (jk.includes("perempuan") || jk === "p") {
                countPerempuan++;
            }
        });

        const elWali = document.getElementById("stat-wali-kelas");
        const elTotal = document.getElementById("stat-total-santri");
        const elL = document.getElementById("stat-count-l");
        const elP = document.getElementById("stat-count-p");

        if (elWali) elWali.innerText = selectedKelasData.waliKelas || "-";
        if (elTotal) elTotal.innerText = `${totalSantri} Santri`;
        if (elL) elL.innerText = countLaki;
        if (elP) elP.innerText = countPerempuan;

        if (totalSantri === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            if (listContainer) listContainer.classList.add("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        if (listContainer) listContainer.classList.remove("hidden");

        let listHtml = "";
        listSantri.forEach((santri, index) => {
            listHtml += `
                <div class="santri-item" onclick="openDetailSantriModal('${santri.id}')">
                    <div class="santri-item-left">
                        <div class="number-badge">${index + 1}</div>
                        <div>
                            <div class="santri-item-name">${santri.nama}</div>
                            <div class="santri-item-sub">
                                ${santri.jenisKelamin || 'SANTRI'} • ${santri.nis ? 'NIS: ' + santri.nis : 'NIS: -'}
                            </div>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="chevron-icon"></i>
                </div>
            `;
        });

        if (listContainer) listContainer.innerHTML = listHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error("Gagal mengambil data santri:", error);
    }
}

/* ===================================================
   3. DETAIL, EDIT, DAN SIMPAN SANTRI (FIREBASE)
   =================================================== */

window.openDetailSantriModal = function(santriId) {
    selectedSantriId = santriId;
    const santri = listSantri.find(s => s.id === santriId);
    if (!santri) return;

    const setElText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setElText("detail-santri-nama", santri.nama || "-");
    setElText("detail-santri-jk", santri.jenisKelamin || "-");
    setElText("detail-santri-nis", santri.nis || "- (Belum ada)");
    setElText("detail-santri-ayah", santri.ayah || "- (Belum ada)");
    setElText("detail-santri-ibu", santri.ibu || "- (Belum ada)");
    setElText("detail-santri-hp", santri.hp || "- (Belum ada)");
    setElText("detail-santri-alamat", santri.alamat || "- (Belum ada)");

    const btnEdit = document.getElementById("btn-edit-santri");
    if (btnEdit) {
        btnEdit.onclick = function () {
            closeDetailSantriModal();
            openFormSantriModal(true, santriId);
        };
    }

    const btnDelete = document.getElementById("btn-delete-santri");
    if (btnDelete) {
        btnDelete.onclick = function () {
            deleteSantriData(santriId);
        };
    }

    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeDetailSantriModal = function() {
    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.remove("active");
};

// Helper untuk memuat dropdown pilihan kelas di dalam form santri
async function populateKelasSelectForSantri(selectedTargetKelasId = "") {
    const selectKelas = document.getElementById("santri-kelas-target");
    if (!selectKelas) return;

    try {
        if (listKelas.length === 0) {
            const querySnapshot = await getDocs(collection(db, "kelas"));
            listKelas = querySnapshot.docs.map(docSnap => ({
                id: docSnap.id,
                namaKelas: docSnap.data().namaKelas || docSnap.data().nama || "Kelas"
            }));
            listKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true, sensitivity: 'base' }));
        }

        let optionsHtml = "";
        listKelas.forEach(k => {
            const isSelected = (k.id === selectedTargetKelasId) ? "selected" : "";
            optionsHtml += `<option value="${k.id}" ${isSelected}>${k.namaKelas}</option>`;
        });

        selectKelas.innerHTML = optionsHtml;
    } catch (error) {
        console.error("Gagal memuat pilihan kelas:", error);
    }
}

window.openFormSantriModal = async function(isEdit = false, santriId = null) {
    const modal = document.getElementById("modal-form-santri");
    const formTitle = document.getElementById("form-santri-title");
    const groupKelasTarget = document.getElementById("group-kelas-target");

    if (isEdit && santriId) {
        selectedSantriId = santriId;
        const santri = listSantri.find(s => s.id === santriId);

        if (formTitle) formTitle.innerText = "Edit Data Santri";
        if (groupKelasTarget) groupKelasTarget.classList.remove("hidden");

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal("santri-nama", santri.nama || "");
        setVal("santri-jk", santri.jenisKelamin || "Laki-laki");
        setVal("santri-nis", santri.nis || "");
        setVal("santri-ayah", santri.ayah || "");
        setVal("santri-ibu", santri.ibu || "");
        setVal("santri-hp", santri.hp || "");
        setVal("santri-alamat", santri.alamat || "");

        await populateKelasSelectForSantri(selectedKelasId);
    } else {
        selectedSantriId = null;
        if (formTitle) formTitle.innerText = "Tambah Data Santri";
        if (groupKelasTarget) groupKelasTarget.classList.add("hidden");
        
        const form = document.getElementById("form-santri");
        if (form) form.reset();
    }

    if (modal) modal.classList.add("active");
};

window.closeFormSantriModal = function() {
    const modal = document.getElementById("modal-form-santri");
    const form = document.getElementById("form-santri");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

window.saveSantriData = async function(event) {
    event.preventDefault();

    const inputNama = document.getElementById("santri-nama");
    const nama = inputNama ? inputNama.value.trim() : "";
    if (!nama) return;

    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    const santriData = {
        nama: nama,
        jenisKelamin: document.getElementById("santri-jk") ? document.getElementById("santri-jk").value : "Laki-laki",
        nis: getVal("santri-nis"),
        ayah: getVal("santri-ayah"),
        ibu: getVal("santri-ibu"),
        hp: getVal("santri-hp"),
        alamat: getVal("santri-alamat"),
        updatedAt: new Date()
    };

    try {
        if (selectedSantriId) {
            const targetKelasSelect = document.getElementById("santri-kelas-target");
            const targetKelasId = targetKelasSelect ? targetKelasSelect.value : selectedKelasId;

            if (targetKelasId && targetKelasId !== selectedKelasId) {
                // PINDAH KELAS
                santriData.createdAt = new Date();
                const newSantriRef = doc(collection(db, "kelas", targetKelasId, "santri"));
                await setDoc(newSantriRef, santriData);

                const oldSantriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await deleteDoc(oldSantriDocRef);
            } else {
                // EDIT DALAM KELAS YANG SAMA
                const santriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await updateDoc(santriDocRef, santriData);
            }
        } else {
            // TAMBAH SANTRI BARU DI KELAS AKTIF
            santriData.createdAt = new Date();
            const santriRef = collection(db, "kelas", selectedKelasId, "santri");
            await addDoc(santriRef, santriData);
        }

        closeFormSantriModal();
        await renderMainView();
    } catch (error) {
        console.error("Gagal menyimpan data santri:", error);
        alert("Terjadi kesalahan saat menyimpan data santri.");
    }
};

async function deleteSantriData(santriId) {
    if (!confirm("Apakah Anda yakin ingin menghapus data santri ini?")) return;

    try {
        const santriDocRef = doc(db, "kelas", selectedKelasId, "santri", santriId);
        await deleteDoc(santriDocRef);

        closeDetailSantriModal();
        await renderMainView();
    } catch (error) {
        console.error("Gagal menghapus santri:", error);
        alert("Gagal menghapus data santri.");
    }
}
