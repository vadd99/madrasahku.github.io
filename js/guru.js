// Memory Data Sementara
let listGuru = [];
let activeGuruIndex = null;

document.addEventListener("layoutReady", function () {
    renderGuruList();
    setupFormValidationListeners(); // Pasang pantauan input form
});

// Fungsi Memantau Kelengkapan Form Input
function checkFormValidity() {
    const nama = document.getElementById("nama-guru")?.value.trim();
    const kelas = document.getElementById("kelas-ajar")?.value;
    const noHp = document.getElementById("no-hp")?.value.trim();
    const alamat = document.getElementById("alamat-guru")?.value.trim();
    const btnSimpan = document.getElementById("btn-simpan-guru");

    if (!btnSimpan) return;

    // Cek apakah semua input terisi
    const isValid = nama !== "" && kelas !== "" && kelas !== null && noHp !== "" && alamat !== "";

    // Aktifkan / Matikan tombol simpan
    btnSimpan.disabled = !isValid;
}

// Pasang Event Listener pada Setiap Field Input
function setupFormValidationListeners() {
    const form = document.getElementById("form-guru");
    if (!form) return;

    const inputs = form.querySelectorAll("input, select, textarea");
    inputs.forEach(input => {
        input.addEventListener("input", checkFormValidity);
        input.addEventListener("change", checkFormValidity);
    });
}

// Render Tampilan List Guru
function renderGuruList() {
    const emptyState = document.getElementById("empty-state");
    const listContainer = document.getElementById("guru-list-container");

    if (!emptyState || !listContainer) return;

    if (listGuru.length === 0) {
        emptyState.classList.remove("hidden");
        listContainer.classList.add("hidden");
        return;
    }

    emptyState.classList.add("hidden");
    listContainer.classList.remove("hidden");

    let cardsHtml = "";
    listGuru.forEach((guru, index) => {
        cardsHtml += `
            <div class="guru-card-item" onclick="openDetailModal(${index})">
                <div class="guru-info">
                    <div class="guru-name">${guru.nama}</div>
                    <div><span class="badge">${guru.kelas}</span></div>
                </div>
                <i data-lucide="chevron-right" class="chevron-icon"></i>
            </div>
        `;
    });

    listContainer.innerHTML = cardsHtml;

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Handler Modal Detail
function openDetailModal(index) {
    activeGuruIndex = index;
    const guru = listGuru[index];

    document.getElementById("detail-nama").innerText = guru.nama;
    document.getElementById("detail-kelas").innerText = guru.kelas;
    document.getElementById("detail-hp").innerText = guru.noHp;
    document.getElementById("detail-alamat").innerText = guru.alamat;

    document.getElementById("btn-action-edit").onclick = function () {
        closeDetailModal();
        openFormModal(true, index);
    };

    document.getElementById("btn-action-delete").onclick = function () {
        deleteGuruData(index);
    };

    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.add("active");

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function closeDetailModal() {
    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.remove("active");
    activeGuruIndex = null;
}

// Handler Modal Form (Tambah / Edit)
function openFormModal(isEdit = false, index = null) {
    const modal = document.getElementById("modal-form-guru");
    const formTitle = document.getElementById("form-title");
    
    if (isEdit && index !== null) {
        activeGuruIndex = index;
        const guru = listGuru[index];
        
        formTitle.innerText = "Edit Data Guru";
        document.getElementById("nama-guru").value = guru.nama;
        document.getElementById("kelas-ajar").value = guru.kelas;
        document.getElementById("no-hp").value = guru.noHp;
        document.getElementById("alamat-guru").value = guru.alamat;
    } else {
        activeGuruIndex = null;
        formTitle.innerText = "Tambah Data Guru";
        document.getElementById("form-guru").reset();
    }

    if (modal) modal.classList.add("active");
    
    // Cek status validasi saat modal dibuka
    checkFormValidity();
}

function closeFormModal() {
    const modal = document.getElementById("modal-form-guru");
    const form = document.getElementById("form-guru");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
    activeGuruIndex = null;
    checkFormValidity();
}

// Simpan Data
function saveGuruData(event) {
    event.preventDefault();

    const nama = document.getElementById("nama-guru").value.trim();
    const kelas = document.getElementById("kelas-ajar").value;
    const noHp = document.getElementById("no-hp").value.trim();
    const alamat = document.getElementById("alamat-guru").value.trim();

    if (!nama || !kelas || !noHp || !alamat) return;

    if (activeGuruIndex !== null) {
        listGuru[activeGuruIndex] = { nama, kelas, noHp, alamat };
    } else {
        listGuru.push({ nama, kelas, noHp, alamat });
    }

    renderGuruList();
    closeFormModal();
}

// Hapus Data
function deleteGuruData(index) {
    listGuru.splice(index, 1);
    closeDetailModal();
    renderGuruList();
}
