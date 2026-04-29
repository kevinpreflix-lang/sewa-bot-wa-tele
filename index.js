const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion,
    jidNormalizedUser,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');

// ==========================================
// 🛡️ 1. ANTI CRASH & SISTEM ERROR
// ==========================================
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("rate-overlimit") || e.includes("Connection Closed")) return;
    console.log('\x1b[31m[ 🚨 WADUH ERROR ]\x1b[0m ➜', err.message);
});

// ==========================================
// ⚙️ 2. KONFIGURASI UTAMA & STATISTIK BOT
// ==========================================
const config = {
    nomorBot: "6288211277810", 
    nomorOwner: "6289519096772", 
    nameOwner: "Kevin Preflix",
    prefix: ".",
};

// Variabel Statistik Bot
const botStartTime = Date.now(); 
let botMessagesAnswered = 0;     

// ==========================================
// 🗄️ 3. DATABASE SYSTEM
// ==========================================
const dbPath = './database.json';
let db = { 
    list: {}, 
    payment: { text: "⚠️ *Ups, QRIS belum diatur nih kak.* ⚠️\n\nTunggu admin nge-setpay dulu ya.", image: null }, 
    stock: {},
    stockGaransi: {}, 
    libur: { active: false, teksTanggal: "", startTs: 0, endTs: 0, lastBroadcast: 0 },
    slr: { active: false, text: "⏳ *S L O W  R E S P O N*\n\nHalo kak! Admin lagi ada kegiatan di luar nih jadi _no rush_ yaa.\n\nPesan kakak udah Kevin terima kok, bakal dibalas secepatnya pas admin udah ready. Santai duluuu ☕✨" }
};

const loadDb = () => {
    try {
        if (fs.existsSync(dbPath)) {
            db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (!db.list) db.list = {};
            if (!db.stock) db.stock = {}; 
            if (!db.stockGaransi) db.stockGaransi = {}; 
            if (!db.libur) db.libur = { active: false, teksTanggal: "", startTs: 0, endTs: 0, lastBroadcast: 0 };
            if (!db.slr) db.slr = { active: false, text: "⏳ *S L O W  R E S P O N*\n\nHalo kak! Admin lagi ada kegiatan di luar nih jadi _no rush_ yaa.\n\nPesan kakak udah Kevin terima kok, bakal dibalas secepatnya pas admin udah ready. Santai duluuu ☕✨" };
        } else { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
    } catch (e) { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
};
loadDb();
const saveDb = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

let slrCooldown = {};
let pendingGaransi = {}; 

// ==========================================
// 📡 4. SISTEM MONITORING PANEL
// ==========================================
const logConsole = (tipe, nomor, grup, pesan) => {
    const timeFull = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "medium" });
    const isBot = tipe === 'OUT';
    const c = isBot ? "\x1b[32m" : "\x1b[36m"; 
    const r = "\x1b[0m"; 
    const icon = isBot ? "🤖 [BOT BALAS]" : "👤 [MEMBER]   ";
    const cleanPesan = pesan ? pesan.replace(/\n/g, `\n${c}┊             ${r}`) : "[Media/Attachment]";

    console.log(`${c}╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}`);
    console.log(`${c}┊ 🕰️ ${timeFull}${r}`);
    console.log(`${c}┊ ${icon} : ${nomor.split('@')[0]}${r}`);
    console.log(`${c}┊ 🏛️ Ruang             : ${grup}${r}`);
    console.log(`${c}┊ 💬 Pesan             : ${cleanPesan}${r}`);
    console.log(`${c}╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}\n`);
};

