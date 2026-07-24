import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc,
    setDoc // <-- TAMBAHAN: Dibutuhkan untuk memindah/menyalin data ke kelas baru
} from "./firebase-init.js";

// Variable Penyimpanan Sementara dari Firebase
let listKelas = [];       // Menyimpan daftar dokumen kelas
let listSantri = [];      // Menyimpan daftar santri pada kelas yang dipilih

let selectedKelasId = null;
let selectedKelasData = null;
let selectedSantriId = null;

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

    // Atur Toolbar
    btnBack.classList.add("hidden");
    pageTitle.innerText = "Data Santri Per Kelas";
    pageSubtitle.innerText = "Pilih kelas untuk melihat atau mengelola data santri.";
    btnTambahKelas.classList.remove("hidden");
    btnTambahSantri.classList.add("hidden");

    viewKelas.classList.remove("hidden");
    viewSantri.classList.add("hidden");

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
            emptyState.classList.remove("hidden");
            gridContainer.classList.add("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        gridContainer.classList.remove("hidden");

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

// Memuat daftar guru dari Firebase untuk Dropdown Wali Kelas
async function populateGuruDropdown(selectedGuruValue = "") {
    const waliSelect = document.getElementById("wali-kelas-input");
    if (!waliSelect) return;

    // Set loading state sementara data diambil
    waliSelect.innerHTML = `<option value="" disabled selected>-- Memuat daftar guru... --</option>`;

    try {
        const guruSnap = await getDocs(collection(db, "guru"));
        let listGuru = [];

        // Ambil nama dari setiap dokumen guru
        guruSnap.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.nama) {
                listGuru.push(data.nama);
            }
        });

        // Urutkan nama guru sesuai abjad
        listGuru.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        let optionsHtml = `<option value="" ${!selectedGuruValue ? 'selected' : ''}>-- Pilih Wali Kelas --</option>`;

        if (listGuru.length === 0) {
            optionsHtml = `<option value="" disabled>-- Belum ada data guru --</option>`;
        } else {
            listGuru.forEach((namaGuru) => {
                const isSelected = (namaGuru === selectedGuruValue) ? "selected" : "";
                optionsHtml += `<option value="${namaGuru}" ${isSelected}>${namaGuru}</option>`;
            });
        }

        waliSelect.innerHTML = optionsHtml;

    } catch (error) {
        console.error("Gagal memuat daftar guru:", error);
        waliSelect.innerHTML = `<option value="">-- Gagal memuat data guru --</option>`;
    }
}

// Open Modal Tambah / Edit Kelas
window.openModalKelas = async function(isEdit = false) {
    const modal = document.getElementById("modal-kelas");
    const title = document.getElementById("modal-kelas-title");
    const inputNama = document.getElementById("nama-kelas-input");
    
    // Variabel untuk menyimpan wali kelas saat mode edit
    let currentWali = "";

    if (isEdit && selectedKelasData) {
        title.innerText = "Edit Data Kelas";
        inputNama.value = selectedKelasData.namaKelas || "";
        currentWali = selectedKelasData.waliKelas !== "-" ? selectedKelasData.waliKelas : "";
    } else {
        title.innerText = "Tambah Kelas Baru";
        inputNama.value = "";
    }

    if (modal) modal.classList.add("active");

    // Jalankan fungsi populate dropdown guru setiap kali modal terbuka
    await populateGuruDropdown(currentWali);
};

window.closeModalKelas = function() {
    const modal = document.getElementById("modal-kelas");
    if (modal) modal.classList.remove("active");
};

