import { 
    db, 
    collection, 
    getDocs 
} from "./firebase-init.js";

document.addEventListener("layoutReady", function () {
    loadDashboardData();
});

async function loadDashboardData() {
    const totalSantriEl = document.getElementById("total-santri-value");
    const totalGuruEl = document.getElementById("total-guru-value");
    const classesGridEl = document.getElementById("stats-grid-classes");

    try {
        // 1. Ambil Data Guru dari Firestore
        const guruSnap = await getDocs(collection(db, "guru"));
        if (totalGuruEl) {
            totalGuruEl.innerText = guruSnap.size;
        }

        // 2. Ambil Data Kelas & Santri
        const kelasSnap = await getDocs(collection(db, "kelas"));
        
        let grandTotalSantri = 0;
        let listKelas = [];

        // Hitung total santri per kelas secara asynchronous
        const kelasPromises = kelasSnap.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const santriSnap = await getDocs(collection(db, "kelas", docSnap.id, "santri"));
            const countSantri = santriSnap.size;
            
            grandTotalSantri += countSantri;

            return {
                id: docSnap.id,
                namaKelas: data.namaKelas || data.nama || "Kelas",
                waliKelas: data.waliKelas && data.waliKelas !== "-" ? data.waliKelas : "Aktif",
                totalSantri: countSantri
            };
        });

        listKelas = await Promise.all(kelasPromises);

        // Update Total Santri Keseluruhan di Card Atas
        if (totalSantriEl) {
            totalSantriEl.innerText = grandTotalSantri;
        }

        // Urutkan kelas secara alami (Kelas 1, Kelas 2, Kelas 10, dsb.)
        listKelas.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true }));

        // 3. Render Card Kelas ke Grid
        if (classesGridEl) {
            if (listKelas.length === 0) {
                classesGridEl.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px 0;">
                        Belum ada data kelas yang dibuat.
                    </div>
                `;
                return;
            }

            let htmlCards = "";
            listKelas.forEach((kelas) => {
                htmlCards += `
                    <div class="class-card">
                        <div class="class-card-top">
                            <span class="class-badge" title="Wali Kelas">${kelas.waliKelas}</span>
                            <i data-lucide="book-open" class="class-card-icon"></i>
                        </div>
                        <div class="class-name">${kelas.namaKelas}</div>
                        <div class="class-value">${kelas.totalSantri}</div>
                        <div class="class-label">Santri</div>
                    </div>
                `;
            });

            classesGridEl.innerHTML = htmlCards;

            // Render ulang ikon Lucide
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        }

    } catch (error) {
        console.error("Gagal memuat data dashboard:", error);
        if (classesGridEl) {
            classesGridEl.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 20px 0;">
                    Gagal mengambil data dari database.
                </div>
            `;
        }
    }
}
