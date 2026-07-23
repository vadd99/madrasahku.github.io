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
let listGuru = [];        // Menyimpan daftar guru dari koleksi "guru"

let selectedKelasId = null;
let selectedKelasData = null;
let selectedSantriId = null;

// Inisialisasi Tampilan (Mencegah Race Condition Event Layout)
if (document.readyState === "complete" || document.readyState === "interactive") {
    renderMainView();
}
document.addEventListener("layoutReady", function () {
    renderMainView();
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
   LOAD DATA GURU UNTUK WALI KELAS
   =================================================== */
async function loadGuruOptions(selectedValue = "") {
    const selectWali = document.getElementById("wali-kelas-input");
    if (!selectWali) return;

    selectWali.innerHTML = '<option value="">-- Pilih Wali Kelas (Opsional) --</option>';

    try {
        const querySnapshot = await getDocs(collection(db, "guru"));
        listGuru = [];

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const namaGuru = data.nama || data.namaGuru || data.namaLengkap || "Tanpa Nama";
            listGuru.push({
                id: docSnap.id,
                nama: namaGuru
            });
        });

        // Urutkan nama guru A-Z
        listGuru.sort((a, b) => a.nama.localeCompare(b.nama));

        listGuru.forEach((guru) => {
            const option = document.createElement("option");
            option.value = guru.nama;
            option.textContent = guru.nama;
            selectWali.appendChild(option);
        });

        // Set nilai terpilih setelah option selesai di-render
        if (selectedValue) {
            selectWali.value = selectedValue;
        }
    } catch (error) {
        console.error("Gagal mengambil data guru dari database:", error);
    }
}

/* ===================================================
   1. LOGIKA KELAS (FIREBASE)
   =================================================== */

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

    // Atur Toolbar (dengan Null Safety)
    if (btnBack) btnBack.classList.add("hidden");
    if (pageTitle) pageTitle.innerText = "Data Santri Per Kelas";
    if (pageSubtitle) pageSubtitle.innerText = "Pilih kelas untuk melihat atau mengelola data santri.";
    if (btnTambahKelas) btnTambahKelas.classList.remove("hidden");
    if (btnTambahSantri) btnTambahSantri.classList.add("hidden");

    if (viewKelas) viewKelas.classList.remove("hidden");
    if (viewSantri) viewSantri.classList.add("hidden");

    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        listKelas = [];
        
        // Mengambil seluruh data kelas & jumlah santri tiap kelas secara paralel
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

        // Sorting Angka Alami (Natural Numerical Sort: Kelas 1, Kelas 2, Kelas 10, dst)
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

        if (gridContainer) gridContainer.innerHTML = cardsHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error("Gagal mengambil data kelas:", error);
    }
}

// Open Modal Tambah / Edit Kelas
window.openModalKelas = function(isEdit = false) {
    const modal = document.getElementById("modal-kelas");
    const title = document.getElementById("modal-kelas-title");
    const inputNama = document.getElementById("nama-kelas-input");

    let targetWali = "";

    if (isEdit && selectedKelasData) {
        if (title) title.innerText = "Edit Data Kelas";
        if (inputNama) inputNama.value = selectedKelasData.namaKelas || "";
        targetWali = selectedKelasData.waliKelas !== "-" ? selectedKelasData.waliKelas : "";
    } else {
        if (title) title.innerText = "Tambah Kelas Baru";
        if (inputNama) inputNama.value = "";
        targetWali = "";
    }

    // 1. Langsung buka modal agar responsif saat tombol diklik
    if (modal) modal.classList.add("active");

    // 2. Muat data guru di latar belakang tanpa memblokir pembukaan modal
    loadGuruOptions(targetWali);
};

window.closeModalKelas = function() {
    const modal = document.getElementById("modal-kelas");
    if (modal) modal.classList.remove("active");
};

