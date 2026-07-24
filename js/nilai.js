import { db, collection, getDocs, doc, getDoc, setDoc } from "./firebase-init.js";

let listSantri = [];
let totalUH = 1; // Default jumlah ulangan harian
let currentKelasId = "";
let currentImtihan = "";
let currentMapel = "";

document.addEventListener("layoutReady", async function () {
    await loadKelasOptions();
    if (typeof lucide !== 'undefined') lucide.createIcons();
});

// 1. Load Opsi Kelas ke Dropdown
async function loadKelasOptions() {
    const selectKelas = document.getElementById("filter-kelas");
    selectKelas.innerHTML = '<option value="">-- Pilih Kelas --</option>';

    try {
        const querySnapshot = await getDocs(collection(db, "kelas"));
        let kelasArray = [];
        
        querySnapshot.forEach((docSnap) => {
            kelasArray.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Urutkan kelas 1, 2, 3..
        kelasArray.sort((a, b) => a.namaKelas.localeCompare(b.namaKelas, undefined, { numeric: true }));

        kelasArray.forEach(k => {
            selectKelas.innerHTML += `<option value="${k.id}">${k.namaKelas}</option>`;
        });
    } catch (error) {
        console.error("Gagal memuat kelas:", error);
    }
}

// 2. Load Form Nilai dan Ambil Data Existing
window.loadFormNilai = async function() {
    const kelasId = document.getElementById("filter-kelas").value;
    const imtihan = document.getElementById("filter-imtihan").value;
    const mapel = document.getElementById("filter-mapel").value.trim();

    if (!kelasId) return alert("Pilih kelas terlebih dahulu!");
    if (!mapel) return alert("Isi Mata Pelajaran terlebih dahulu!");

    // Set variable global
    currentKelasId = kelasId;
    currentImtihan = imtihan;
    currentMapel = mapel;

    document.getElementById("judul-tabel-nilai").innerText = `Form Nilai: ${mapel} - ${imtihan}`;

    try {
        // A. Ambil Data Santri
        const santriRef = collection(db, "kelas", kelasId, "santri");
        const santriSnap = await getDocs(santriRef);
        
        listSantri = [];
        santriSnap.forEach(doc => {
            listSantri.push({ id: doc.id, nama: doc.data().nama });
        });

        // Sort Abjad
        listSantri.sort((a, b) => a.nama.localeCompare(b.nama));

        if (listSantri.length === 0) {
            document.getElementById("nilai-container").classList.add("hidden");
            document.getElementById("empty-state-nilai").classList.remove("hidden");
            return;
        }

        document.getElementById("empty-state-nilai").classList.add("hidden");
        document.getElementById("nilai-container").classList.remove("hidden");

        // B. Cek apakah sudah ada nilai tersimpan di Firebase
        const docId = `${imtihan.replace(/\s+/g, '_')}_${mapel.replace(/\s+/g, '_').toLowerCase()}`;
        const nilaiDocRef = doc(db, "kelas", kelasId, "rekap_nilai", docId);
        const nilaiDocSnap = await getDoc(nilaiDocRef);

        let savedData = {};
        if (nilaiDocSnap.exists()) {
            const data = nilaiDocSnap.data();
            totalUH = data.totalUH || 1; // Load jumlah kolom UH terakhir disave
            savedData = data.nilaiData || {};
        } else {
            totalUH = 1; // Reset ke 1 jika belum ada data
        }

        renderTabelNilai(savedData);

    } catch (error) {
        console.error("Gagal memuat form:", error);
    }
}

// 3. Render Tabel Header dan Baris Santri
function renderTabelNilai(savedData = {}) {
    const headerRow = document.getElementById("tabel-header-row");
    const tbody = document.getElementById("tabel-body-nilai");

    // Render Header Dinamis
    let headerHTML = `<th class="col-no">No</th><th class="col-nama">Nama Santri</th>`;
    for (let i = 1; i <= totalUH; i++) {
        headerHTML += `<th class="col-uh">UH ${i}</th>`;
    }
    // Tambah kolom Rata-Rata (Opsional, untuk profesionalitas)
    headerHTML += `<th class="col-avg">Rata-rata</th>`;
    headerRow.innerHTML = headerHTML;

    // Render Baris Santri
    let bodyHTML = "";
    listSantri.forEach((santri, index) => {
        let rowHTML = `<tr class="santri-row" data-id="${santri.id}">
            <td class="col-no text-center">${index + 1}</td>
            <td class="col-nama font-semibold">${santri.nama}</td>`;
        
        let totalNilai = 0;
        let countIsi = 0;

        for (let i = 1; i <= totalUH; i++) {
            // Ambil nilai tersimpan atau kosong
            let nilai = savedData[santri.id] ? (savedData[santri.id][`uh${i}`] || "") : "";
            if (nilai !== "") {
                totalNilai += Number(nilai);
                countIsi++;
            }

            rowHTML += `<td class="col-uh">
                <input type="number" class="input-nilai input-uh-${i}" min="0" max="100" value="${nilai}" oninput="hitungRataRata('${santri.id}')">
            </td>`;
        }

        let avg = countIsi > 0 ? (totalNilai / countIsi).toFixed(1) : "0";

        rowHTML += `<td class="col-avg text-center font-bold text-accent" id="avg-${santri.id}">${avg}</td></tr>`;
        bodyHTML += rowHTML;
    });

    tbody.innerHTML = bodyHTML;
}

// 4. Tambah Kolom UH
window.tambahKolomUH = function() {
    if (totalUH >= 10) return alert("Maksimal 10 Ulangan Harian!");
    
    // Simpan data inputan saat ini sebelum render ulang
    const currentInputData = captureCurrentInputs();
    
    totalUH++;
    renderTabelNilai(currentInputData);
}

// 5. Hapus Kolom UH
window.hapusKolomUHTerakhir = function() {
    if (totalUH <= 1) return alert("Minimal harus ada 1 Ulangan Harian!");
    
    if(!confirm(`Hapus kolom UH ${totalUH}? Data di kolom tersebut akan hilang.`)) return;

    const currentInputData = captureCurrentInputs();
    totalUH--;
    renderTabelNilai(currentInputData);
}

// 6. Ambil data inputan yang belum disave (mencegah reset saat tambah kolom)
function captureCurrentInputs() {
    const rows = document.querySelectorAll(".santri-row");
    let temp = {};
    
    rows.forEach(row => {
        const sid = row.dataset.id;
        temp[sid] = {};
        for (let i = 1; i <= totalUH; i++) {
            const val = row.querySelector(`.input-uh-${i}`).value;
            temp[sid][`uh${i}`] = val;
        }
    });
    return temp;
}

// 7. Hitung Rata-rata otomatis saat diketik
window.hitungRataRata = function(santriId) {
    const row = document.querySelector(`tr[data-id="${santriId}"]`);
    if (!row) return;

    let total = 0;
    let count = 0;

    for (let i = 1; i <= totalUH; i++) {
        const val = row.querySelector(`.input-uh-${i}`).value;
        if (val !== "") {
            total += Number(val);
            count++;
        }
    }

    const avgCell = document.getElementById(`avg-${santriId}`);
    avgCell.innerText = count > 0 ? (total / count).toFixed(1) : "0";
}

// 8. Simpan Nilai ke Firebase
window.simpanDataNilai = async function() {
    const btnSave = document.querySelector(".btn-save-active");
    btnSave.innerHTML = `<i data-lucide="loader" class="spin"></i> Menyimpan...`;
    btnSave.disabled = true;

    const nilaiData = captureCurrentInputs();
    const docId = `${currentImtihan.replace(/\s+/g, '_')}_${currentMapel.replace(/\s+/g, '_').toLowerCase()}`;
    const docRef = doc(db, "kelas", currentKelasId, "rekap_nilai", docId);

    try {
        await setDoc(docRef, {
            imtihan: currentImtihan,
            mapel: currentMapel,
            totalUH: totalUH,
            nilaiData: nilaiData,
            updatedAt: new Date()
        });

        alert("Berhasil! Data Rekap Nilai berhasil disimpan.");
    } catch (error) {
        console.error("Gagal simpan nilai:", error);
        alert("Gagal menyimpan data nilai!");
    } finally {
        btnSave.innerHTML = `<i data-lucide="save"></i> <span>Simpan Rekap Nilai</span>`;
        btnSave.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