// Simpan atau Edit Kelas ke Firebase
window.saveKelasData = async function(event) {
    event.preventDefault();
    const inputNama = document.getElementById("nama-kelas-input");
    const inputWali = document.getElementById("wali-kelas-input");
    const namaKelas = inputNama.value.trim();
    const waliKelas = inputWali.value.trim();
    
    if (!namaKelas) return;

    try {
        if (selectedKelasId && document.getElementById("modal-kelas-title").innerText.includes("Edit")) {
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
    btnBack.classList.remove("hidden");
    pageTitle.innerText = `Data Santri - ${selectedKelasData.namaKelas}`;
    pageSubtitle.innerText = `Daftar nama-nama santri yang terdaftar di ${selectedKelasData.namaKelas}.`;
    btnTambahKelas.classList.add("hidden");
    btnTambahSantri.classList.remove("hidden");

    document.getElementById("sub-kelas-title").innerText = selectedKelasData.namaKelas;

    viewKelas.classList.add("hidden");
    viewSantri.classList.remove("hidden");

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
        document.getElementById("stat-wali-kelas").innerText = selectedKelasData.waliKelas || "-";
        document.getElementById("stat-total-santri").innerText = `${totalSantri} Santri`;
        document.getElementById("stat-count-l").innerText = countLaki;
        document.getElementById("stat-count-p").innerText = countPerempuan;

        if (totalSantri === 0) {
            emptyState.classList.remove("hidden");
            listContainer.classList.add("hidden");
            return;
        }

        emptyState.classList.add("hidden");
        listContainer.classList.remove("hidden");

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

        listContainer.innerHTML = listHtml;
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

    document.getElementById("detail-santri-nama").innerText = santri.nama || "-";
    document.getElementById("detail-santri-jk").innerText = santri.jenisKelamin || "-";
    document.getElementById("detail-santri-nis").innerText = santri.nis || "- (Belum ada)";
    document.getElementById("detail-santri-ayah").innerText = santri.ayah || "- (Belum ada)";
    document.getElementById("detail-santri-ibu").innerText = santri.ibu || "- (Belum ada)";
    document.getElementById("detail-santri-hp").innerText = santri.hp || "- (Belum ada)";
    document.getElementById("detail-santri-alamat").innerText = santri.alamat || "- (Belum ada)";

    document.getElementById("btn-edit-santri").onclick = function () {
        closeDetailSantriModal();
        openFormSantriModal(true, santriId);
    };

    document.getElementById("btn-delete-santri").onclick = function () {
        deleteSantriData(santriId);
    };

    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeDetailSantriModal = function() {
    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.remove("active");
};

window.openFormSantriModal = function(isEdit = false, santriId = null) {
    const modal = document.getElementById("modal-form-santri");
    const formTitle = document.getElementById("form-santri-title");

    if (isEdit && santriId) {
        selectedSantriId = santriId;
        const santri = listSantri.find(s => s.id === santriId);

        formTitle.innerText = "Edit Data Santri";
        document.getElementById("santri-nama").value = santri.nama || "";
        document.getElementById("santri-jk").value = santri.jenisKelamin || "Laki-laki";
        document.getElementById("santri-nis").value = santri.nis || "";
        document.getElementById("santri-ayah").value = santri.ayah || "";
        document.getElementById("santri-ibu").value = santri.ibu || "";
        document.getElementById("santri-hp").value = santri.hp || "";
        document.getElementById("santri-alamat").value = santri.alamat || "";
    } else {
        selectedSantriId = null;
        formTitle.innerText = "Tambah Data Santri";
        document.getElementById("form-santri").reset();
    }
    
    // MENAMPILKAN SELURUH KELAS DI DROPDOWN AGAR BISA PINDAH KELAS
    const kelasSelect = document.getElementById("santri-kelas");
    if (kelasSelect) {
        let optionsHtml = "";
        listKelas.forEach(kelas => {
            // Default select ke kelas yang sedang aktif saat ini
            const isSelected = (kelas.id === selectedKelasId) ? "selected" : "";
            optionsHtml += `<option value="${kelas.id}" ${isSelected}>${kelas.namaKelas}</option>`;
        });
        kelasSelect.innerHTML = optionsHtml;
    }

    if (modal) modal.classList.add("active");
};

window.closeFormSantriModal = function() {
    const modal = document.getElementById("modal-form-santri");
    const form = document.getElementById("form-santri");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

// Simpan, Update, atau Pindahkan Santri ke Firebase
window.saveSantriData = async function(event) {
    event.preventDefault();

    const nama = document.getElementById("santri-nama").value.trim();
    if (!nama) return;

    // Ambil Kelas Tujuan dari Input Select
    const targetKelasId = document.getElementById("santri-kelas").value;

    const santriData = {
        nama: nama,
        jenisKelamin: document.getElementById("santri-jk").value,
        nis: document.getElementById("santri-nis").value.trim(),
        ayah: document.getElementById("santri-ayah").value.trim(),
        ibu: document.getElementById("santri-ibu").value.trim(),
        hp: document.getElementById("santri-hp").value.trim(),
        alamat: document.getElementById("santri-alamat").value.trim(),
        updatedAt: new Date()
    };

    try {
        if (selectedSantriId) {
            // LOGIKA KETIKA EDIT: CEK APAKAH USER MEMILIH KELAS YANG BERBEDA
            if (targetKelasId !== selectedKelasId) {
                // PINDAH KELAS TERJADI
                // 1. Ambil data lama secara utuh (contoh: createdAt) agar tidak hilang saat dipindah
                const existingSantri = listSantri.find(s => s.id === selectedSantriId);
                const fullSantriData = { ...existingSantri, ...santriData };
                delete fullSantriData.id; // Hapus properti "id" agar tidak masuk sebagai field database

                // 2. Buat dokumen baru di sub-koleksi kelas yang baru (dengan ID yang sama)
                const newSantriDocRef = doc(db, "kelas", targetKelasId, "santri", selectedSantriId);
                await setDoc(newSantriDocRef, fullSantriData);

                // 3. Hapus dokumen lama dari sub-koleksi kelas asal
                const oldSantriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await deleteDoc(oldSantriDocRef);

            } else {
                // KELAS TETAP SAMA: Update data biasa
                const santriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
                await updateDoc(santriDocRef, santriData);
            }
        } else {
            // LOGIKA TAMBAH DATA BARU
            santriData.createdAt = new Date();
            // Masukkan santri ke kelas target sesuai dropdown (targetKelasId)
            const santriRef = collection(db, "kelas", targetKelasId, "santri");
            await addDoc(santriRef, santriData);
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