// ==========================================
// 🎨 5. FUNGSI MEDIA UPLOADER
// ==========================================
const uploadImageToTmp = async (buffer) => {
    const boundary = 'KevinPreflix' + Math.random().toString(16).substring(2);
    try {
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`),
            buffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        const res = await fetch('https://tmpfiles.org/api/v1/upload', {
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body
        });
        const json = await res.json();
        if (json?.data?.url) return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    } catch (e) {}
    return null;
};

// ==========================================
// 🚀 6. MESIN UTAMA BOT
// ==========================================
async function startBot() {
    console.clear();
    console.log(`\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
    console.log(`\x1b[33m┃\x1b[0m \x1b[36m 🎩 HII KEVIN PREFLIX EST. 2026  \x1b[0m \x1b[33m┃\x1b[0m`);
    console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m\n`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
        keepAliveIntervalMs: 10000, // 🔥 FIX 1: Kirim sinyal setiap 10 detik biar bot gak ngantuk
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
            // 🔥 FIX 2: Mencegah pesan terlewat kalau WA minta retry (Multi-Device Sync)
            return { conversation: 'Kevin Preflix System' };
        }
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            let nomor = config.nomorBot.replace(/[^0-9]/g, ''); 
            let code = await sock.requestPairingCode(nomor);
            code = code?.match(/.{1,4}/g)?.join("-") || code;
            
            console.log(`\n\x1b[32m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
            console.log(`\x1b[32m┃\x1b[0m \x1b[36m 🚀 KODE PAIRING KAMU: \x1b[33m${code} \x1b[32m┃\x1b[0m`);
            console.log(`\x1b[32m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m\n`);
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    let groupNameCache = {};
    let actionExecuted = {};

    setInterval(async () => {
        const dNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const currentTime = `${dNow.getHours().toString().padStart(2, '0')}:${dNow.getMinutes().toString().padStart(2, '0')}`;
        const currentDate = dNow.toDateString();
        const actionKey = `${currentDate}-${currentTime}`;
        let nowMs = Date.now();

        if (db.libur && db.libur.active) {
            if (nowMs >= db.libur.startTs && nowMs <= db.libur.endTs) {
                let last = db.libur.lastBroadcast || 0;
                if (nowMs - last >= 10800000) { 
                    db.libur.lastBroadcast = nowMs;
                    saveDb();
                    try {
                        const getGroups = await sock.groupFetchAllParticipating();
                        for (let from in getGroups) {
                            let txtLibur = `🏖️ *INFO LIBUR PANJANG* 🏖️\n\nHalo kak! Mau ngabarin nih kalau Hii Kevin Preflix sedang *LIBUR* dari tanggal *${db.libur.teksTanggal}*.\n\nPesanan atau chat yang masuk bakal diproses/dibalas waktu kita udah buka normal lagi ya. Selamat berlibur semuanya! 🌴✨`;
                            await sock.sendMessage(from, { text: txtLibur });
                        }
                    } catch (e) {}
                }
            } else if (nowMs > db.libur.endTs) {
                db.libur.active = false; 
                saveDb();
            }
        }

        if (currentTime === "00:00" && !actionExecuted[`clear-${currentDate}`]) {
            actionExecuted = {}; 
            actionExecuted[`clear-${currentDate}`] = true;
        }

        if (actionExecuted[actionKey]) return;

        if (currentTime === "22:30") {
            actionExecuted[actionKey] = true;
            try {
                const getGroups = await sock.groupFetchAllParticipating();
                for (let from in getGroups) {
                    await sock.groupSettingUpdate(from, 'announcement');
                    let txtTutup = `🔒 *GRUP OTOMATIS DITUTUP* 🔒\n\nHari udah malam nih kak, waktunya admin istirahat dulu ya. Grup bakal buka lagi besok pagi jam 07:30. Selamat istirahat semuanya! 🌙💤`;
                    await sock.sendMessage(from, { text: txtTutup });
                }
            } catch (e) {}
        }

        if (currentTime === "07:30") {
            actionExecuted[actionKey] = true;
            try {
                const getGroups = await sock.groupFetchAllParticipating();
                for (let from in getGroups) {
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    let txtBuka = `☀️ *GRUP OTOMATIS DIBUKA* ☀️\n\nSelamat pagi kakak-kakak semuanya! Yeay grup udah Kevin buka lagi nih. Yuk mari orderannya! ☕✨`;
                    await sock.sendMessage(from, { text: txtBuka });
                }
            } catch (e) {}
        }
    }, 20000); 

    sock.ev.on('connection.update', (up) => {
        const { connection, lastDisconnect } = up;
        if (connection === 'open') {
            console.log(`\x1b[32m[ ✓ ] KONEKSI LANCAR. HII KEVIN PREFLIX SIAP GAS!\x1b[0m\n`);
        }
        if (connection === 'close') {
            const r = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (r) {
                console.log(`\x1b[33m[ ! ] Putus koneksi bentar, nyambungin lagi dalam 3 detik...\x1b[0m`);
                // 🔥 FIX 3: Tambah jeda biar HP gak nge-hang pas koneksi putus nyambung
                setTimeout(() => startBot(), 3000); 
            } else {
                console.log(`\x1b[31m[ ☠️ ] Koneksi Logout. Silakan hapus folder auth_info dan scan ulang.\x1b[0m`);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;
            const from = m.key.remoteJid;
            const sender = m.key.participant || m.key.remoteJid || "";
            if (from === 'status@broadcast') return;

            let rawBody = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "").trim();
            let namaRuang = "Private Chat";
            let isAdmin = false; 

            if (from.endsWith('@g.us')) {
                let groupMetadata = groupNameCache[from];
                if (!groupMetadata) {
                    groupMetadata = await sock.groupMetadata(from).catch(() => null);
                    if (groupMetadata) groupNameCache[from] = groupMetadata;
                }
                namaRuang = groupMetadata?.subject || "Unknown Group";
                
                if (groupMetadata) {
                    const participant = groupMetadata.participants.find(p => p.id === jidNormalizedUser(sender));
                    if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) isAdmin = true;
                }
            }

            if (rawBody) logConsole('IN', sender, namaRuang, rawBody);

            const isOwner = sender.includes(config.nomorOwner.replace(/[^0-9]/g, ''));
            const isAuthorized = isOwner || isAdmin;

            const reply = async (teks) => {
                await sock.sendPresenceUpdate('composing', from);
                const delayTyping = Math.min(Math.max(teks.length * 50, 1000), 2000);
                await new Promise(res => setTimeout(res, delayTyping));
                await sock.sendPresenceUpdate('paused', from);
                await sock.sendMessage(from, { text: teks }, { quoted: m });
                logConsole('OUT', sender, namaRuang, teks);
                botMessagesAnswered++; 
            };

            const budy = rawBody.toLowerCase();

            // ==========================================
            // PANGGILAN BOT (MEMBER VS ADMIN)
            // ==========================================
            const panggilanBot = ["bot", "bott", "botnya", "halo bot", "hi bot", "p", "ping"];
            if (panggilanBot.includes(budy)) {
                if (isAuthorized) {
                    const uptimeMs = Date.now() - botStartTime;
                    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
                    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((uptimeMs % (1000 * 60)) / 1000);
                    let uptimeText = `${hours} Jam ${minutes} Menit ${seconds} Detik`;

                    let adminInfo = `🫡 *Siap bos! Ada yang bisa saya bantu?*\n\n` +
                                    `📊 *STATUS SISTEM BOT*\n` +
                                    `⏱️ *Aktif Selama :* ${uptimeText}\n` +
                                    `💬 *Pesan Dijawab :* ${botMessagesAnswered} Pesan\n` +
                                    `🟢 *Status :* Sistem stabil 100%\n\n` +
                                    `_Ketik *.menu* untuk command admin ya bos._`;
                    return reply(adminInfo);
                } else {
                    let memberInfo = `Iya ka, ada yang bisa dibantu? 👋\n\n` +
                                     `⊳ Silakan ketik *.list* untuk melihat all item\n` +
                                     `⊳ Untuk pembayaran bisa ketik *.pay*\n` +
                                     `⊳ Untuk garansi silakan ketik *garansi nama aplikasi* ya ka.\n\n` +
                                     `_Santai dulu kak, Kevin siap melayani!_ ☕✨`;
                    return reply(memberInfo);
                }
            }

            // ==========================================
            // FITUR DETEKSI KLAIM GARANSI DI GRUP
            // ==========================================
            if (from.endsWith('@g.us') && !isAuthorized) {
                let matchGaransi = budy.match(/garansi\s+([a-z0-9\s]+)/i);
                
                if (matchGaransi) {
                    let kategoriGaransi = matchGaransi[1].trim(); 
                    if (pendingGaransi[sender]) return reply(`⚠️ Selesaikan dulu form garansi sebelumnya di Private Chat (PC) ya kak.`);

                    pendingGaransi[sender] = { groupJid: from, msgData: m, kategori: kategoriGaransi };

                    let formTxt = `📝 *FORM KLAIM GARANSI: ${kategoriGaransi.toUpperCase()}*\n\nHalo kak! Silakan copy (salin) form di bawah ini, isi datanya, lalu kirim ke sini beserta bukti kendalanya ya:\n\n` +
                                  `👤 Nama Pembeli : \n` +
                                  `🛒 Tanggal Order : \n` +
                                  `📅 Tanggal Kendala : \n` +
                                  `💬 Keterangan Kendala : \n` +
                                  `📸 Bukti SS & Screenrecord : (Wajib Dilampirkan)\n\n` +
                                  `_Pastikan isi dengan jelas ya kak biar cepet Kevin proses garansinya!_ ☕✨`;
                    
                    await sock.sendMessage(sender, { text: formTxt });
                    botMessagesAnswered++;

                    let infoGrup = `✅ Halo kak @${sender.split('@')[0]}, form garansi *${kategoriGaransi.toUpperCase()}* udah Kevin kirim ke Private Chat (PC) ya. Silakan dicek dan diisi! 🎩✨`;
                    await sock.sendMessage(from, { text: infoGrup, mentions: [sender] }, { quoted: m });
                    botMessagesAnswered++;
                    return;
                }
            }

            // ==========================================
            // TERIMA FORM GARANSI DI PC (JAPRI)
            // ==========================================
            if (!from.endsWith('@g.us') && pendingGaransi[from]) {
                if (budy.includes('nama pembeli') || budy.includes('tanggal order') || budy.includes('keterangan kendala')) {
                    let dataPending = pendingGaransi[from];
                    let katGaransi = dataPending.kategori;

                    if (db.stockGaransi[katGaransi] && db.stockGaransi[katGaransi].length > 0) {
                        let akunPengganti = db.stockGaransi[katGaransi].shift(); 
                        saveDb();

                        let resPc = `🎉 *KLAIM GARANSI BERHASIL* 🎉\n\nIni akun pengganti kakak ya:\n\`\`\`${akunPengganti}\`\`\`\n\n_Makasih banyak ya kak udah sabar nunggu, sehat selalu!_ 🥂✨`;
                        await sock.sendMessage(from, { text: resPc });
                        botMessagesAnswered++;

                        let resGrup = `✅ Yeay! Done, pesanan garansi kak @${from.split('@')[0]} telah selesai! Udah Kevin drop di PC ya kak 🎩✨`;
                        await sock.sendMessage(dataPending.groupJid, { text: resGrup, mentions: [from] }, { quoted: dataPending.msgData });
                        botMessagesAnswered++;

                        delete pendingGaransi[from];
                        return;
                    } else {
                        return reply(`🙏 _Aduh maaf banget kak, laci stok pengganti untuk *${katGaransi.toUpperCase()}* lagi kosong nih. Kevin lapor admin dulu ya biar cepet di-restock!_`);
                    }
                }
            }

            const isCmd = budy.startsWith(config.prefix);
            const command = isCmd ? budy.slice(config.prefix.length).trim().split(/ +/).shift() : budy.split(/ +/).shift();
            const text = isCmd ? rawBody.slice(config.prefix.length + command.length).trim() : rawBody.slice(command.length).trim();

            let cekKatalog = isCmd ? command : budy; 
            if (db.list[cekKatalog]) {
                let detailTxt = `🏷️ *P R I C E L I S T : ${cekKatalog.toUpperCase()}*\n\n${db.list[cekKatalog]}\n\n_Udah nemu yang pas? Ketik *.pay* buat info pembayarannya kak_ 💸✨`;
                return reply(detailTxt);
            }

            if (db.slr?.active && !isAuthorized && !isCmd && !budy.startsWith('p@')) {
                let nowTime = Date.now();
                if (!slrCooldown[sender] || nowTime - slrCooldown[sender] > 300000) {
                    slrCooldown[sender] = nowTime;
                    await reply(db.slr.text);
                }
                return;
            }

            if (budy.startsWith('p@') && isAuthorized) {
                const quotedInfo = m.message.extendedTextMessage?.contextInfo;
                if (quotedInfo && quotedInfo.quotedMessage) {
                    const targetKategori = budy.split('@')[1]?.trim();
                    const targetPembeli = quotedInfo.participant;

                    if (!targetKategori) return reply("⚠️ _Eh bentar kak, nama produknya lupa ditulis. Contoh: p@canva_");
                    
                    if (db.stock[targetKategori] && db.stock[targetKategori].length > 0) {
                        const dataAkun = db.stock[targetKategori].shift(); 
                        saveDb();

                        let templateAkun = `🎉 *P E S A N A N  M E N D A R A T* 🎉\n` +
                                         `━━━━━━━━━━━━━━━━━━━━\n` +
                                         `📦 *Produk:* ${targetKategori.toUpperCase()}\n\n` +
                                         `🔐 *Detail Akun:*\n\`\`\`${dataAkun}\`\`\`\n` +
                                         `━━━━━━━━━━━━━━━━━━━━\n` +
                                         `_Makasih banyak ya kak! Ditunggu orderan selanjutnya_ 🥂✨`;

                        await sock.sendMessage(targetPembeli, { text: templateAkun });
                        botMessagesAnswered++;
                        
                        let notifGrup = `✅ Yeay! Pesanan udah Kevin kirim aman ke PC @${targetPembeli.split('@')[0]} ya kak. Silakan dicek! 🎩✨`;
                        await sock.sendMessage(from, { text: notifGrup, mentions: [targetPembeli] }, { quoted: m });
                        botMessagesAnswered++;
                        return; 
                    } else {
                        return reply(`📭 _Yah maaf banget kak, laci stok *${targetKategori.toUpperCase()}* lagi kosong nih._`);
                    }
                }
            }

            switch (command) {
                case 'menu':
                case 'help':
                    let mnu = `⚜️ *H I I  K E V I N  P R E F L I X* ⚜️\n` +
                              `_Your Best Digital Partner_ 🎩✨\n\n` +
                              `┌── « 👤 *M E N U  K I T A* »\n` +
                              `│ ⊳ *.list* (Cek Barang Ready)\n` +
                              `│ ⊳ *.pay* (Mau Bayar? Kesini)\n` +
                              `│ ⊳ *Klaim Garansi?* (Ketik: *garansi namaproduk*)\n` +
                              `└───────────────────────────\n`;

                    if (isAuthorized) {
                        mnu += `\n┌── « 👑 *K H U S U S  A D M I N* »\n` +
                               `│ ⊳ *.addlist* / *.dellist*\n` +
                               `│ ⊳ *.addstock* / *.delstock*\n` +
                               `│ ⊳ *.addgaransi* produk@akun\n` +
                               `│ ⊳ *.cekstock* (Semua Jualan & Garansi)\n` +
                               `│ ⊳ *p@produk* (Kirim akun auto)\n` +
                               `│ ⊳ *.proses* / *.done*\n` +
                               `│ ⊳ *.kick* (Keluarkan member)\n` +
                               `│ ⊳ *.setslr* / *.setpay*\n` +
                               `│ ⊳ *.setlibur* / *.stoplibur*\n` +
                               `│ ⊳ *.open* / *.close*\n` +
                               `└───────────────────────────\n`;
                    }
                    return reply(mnu);

                case 'list':
                    let daftarProduk = Object.keys(db.list);
                    if (daftarProduk.length === 0) return reply("📭 Wah, katalog kita lagi kosong nih kak. Sabar ya, admin lagi restock.");
                    
                    daftarProduk.sort((a, b) => a.localeCompare(b));
                    let txtList = "🛍️ *KATALOG HII KEVIN PREFLIX* 🛍️\n\nBerikut daftar produk yang ready kak:\n\n";
                    for (let prod of daftarProduk) { txtList += `*• ${prod.toUpperCase()}*\n`; }
                    
                    let contohKetik = daftarProduk[0];
                    txtList += `\n_Ketik nama produknya (contoh: *${contohKetik}*) buat liat detail pricelist dan deskripsinya ya kak!_ ☕✨`;
                    reply(txtList);
                    break;

                case 'pay':
                    if (db.payment.image) {
                        await sock.sendMessage(from, { image: { url: db.payment.image }, caption: db.payment.text }, { quoted: m });
                        botMessagesAnswered++;
                    } else { reply(db.payment.text); }
                    break;

                // ==========================================
                // 👑 COMMAND ADMIN & OWNER
                // ==========================================
                case 'kick':
                    if (!isAuthorized) return;
                    if (!from.endsWith('@g.us')) return reply("⚠️ Perintah ini khusus di dalam grup kak.");

                    let targetKick = null;
                    const mentionedJid = m.message.extendedTextMessage?.contextInfo?.mentionedJid;
                    
                    if (mentionedJid && mentionedJid.length > 0) { targetKick = mentionedJid[0]; } 
                    else if (m.message.extendedTextMessage?.contextInfo?.participant) { targetKick = m.message.extendedTextMessage.contextInfo.participant; }

                    if (!targetKick) return reply("⚠️ Kak, tolong balas (quote) chat orangnya atau tag (mention) member yang mau dikick ya.");
                    if (targetKick === sock.user.id.split(':')[0] + '@s.whatsapp.net') return reply("⚠️ Wah, Kevin gak bisa nge-kick diri sendiri kak! 😅");
                    if (targetKick === config.nomorOwner + '@s.whatsapp.net') return reply("⚠️ Waduh, masa bos sendiri mau di-kick? Gak berani ah 😅");

                    try {
                        await sock.groupParticipantsUpdate(from, [targetKick], 'remove');
                        await sock.sendMessage(from, { text: `👢 Byee~ Member @${targetKick.split('@')[0]} udah berhasil Kevin keluarin dari grup. 🎩✨`, mentions: [targetKick] });
                        botMessagesAnswered++;
                    } catch (e) { reply("❌ Gagal nge-kick kak. Pastiin bot Hii Kevin Preflix udah dijadiin admin grup ya!"); }
                    break;

                case 'cekstock':
                    if (!isAuthorized) return;
                    let txtCek = "📦 *INFO STOK REGULER* 📦\n";
                    if (Object.keys(db.stock).length === 0) txtCek += "_Stok jualan kosong_\n";
                    else { for (let kat in db.stock) txtCek += `*• ${kat.toUpperCase()}* : ${db.stock[kat].length} akun\n`; }
                    
                    txtCek += "\n🛡️ *INFO STOK GARANSI* 🛡️\n";
                    if (Object.keys(db.stockGaransi).length === 0) txtCek += "_Stok garansi kosong_\n";
                    else { for (let katG in db.stockGaransi) txtCek += `*• ${katG.toUpperCase()}* : ${db.stockGaransi[katG].length} akun\n`; }
                    reply(txtCek);
                    break;

                case 'addgaransi':
                    if (!isAuthorized) return;
                    if (!text.includes('@')) return reply("⚠️ Format salah kak. Contoh: *.addgaransi chatgpt@email:password*");
                    let [katGaransiIn, ...akunGArr] = text.split('@');
                    katGaransiIn = katGaransiIn.trim().toLowerCase();
                    let akunDataG = akunGArr.join('@').trim();
                    if (!db.stockGaransi[katGaransiIn]) db.stockGaransi[katGaransiIn] = [];
                    db.stockGaransi[katGaransiIn].push(akunDataG); 
                    saveDb();
                    reply(`✅ Mantap! Berhasil masukin laci *STOK GARANSI* untuk *${katGaransiIn.toUpperCase()}*.\nTotal siap ganti: ${db.stockGaransi[katGaransiIn].length} akun.`);
                    break;

                case 'setslr':
                    if (!isAuthorized) return;
                    if (!text) return reply("⚠️ Ketik *.setslr on/off/pesan custom*");
                    let act = text.toLowerCase().trim();
                    if (act === 'on') { db.slr.active = true; saveDb(); reply("✅ SLR NYALA."); } 
                    else if (act === 'off') { db.slr.active = false; saveDb(); reply("✅ SLR MATI."); } 
                    else { db.slr.text = text; db.slr.active = true; saveDb(); reply(`✅ SLR NYALA & Teks diganti.`); }
                    break;

                case 'addlist':
                    if (!isAuthorized) return;
                    if (!text.includes('@')) return reply("⚠️ Waduh formatnya salah kak. Contoh: *.addlist canva@Aplikasi canva premium mantap*");
                    let [namaList, ...descList] = text.split('@');
                    db.list[namaList.trim().toLowerCase()] = descList.join('@').trim();
                    saveDb();
                    reply(`✅ Siap kak! Produk *${namaList.trim().toUpperCase()}* udah nangkring di .list nih.`);
                    break;

                case 'dellist':
                    if (!isAuthorized) return;
                    let prodDel = text.trim().toLowerCase();
                    if (!db.list[prodDel]) return reply(`⚠️ Produk *${prodDel}* gak ketemu di katalog kak.`);
                    delete db.list[prodDel];
                    saveDb();
                    reply(`🗑️ Oke kak, produk *${prodDel.toUpperCase()}* udah Kevin hapus dari .list ya.`);
                    break;

                case 'addstock':
                    if (!isAuthorized) return;
                    if (!text.includes('@')) return reply("⚠️ Eh formatnya salah kak. Contoh: *.addstock chatgpt@email:password*");
                    let [katAdd, ...akunArr] = text.split('@');
                    katAdd = katAdd.trim().toLowerCase();
                    let akunData = akunArr.join('@').trim();
                    if (!db.stock[katAdd]) db.stock[katAdd] = [];
                    db.stock[katAdd].push(akunData); 
                    saveDb();
                    reply(`✅ Mantap! Berhasil masukin stok reguler *${katAdd.toUpperCase()}*.\nTotal di laci sekarang: ${db.stock[katAdd].length} akun.`);
                    break;

                case 'delstock':
                    if (!isAuthorized) return;
                    let katDelStok = text.trim().toLowerCase();
                    if (!db.stock[katDelStok] || db.stock[katDelStok].length === 0) return reply(`⚠️ Laci stok *${katDelStok.toUpperCase()}* emang lagi kosong kak.`);
                    db.stock[katDelStok].pop(); 
                    saveDb();
                    reply(`🗑️ Beres kak! Stok paling baru dari *${katDelStok.toUpperCase()}* udah dihapus.\nSisa di laci: ${db.stock[katDelStok].length}`);
                    break;

                case 'getstock':
                    if (!isAuthorized) return;
                    let katGet = text.trim().toLowerCase();
                    if (!db.stock[katGet] || db.stock[katGet].length === 0) return reply(`⚠️ Laci stok *${katGet.toUpperCase()}* lagi kosong kak.`);
                    let dapetAkun = db.stock[katGet].shift(); 
                    saveDb();
                    await sock.sendMessage(sender, { text: `📦 *AMBIL MANUAL: ${katGet.toUpperCase()}*\n\n\`\`\`${dapetAkun}\`\`\`` });
                    botMessagesAnswered++;
                    reply(`✅ Sip kak, 1 Stok *${katGet.toUpperCase()}* udah Kevin bisikin ke Private Chat kakak ya.\nSisa stok: ${db.stock[katGet].length}`);
                    break;

                case 'proses':
                    if (!isAuthorized) return;
                    const ctxProses = m.message.extendedTextMessage?.contextInfo;
                    if (!ctxProses || !ctxProses.quotedMessage) return reply("⚠️ Tolong balas (quote) chat membernya dulu kak, biar Kevin tau yang mana yang diproses.");
                    
                    let targetProses = ctxProses.participant;
                    let teksProses = `⏳ Halo kak @${targetProses.split('@')[0]}, pesanan kakak lagi diproses nih. Santai dulu ya sambil nunggu... ☕✨`;
                    
                    await sock.sendMessage(from, { text: teksProses, mentions: [targetProses] }, { quoted: m });
                    botMessagesAnswered++;
                    break;

                case 'done':
                    if (!isAuthorized) return;
                    const ctxDone = m.message.extendedTextMessage?.contextInfo;
                    if (!ctxDone || !ctxDone.quotedMessage) return reply("⚠️ Balas (quote) pesannya dulu kak, biar asik.");
                    
                    let targetDone = ctxDone.participant;
                    let teksDone = `✅ Alhamdulillah pesanan kak @${targetDone.split('@')[0]} udah beres dan mendarat dengan aman! Makasih banyak ya kak udah order di Hii Kevin Preflix 🥂✨`;
                    
                    await sock.sendMessage(from, { text: teksDone, mentions: [targetDone] }, { quoted: m });
                    botMessagesAnswered++;
                    break;

                case 'setpay':
                    if (!isAuthorized) return;
                    const isImage = m.message.imageMessage || (m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage);
                    if (!isImage) return reply("⚠️ Kak, kirim gambar QRIS-nya terus kasih caption *.setpay* ya, atau balas gambarnya juga boleh.");
                    let mediaMsg = m.message.imageMessage ? m.message.imageMessage : m.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage;
                    const bufferQR = await downloadContentFromMessage(mediaMsg, 'image');
                    let bufferObj = Buffer.from([]);
                    for await (const chunk of bufferQR) { bufferObj = Buffer.concat([bufferObj, chunk]); }
                    const qrisUrl = await uploadImageToTmp(bufferObj);
                    if (!qrisUrl) return reply("❌ Yah gagal upload QRIS nih kak, coba lagi yuk.");
                    db.payment.image = qrisUrl;
                    db.payment.text = "✅ *INI QRIS HII KEVIN PREFLIX YA KAK*\n\nSilakan di-scan aja buat bayar, mudah dan praktis 💸✨";
                    saveDb();
                    reply("✅ Mantap kak, gambar QRIS udah berhasil diupdate nih.");
                    break;

                case 'open':
                    if (!isAuthorized) return;
                    if (!from.endsWith('@g.us')) return reply("⚠️ Ini kan buat grup kak hehe.");
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    reply("🔓 Yeay! Grup udah Kevin buka nih. Ayo semua merapat dan ngobrol bareng! ☕✨");
                    break;

                case 'close':
                    if (!isAuthorized) return;
                    if (!from.endsWith('@g.us')) return reply("⚠️ Ini khusus di dalam grup ya kak.");
                    await sock.groupSettingUpdate(from, 'announcement');
                    reply("🔒 Oke kak, grup udah Kevin kunci sementara ya. Istirahat dulu, adminnya mau rehat bentar 🌙💤");
                    break;

                case 'setlibur':
                    if (!isAuthorized) return;
                    const match = text.match(/(\d+)\s*(?:-|s\/d|sampai)\s*(\d+)\s+([a-zA-Z]+)\s+(\d{4})/i);
                    if (!match) return reply("⚠️ Formatnya kurang pas kak. Coba kayak gini: *.setlibur 14-21 mei 2026*");

                    const bulanID = { "januari":0, "jan":0, "februari":1, "feb":1, "maret":2, "mar":2, "april":3, "apr":3, "mei":4, "juni":5, "jun":5, "juli":6, "jul":6, "agustus":7, "agu":7, "september":8, "sep":8, "oktober":9, "okt":9, "november":10, "nov":10, "desember":11, "des":11 };
                    
                    let sDay = parseInt(match[1]);
                    let eDay = parseInt(match[2]);
                    let bln = match[3].toLowerCase();
                    let thn = parseInt(match[4]);

                    if (bulanID[bln] === undefined) return reply(`⚠️ Waduh, bulan "${bln}" Kevin kurang paham kak. Pakai nama bulan biasa aja ya (contoh: mei, juni, dll).`);

                    db.libur = {
                        active: true,
                        teksTanggal: text,
                        startTs: new Date(thn, bulanID[bln], sDay, 0, 0, 0).getTime(),
                        endTs: new Date(thn, bulanID[bln], eDay, 23, 59, 59).getTime(),
                        lastBroadcast: 0
                    };
                    saveDb();
                    reply(`✅ Sip kak! Jadwal libur panjang udah Kevin set untuk tanggal *${text}*.\nBot bakal otomatis ngirim pengumuman tiap 3 jam ke semua grup pas masuk tanggal itu 🏖️✨`);
                    break;

                case 'stoplibur':
                    if (!isAuthorized) return;
                    db.libur.active = false;
                    saveDb();
                    reply("✅ Oke kak, jadwal libur panjang udah Kevin batalin. Bot gak bakal siaran libur lagi.");
                    break;

                default:
                    if (isCmd && isAuthorized) {
                        reply(`⚠️ *Eh bentar bos, formatnya salah atau typo deh.* 😅\n\nCek *.menu* lagi ya bos buat liat list commandnya! ☕✨`);
                    }
                    break;
            }
        } catch (err) {
            console.log("\x1b[31m[ 🚨 WADUH ERROR ]\x1b[0m ➜", err);
        }
    });
}

startBot();
