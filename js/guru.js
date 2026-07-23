import { 
    db, 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc 
} from "./firebase-init.js";

// Variable Penyimpanan Data Guru dari Firebase
let listGuru = [];
let selectedGuruId = null;

document.addEventListener("layoutReady", function () {
    loadGuruFromFirebase();
});

/* ===================================================
   1. LOAD DATA GURU DARI FIREBASE
   =================================================== */
async function loadGuruFromFirebase() {
    const emptyState = document.getElementById("empty-state-guru");
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
                <div class="guru-item" onclick="openDetailGuruModal('${guru.id}')">
                    <div class="guru-item-left">
                        <div class="number-badge">${index + 1}</div>
                        <div>
                            <div class="guru-item-name">${guru.nama}</div>
                            <div class="guru-item-sub">${guru.mapel ? 'Pengampu: ' + guru.mapel : 'NIP/NIG: ' + (guru.nip || '-')}</div>
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
   2. DETAIL, EDIT & SIMPAN DATA GURU
   =================================================== */
window.openDetailGuruModal = function(guruId) {
    selectedGuruId = guruId;
    const guru = listGuru.find(g => g.id === guruId);
    if (!guru) return;

    document.getElementById("detail-guru-nama").innerText = guru.nama || "-";
    document.getElementById("detail-guru-nip").innerText = guru.nip || "- (Belum ada)";
    document.getElementById("detail-guru-mapel").innerText = guru.mapel || "- (Belum ada)";
    document.getElementById("detail-guru-hp").innerText = guru.hp || "- (Belum ada)";
    document.getElementById("detail-guru-alamat").innerText = guru.alamat || "- (Belum ada)";

    document.getElementById("btn-edit-guru").onclick = function () {
        closeDetailGuruModal();
        openFormGuruModal(true, guruId);
    };

    document.getElementById("btn-delete-guru").onclick = function () {
        deleteGuruData(guruId);
    };

    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.add("active");
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeDetailGuruModal = function() {
    const modal = document.getElementById("modal-detail-guru");
    if (modal) modal.classList.remove("active");
};

window.openFormGuruModal = function(isEdit = false, guruId = null) {
    const modal = document.getElementById("modal-form-guru");
    const formTitle = document.getElementById("form-guru-title");

    if (isEdit && guruId) {
        selectedGuruId = guruId;
        const guru = listGuru.find(g => g.id === guruId);

        if (formTitle) formTitle.innerText = "Edit Data Guru";
        document.getElementById("guru-nama").value = guru.nama || "";
        document.getElementById("guru-nip").value = guru.nip || "";
        document.getElementById("guru-mapel").value = guru.mapel || "";
        document.getElementById("guru-hp").value = guru.hp || "";
        document.getElementById("guru-alamat").value = guru.alamat || "";
    } else {
        selectedGuruId = null;
        if (formTitle) formTitle.innerText = "Tambah Data Guru";
        const form = document.getElementById("form-guru");
        if (form) form.reset();
    }

    if (modal) modal.classList.add("active");
};

window.closeFormGuruModal = function() {
    const modal = document.getElementById("modal-form-guru");
    const form = document.getElementById("form-guru");
    if (modal) modal.classList.remove("active");
    if (form) form.reset();
};

// Simpan atau Update Guru ke Firebase
window.saveGuruData = async function(event) {
    event.preventDefault();

    const nama = document.getElementById("guru-nama").value.trim();
    if (!nama) return;

    const guruData = {
        nama: nama,
        nip: document.getElementById("guru-nip").value.trim(),
        mapel: document.getElementById("guru-mapel").value.trim(),
        hp: document.getElementById("guru-hp").value.trim(),
        alamat: document.getElementById("guru-alamat").value.trim(),
        updatedAt: new Date()
    };

    try {
        if (selectedGuruId) {
            // EDIT / UPDATE DATA GURU
            const guruDocRef = doc(db, "guru", selectedGuruId);
            await updateDoc(guruDocRef, guruData);
        } else {
            // TAMBAH GURU BARU
            guruData.createdAt = new Date();
            await addDoc(collection(db, "guru"), guruData);
        }

        closeFormGuruModal();
        await loadGuruFromFirebase();
    } catch (error) {
        console.error("Gagal menyimpan data guru:", error);
        alert("Terjadi kesalahan saat menyimpan data guru.");
    }
};

// Hapus Data Guru
async function deleteGuruData(guruId) {
    if (!confirm("Apakah Anda yakin ingin menghapus data guru ini?")) return;

    try {
        const guruDocRef = doc(db, "guru", guruId);
        await deleteDoc(guruDocRef);

        closeDetailGuruModal();
        await loadGuruFromFirebase();
    } catch (error) {
        console.error("Gagal menghapus guru:", error);
        alert("Gagal menghapus data guru.");
    }
}
