// Memory Data Sementara Bertingkat (Kelas -> List Santri)
let dataKelas = [];
let selectedKelasIndex = null;
let selectedSantriIndex = null;

document.addEventListener("layoutReady", function () {
    renderMainView();
});

// Render Tampilan Utama (Cek apakah sedang di View Kelas / View Sub-Menu Santri)
function renderMainView() {
    if (selectedKelasIndex === null) {
        // Tampilan 1: Daftar Kelas
        renderKelasList();
    } else {
        // Tampilan 2: Sub-Menu Santri dalam Kelas tertentu
        renderSantriList(selectedKelasIndex);
    }
}

/* ===================================================
   LOGIKA VIEW 1: KELAS
   =================================================== */
function renderKelasList() {
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

    if (dataKelas.length === 0) {
        emptyState.classList.remove("hidden");
        gridContainer.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    gridContainer.classList.remove("hidden");

    let cardsHtml = "";
    dataKelas.forEach((kelas, index) => {
        const jumlahSantri = kelas.santriList ? kelas.santriList.length : 0;
        cardsHtml += `
            <div class="kelas-card-item" onclick="openSantriSubMenu(${index})">
                <div class="kelas-info">
                    <div class="kelas-name">${kelas.namaKelas}</div>
                    <div class="kelas-count">${jumlahSantri} Santri Terdaftar</div>
                </div>
                <i data-lucide="chevron-right" class="chevron-icon"></i>
            </div>
        `;
    });

    gridContainer.innerHTML = cardsHtml;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openModalKelas() {
    const modal = document.getElementById("modal-kelas");
    if (modal) modal.classList.add("active");
}

function closeModalKelas() {
    const modal = document.getElementById("modal-kelas");
    const input = document.getElementById("nama-kelas-input");
    if (modal) modal.classList.remove("active");
    if (input) input.value = "";
}

function saveKelasData(event) {
    event.preventDefault();
    const namaKelas = document.getElementById("nama-kelas-input").value.trim();
    if (!namaKelas) return;

    dataKelas.push({
        namaKelas: namaKelas,
        santriList: []
    });

    closeModalKelas();
    renderMainView();
}

/* ===================================================
   LOGIKA VIEW 2: SUB-MENU SANTRI (Nomor Urut 1, 2, 3...)
   =================================================== */
function openSantriSubMenu(kelasIndex) {
    selectedKelasIndex = kelasIndex;
    renderMainView();
}

function goBackToKelasList() {
    selectedKelasIndex = null;
    selectedSantriIndex = null;
    renderMainView();
}

function renderSantriList(kelasIndex) {
    const viewKelas = document.getElementById("view-kelas");
    const viewSantri = document.getElementById("view-santri");
    const emptyState = document.getElementById("empty-state-santri");
    const listContainer = document.getElementById("santri-list-container");

    const btnBack = document.getElementById("btn-back-kelas");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");
    const btnTambahKelas = document.getElementById("btn-tambah-kelas");
    const btnTambahSantri = document.getElementById("btn-tambah-santri");

    const currentKelas = dataKelas[kelasIndex];

    // Atur Toolbar
    btnBack.classList.remove("hidden");
    pageTitle.innerText = `Data Santri - ${currentKelas.namaKelas}`;
    pageSubtitle.innerText = `Daftar nama-nama santri yang terdaftar di ${currentKelas.namaKelas}.`;
    btnTambahKelas.classList.add("hidden");
    btnTambahSantri.classList.remove("hidden");

    viewKelas.classList.add("hidden");
    viewSantri.classList.remove("hidden");

    const list = currentKelas.santriList || [];

    if (list.length === 0) {
        emptyState.classList.remove("hidden");
        listContainer.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    listContainer.classList.remove("hidden");

    let listHtml = "";
    list.forEach((santri, index) => {
        listHtml += `
            <div class="santri-item" onclick="openDetailSantriModal(${index})">
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
}

/* ===================================================
   DETAIL, EDIT & SIMPAN DATA SANTRI
   =================================================== */
function openDetailSantriModal(index) {
    selectedSantriIndex = index;
    const santri = dataKelas[selectedKelasIndex].santriList[index];

    document.getElementById("detail-santri-nama").innerText = santri.nama || "-";
    document.getElementById("detail-santri-nis").innerText = santri.nis || "- (Belum ada)";
    document.getElementById("detail-santri-ayah").innerText = santri.ayah || "- (Belum ada)";
    document.getElementById("detail-santri-ibu").innerText = santri.ibu || "- (Belum ada)";
    document.getElementById("detail-santri-hp").innerText = santri.hp || "- (Belum ada)";
    document.getElementById("detail-santri-alamat").innerText = santri.alamat || "- (Belum ada)";

    document.getElementById("btn-edit-santri").onclick = function () {
        closeDetailSantriModal();
        openFormSantriModal(true, index);
    };

    document.getElementById("btn-delete-santri").onclick = function () {
        deleteSantriData(index);
    };

    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeDetailSantriModal() {
    const modal = document.getElementById("modal-detail-santri");
    if (modal) modal.classList.remove("active");
}

function openFormSantriModal(isEdit = false, index = null) {
    const modal = document.getElementById("modal-form-santri");
    const formTitle = document.getElementById("form-santri-title");

    if (isEdit && index !== null) {
        selectedSantriIndex = index;
        const santri = dataKelas[selectedKelasIndex].santriList[index];

        formTitle.innerText = "Edit Data Santri";
        document.getElementById("santri-nama").value = santri.nama || "";
        document.getElementById("santri-nis").value = santri.nis || "";
        document.getElementById("santri-ayah").value = santri.ayah || "";
        document.getElementById("santri-ibu").value = santri.ibu || "";
        document.getElementById("santri-hp").value = santri.hp || "";
        document.getElementById("santri-alamat").value = santri.alamat || "";
    } else {
        selectedSantriIndex = null;
        formTitle.innerText = "Tambah Data Santri";
        document.getElementById("form-santri").reset();
    }

    if (modal) modal.classList.add("active");
}

function closeFormSantriModal() {
    const modal = document.getElementById("modal-form-santri");
    const form = document.getElementById("form-santri");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
}

// Simpan Data Santri (Tombol Selalu Aktif, Data Tidak Wajib Terisi Semua)
function saveSantriData(event) {
    event.preventDefault();

    const nama = document.getElementById("santri-nama").value.trim();
    if (!nama) return; // Hanya butuh Nama Santri minimal

    const santriObj = {
        nama: nama,
        nis: document.getElementById("santri-nis").value.trim(),
        ayah: document.getElementById("santri-ayah").value.trim(),
        ibu: document.getElementById("santri-ibu").value.trim(),
        hp: document.getElementById("santri-hp").value.trim(),
        alamat: document.getElementById("santri-alamat").value.trim()
    };

    if (selectedSantriIndex !== null) {
        // Edit Mode
        dataKelas[selectedKelasIndex].santriList[selectedSantriIndex] = santriObj;
    } else {
        // Tambah Mode
        dataKelas[selectedKelasIndex].santriList.push(santriObj);
    }

    closeFormSantriModal();
    renderMainView();
}

function deleteSantriData(index) {
    dataKelas[selectedKelasIndex].santriList.splice(index, 1);
    closeDetailSantriModal();
    renderMainView();
}
