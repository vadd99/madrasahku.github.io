import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc 
} from "./firebase-init.js";

// Variable Penyimpanan Sementara dari Firebase
let listKelas = [];       // Menyimpan daftar dokumen kelas
let listSantri = [];      // Menyimpan daftar santri pada kelas yang dipilih

let selectedKelasId = null;
let selectedKelasNama = "";
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

// Load Data Kelas dari Collection "kelas" di Firestore
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
        // Ambil data dari koleksi 'kelas'
        const querySnapshot = await getDocs(collection(db, "kelas"));
        listKelas = [];
        
        querySnapshot.forEach((docSnap) => {
            listKelas.push({
                id: docSnap.id,
                ...docSnap.data()
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
                <div class="kelas-card-item" onclick="openSantriSubMenu('${kelas.id}', '${kelas.namaKelas}')">
                    <div class="kelas-info">
                        <div class="kelas-name">${kelas.namaKelas}</div>
                        <div class="kelas-count">Klik untuk lihat santri</div>
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

// Simpan Kelas Baru ke Firebase
window.saveKelasData = async function(event) {
    event.preventDefault();
    const inputKelas = document.getElementById("nama-kelas-input");
    const namaKelas = inputKelas.value.trim();
    
    if (!namaKelas) return;

    try {
        await addDoc(collection(db, "kelas"), {
            namaKelas: namaKelas,
            createdAt: new Date()
        });

        closeModalKelas();
        await renderMainView();
    } catch (error) {
        console.error("Gagal menyimpan kelas:", error);
        alert("Gagal menyimpan data kelas.");
    }
};

window.openModalKelas = function() {
    const modal = document.getElementById("modal-kelas");
    if (modal) modal.classList.add("active");
};

window.closeModalKelas = function() {
    const modal = document.getElementById("modal-kelas");
    const input = document.getElementById("nama-kelas-input");
    if (modal) modal.classList.remove("active");
    if (input) input.value = "";
};

/* ===================================================
   2. LOGIKA SUB-MENU SANTRI (FIREBASE)
   =================================================== */

window.openSantriSubMenu = function(kelasId, namaKelas) {
    selectedKelasId = kelasId;
    selectedKelasNama = namaKelas;
    renderMainView();
};

window.goBackToKelasList = function() {
    selectedKelasId = null;
    selectedKelasNama = "";
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

    // Atur Toolbar
    btnBack.classList.remove("hidden");
    pageTitle.innerText = `Data Santri - ${selectedKelasNama}`;
    pageSubtitle.innerText = `Daftar nama-nama santri yang terdaftar di ${selectedKelasNama}.`;
    btnTambahKelas.classList.add("hidden");
    btnTambahSantri.classList.remove("hidden");

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

        if (listSantri.length === 0) {
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
                            <div class="santri-item-nis">${santri.nis ? 'NIS: ' + santri.nis : 'NIS: -'}</div>
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

    if (modal) modal.classList.add("active");
};

window.closeFormSantriModal = function() {
    const modal = document.getElementById("modal-form-santri");
    const form = document.getElementById("form-santri");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

// Simpan atau Update Santri ke Firebase
window.saveSantriData = async function(event) {
    event.preventDefault();

    const nama = document.getElementById("santri-nama").value.trim();
    if (!nama) return;

    const santriData = {
        nama: nama,
        nis: document.getElementById("santri-nis").value.trim(),
        ayah: document.getElementById("santri-ayah").value.trim(),
        ibu: document.getElementById("santri-ibu").value.trim(),
        hp: document.getElementById("santri-hp").value.trim(),
        alamat: document.getElementById("santri-alamat").value.trim(),
        updatedAt: new Date()
    };

    try {
        if (selectedSantriId) {
            // EDIT / UPDATE DATA
            const santriDocRef = doc(db, "kelas", selectedKelasId, "santri", selectedSantriId);
            await updateDoc(santriDocRef, santriData);
        } else {
            // TAMBAH DATA BARU
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
