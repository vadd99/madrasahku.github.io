// Array Memory Sementara (Akan tereset saat halaman di-refresh)
let listGuru = [];

// Event Listener menunggu Komponen Layout siap dari main.js
document.addEventListener("layoutReady", function () {
    renderGuruTable();
});

// Fungsi Buka Modal
function openGuruModal() {
    const modal = document.getElementById("modal-guru");
    if (modal) {
        modal.classList.add("active");
    }
}

// Fungsi Tutup Modal & Reset Input
function closeGuruModal() {
    const modal = document.getElementById("modal-guru");
    const form = document.getElementById("form-tambah-guru");
    if (modal) {
        modal.classList.remove("active");
    }
    if (form) {
        form.reset();
    }
}

// Fungsi Simpan Data Sementara
function saveGuruData(event) {
    event.preventDefault(); // Mencegah reload form browser

    // Ambil Nilai dari Input Form
    const nama = document.getElementById("nama-guru").value.trim();
    const kelas = document.getElementById("kelas-ajar").value;
    const noHp = document.getElementById("no-hp").value.trim();
    const alamat = document.getElementById("alamat-guru").value.trim();

    if (!nama || !kelas || !noHp || !alamat) return;

    // Masukkan ke Array
    listGuru.push({
        id: Date.now(),
        nama: nama,
        kelas: kelas,
        noHp: noHp,
        alamat: alamat
    });

    // Refresh Tampilan Tabel & Tutup Modal
    renderGuruTable();
    closeGuruModal();
}

// Fungsi Hapus Baris Data
function deleteGuruData(index) {
    listGuru.splice(index, 1);
    renderGuruTable();
}

// Fungsi Render / Render Ulang Tabel Data Guru
function renderGuruTable() {
    const emptyState = document.getElementById("empty-state");
    const tableWrapper = document.getElementById("table-wrapper");
    const tableBody = document.getElementById("guru-table-body");

    if (!emptyState || !tableWrapper || !tableBody) return;

    // Jika Data Kosong
    if (listGuru.length === 0) {
        emptyState.classList.remove("hidden");
        tableWrapper.classList.add("hidden");
        return;
    }

    // Jika Data Ada
    emptyState.classList.add("hidden");
    tableWrapper.classList.remove("hidden");

    // Susun HTML Baris Tabel
    let tableRows = "";
    listGuru.forEach((guru, index) => {
        tableRows += `
            <tr>
                <td><strong>${index + 1}</strong></td>
                <td>
                    <div style="font-weight: 600;">${guru.nama}</div>
                </td>
                <td>
                    <span class="badge">${guru.kelas}</span>
                </td>
                <td>${guru.noHp}</td>
                <td>${guru.alamat}</td>
                <td class="text-center">
                    <button class="btn-delete-row" title="Hapus Data" onclick="deleteGuruData(${index})">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    tableBody.innerHTML = tableRows;

    // Re-render Ikon Lucide untuk elemen yang baru dirender
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}