// Simpan atau Edit Kelas ke Firebase
window.saveKelasData = async function(event) {
    event.preventDefault();
    const inputNama = document.getElementById("nama-kelas-input");
    const selectWali = document.getElementById("wali-kelas-input");
    
    const namaKelas = inputNama ? inputNama.value.trim() : "";
    const waliKelas = selectWali ? selectWali.value.trim() : "";
    
    if (!namaKelas) return;

    try {
        const titleText = document.getElementById("modal-kelas-title")?.innerText || "";
        if (selectedKelasId && titleText.includes("Edit")) {
            // Update Data Kelas
            const docRef = doc(db, "kelas", selectedKelasId);
            await updateDoc(docRef, {
                namaKelas: namaKelas,
                waliKelas: waliKelas || "-"
            });
        } else {
            // Tambah Kelas Baru
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

// Hapus Kelas beserta Akses Sub-menu
window.deleteKelasData = async function() {
    if (!selectedKelasId) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus "${selectedKelasData.namaKelas}"? Seluruh data santri di kelas ini juga akan terhapus.`)) return;

    try {
        await deleteDoc(doc(db, "kelas", selectedKelasId));
        alert("Kelas berhasil dihapus.");
        goBackToKelasList();
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

// Load Data Santri dari Sub-Collection "kelas/{kelasId}/santri"
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

    // Ambil Data Kelas Spesifik
    selectedKelasData = listKelas.find(k => k.id === kelasId) || { namaKelas: "Kelas", waliKelas: "-" };

    // Atur Toolbar
    if (btnBack) btnBack.classList.remove("hidden");
    if (pageTitle) pageTitle.innerText = `Data Santri - ${selectedKelasData.namaKelas}`;
    if (pageSubtitle) pageSubtitle.innerText = `Daftar nama-nama santri yang terdaftar di ${selectedKelasData.namaKelas}.`;
    if (btnTambahKelas) btnTambahKelas.classList.add("hidden");
    if (btnTambahSantri) btnTambahSantri.classList.remove("hidden");

    const elSubTitle = document.getElementById("sub-kelas-title");
    if (elSubTitle) elSubTitle.innerText = selectedKelasData.namaKelas;

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

        // HITUNG STATISTIK KELAS (Laki-laki & Perempuan)
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

        // Set Nilai ke Widget Compact Stat Strip
        const elStatWali = document.getElementById("stat-wali-kelas");
        const elStatTotal = document.getElementById("stat-total-santri");
        const elStatL = document.getElementById("stat-count-l");
        const elStatP = document.getElementById("stat-count-p");

        if (elStatWali) elStatWali.innerText = selectedKelasData.waliKelas || "-";
        if (elStatTotal) elStatTotal.innerText = `${totalSantri} Santri`;
        if (elStatL) elStatL.innerText = countLaki;
        if (elStatP) elStatP.innerText = countPerempuan;

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

    const setTxt = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setTxt("detail-santri-nama", santri.nama || "-");
    setTxt("detail-santri-jk", santri.jenisKelamin || "-");
    setTxt("detail-santri-nis", santri.nis || "- (Belum ada)");
    setTxt("detail-santri-ayah", santri.ayah || "- (Belum ada)");
    setTxt("detail-santri-ibu", santri.ibu || "- (Belum ada)");
    setTxt("detail-santri-hp", santri.hp || "- (Belum ada)");
    setTxt("detail-santri-alamat", santri.alamat || "- (Belum ada)");

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

// Populasikan Dropdown Pilih Kelas
function populateKelasSelect(selectedId = null) {
    const selectKelas = document.getElementById("santri-kelas");
    if (!selectKelas) return;

    selectKelas.innerHTML = "";
    listKelas.forEach((k) => {
        const option = document.createElement("option");
        option.value = k.id;
        option.textContent = k.namaKelas;
        if (selectedId && k.id === selectedId) {
            option.selected = true;
        } else if (!selectedId && k.id === selectedKelasId) {
            option.selected = true;
        }
        selectKelas.appendChild(option);
    });
}

window.openFormSantriModal = function(isEdit = false, santriId = null) {
    const modal = document.getElementById("modal-form-santri");
    const formTitle = document.getElementById("form-santri-title");

    // Render daftar kelas ke dropdown
    populateKelasSelect(selectedKelasId);

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    if (isEdit && santriId) {
        selectedSantriId = santriId;
        const santri = listSantri.find(s => s.id === santriId);

        if (formTitle) formTitle.innerText = "Edit Data Santri";
        setVal("santri-nama", santri ? santri.nama || "" : "");
        setVal("santri-jk", santri ? santri.jenisKelamin || "Laki-laki" : "Laki-laki");
        setVal("santri-nis", santri ? santri.nis || "" : "");
        setVal("santri-ayah", santri ? santri.ayah || "" : "");
        setVal("santri-ibu", santri ? santri.ibu || "" : "");
        setVal("santri-hp", santri ? santri.hp || "" : "");
        setVal("santri-alamat", santri ? santri.alamat || "" : "");

        setVal("santri-kelas", selectedKelasId);
    } else {
        selectedSantriId = null;
        if (formTitle) formTitle.innerText = "Tambah Data Santri";
        const form = document.getElementById("form-santri");
        if (form) form.reset();
        if (selectedKelasId) {
            setVal("santri-kelas", selectedKelasId);
        }
    }

    if (modal) modal.classList.add("active");
};

window.closeFormSantriModal = function() {
    const modal = document.getElementById("modal-form-santri");
    const form = document.getElementById("form-santri");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

// Simpan, Edit, atau Pindah Kelas Santri di Firebase
window.saveSantriData = async function(event) {
    event.preventDefault();

    const inputNama = document.getElementById("santri-nama");
    const selectKelas = document.getElementById("santri-kelas");

    const nama = inputNama ? inputNama.value.trim() : "";
    const targetKelasId = selectKelas ? selectKelas.value : selectedKelasId;

    if (!nama || !targetKelasId) return;

    const getVal = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : "";
    };

    const santriData = {
        nama: nama,
        jenisKelamin: getVal("santri-jk") || "Laki-laki",
        nis: getVal("santri-nis"),
        ayah: getVal("santri-ayah"),
        ibu: getVal("santri-ibu"),
        hp: getVal("santri-hp"),
        alamat: getVal("santri-alamat"),
        updatedAt: new Date()
    };

    try {
        if (selectedSantriId) {
            // JIKA PINDAH KELAS
            if (targetKelasId !== selectedKelasId) {
                // 1. Simpan/Buat dokumen di sub-koleksi kelas baru
                const newDocRef = doc(db, "kelas", targetKelasId, "santri", selectedSantriId);
                await setDoc(newDocRef, santriData);

                // 2. Hapus dokumen lama di sub-koleksi kelas lama
                const oldDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await deleteDoc(oldDocRef);

                // Update kelas aktif ke kelas baru
                selectedKelasId = targetKelasId;
            } else {
                // EDIT DATA DENGAN KELAS YANG SAMA
                const santriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await updateDoc(santriDocRef, santriData);
            }
        } else {
            // TAMBAH DATA BARU PADA KELAS TERPILIH
            santriData.createdAt = new Date();
            const santriRef = collection(db, "kelas", targetKelasId, "santri");
            await addDoc(santriRef, santriData);
            selectedKelasId = targetKelasId;
        }

        closeFormSantriModal();
        await renderMainView();
    } catch (error) {
        console.error("Gagal menyimpan data santri:", error);
        alert("Terjadi kesalahan saat menyimpan data santri.");
    }
};

// Hapus Santri dari Firebase
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
