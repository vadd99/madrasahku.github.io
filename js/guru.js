import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc 
} from "./firebase-init.js";

// Variable Penyimpanan Data Guru
let listGuru = [];
let selectedGuruId = null;

document.addEventListener("layoutReady", function () {
    loadGuruFromFirebase();
});

/* ===================================================
   1. LOAD DATA GURU DARI FIREBASE
   =================================================== */
async function loadGuruFromFirebase() {
    const emptyState = document.getElementById("empty-state");
    const listContainer = document.getElementById("guru-list-container");

    try {
        const querySnapshot = await getDocs(collection(db, "guru"));
        listGuru = [];

        querySnapshot.forEach((docSnap) => {
            listGuru.push({
                id: docSnap.id,
                ...docSnap.data()
            });
        });

        if (listGuru.length === 0) {
            if (emptyState) emptyState.classList.remove("hidden");
            if (listContainer) listContainer.classList.add("hidden");
            return;
        }

        if (emptyState) emptyState.classList.add("hidden");
        if (listContainer) listContainer.classList.remove("hidden");

        let listHtml = "";
        listGuru.forEach((guru, index) => {
            listHtml += `
                <div class="guru-item" onclick="openDetailModal('${guru.id}')">
                    <div class="guru-item-left">
                        <div class="number-badge">${index + 1}</div>
                        <div>
                            <div class="guru-item-name">${guru.nama}</div>
                            <div class="guru-item-sub">Pengampu: ${guru.kelasAjar || '-'}</div>
                        </div>
                    </div>
                    <i data-lucide="chevron-right" class="chevron-icon"></i>
                </div>
            `;
        });

        if (listContainer) listContainer.innerHTML = listHtml;
        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error("Gagal mengambil data guru:", error);
    }
}

/* ===================================================
   2. DETAIL MODAL (LIHAT DATA)
   =================================================== */
window.openDetailModal = function(guruId) {
    selectedGuruId = guruId;
    const guru = listGuru.find(g => g.id === guruId);
    if (!guru) return;

    document.getElementById("detail-nama").innerText = guru.nama || "-";
    document.getElementById("detail-kelas").innerText = guru.kelasAjar || "-";
    document.getElementById("detail-hp").innerText = guru.hp || "-";
    document.getElementById("detail-alamat").innerText = guru.alamat || "-";

    document.getElementById("btn-action-edit").onclick = function () {
        closeDetailModal();
        openFormModal(true, guruId);
    };

    document.getElementById("btn-action-delete").onclick = function () {
        deleteGuruData(guruId);
    };

    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeDetailModal = function() {
    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.remove("active");
};

/* ===================================================
   3. FORM MODAL (TAMBAH & EDIT GURU)
   =================================================== */
window.openFormModal = function(isEdit = false, guruId = null) {
    const modal = document.getElementById("modal-form-guru");
    const formTitle = document.getElementById("form-title");

    if (isEdit && guruId) {
        selectedGuruId = guruId;
        const guru = listGuru.find(g => g.id === guruId);

        if (formTitle) formTitle.innerText = "Edit Data Guru";
        document.getElementById("nama-guru").value = guru.nama || "";
        document.getElementById("kelas-ajar").value = guru.kelasAjar || "";
        document.getElementById("no-hp").value = guru.hp || "";
        document.getElementById("alamat-guru").value = guru.alamat || "";
    } else {
        selectedGuruId = null;
        if (formTitle) formTitle.innerText = "Tambah Data Guru";
        const form = document.getElementById("form-guru");
        if (form) form.reset();
    }

    if (modal) modal.classList.add("active");
};

window.closeFormModal = function() {
    const modal = document.getElementById("modal-form-guru");
    const form = document.getElementById("form-guru");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

/* ===================================================
   4. SIMPAN DATA KE FIREBASE
   =================================================== */
window.saveGuruData = async function(event) {
    event.preventDefault();

    const nama = document.getElementById("nama-guru").value.trim();
    if (!nama) return;

    const guruData = {
        nama: nama,
        kelasAjar: document.getElementById("kelas-ajar").value,
        hp: document.getElementById("no-hp").value.trim(),
        alamat: document.getElementById("alamat-guru").value.trim(),
        updatedAt: new Date()
    };

    try {
        if (selectedGuruId) {
            // Edit Data
            const guruDocRef = doc(db, "guru", selectedGuruId);
            await updateDoc(guruDocRef, guruData);
        } else {
            // Tambah Data Baru
            guruData.createdAt = new Date();
            await addDoc(collection(db, "guru"), guruData);
        }

        closeFormModal();
        await loadGuruFromFirebase();
    } catch (error) {
        console.error("Gagal menyimpan data guru:", error);
        alert("Terjadi kesalahan saat menyimpan data guru.");
    }
};

/* ===================================================
   5. HAPUS DATA GURU
   =================================================== */
async function deleteGuruData(guruId) {
    if (!confirm("Apakah Anda yakin ingin menghapus data guru ini?")) return;

    try {
        const guruDocRef = doc(db, "guru", guruId);
        await deleteDoc(guruDocRef);

        closeDetailModal();
        await loadGuruFromFirebase();
    } catch (error) {
        console.error("Gagal menghapus guru:", error);
        alert("Gagal menghapus data guru.");
    }
}
