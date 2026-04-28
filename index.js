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
// const qrcode = require('qrcode-terminal'); // Tidak perlu lagi untuk sistem pairing
const sharp = require('sharp'); 

// ==========================================
// 🛡️ 1. ANTI CRASH & DETEKSI WEBP
// ==========================================
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("rate-overlimit") || e.includes("Connection Closed")) return;
    console.log('\x1b[31m[ 🚨 ERROR TEREDAM ]\x1b[0m ➜', err.message);
});

const isWebpBuffer = (buffer) => {
    if (!buffer || buffer.length < 12) return false;
    return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
           buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
};

// ==========================================
// ⚙️ 2. KONFIGURASI UTAMA
// ==========================================
const config = {
    nomorBot: "6285179905048", // Pastikan nomor ini adalah nomor bot WA yang aktif
    nomorOwner: "6289519096772", 
    nameOwner: "Nailong VIP",
    prefix: ".",
    emailUtama: "purnawankevin63@gmail.com" 
};

// ==========================================
// 🗄️ 3. DATABASE SYSTEM
// ==========================================
const dbPath = './database.json';
let db = { 
    list: {}, 
    payment: { text: "⚠️ *QRIS BELUM DIATUR* ⚠️\n\nSilahkan minta admin untuk setpay.", image: null }, 
    settings: {}, 
    netflix_users: [],
    stock: {} 
};

const loadDb = () => {
    try {
        if (fs.existsSync(dbPath)) {
            db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (!db.settings) db.settings = {};
            if (!db.stock) db.stock = {}; 
        } else { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
    } catch (e) { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
};
loadDb();
const saveDb = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

// ==========================================
// ⏰ 4. WAKTU & JADWAL OTOMATIS
// ==========================================
const getGreeting = () => {
    const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"})).getHours();
    if (hour >= 4 && hour < 11) return "Pagi yang cerah";
    if (hour >= 11 && hour < 15) return "Siang yang produktif";
    if (hour >= 15 && hour < 18) return "Sore yang santai";
    return "Malam yang tenang";
};

const jadwalSholat = [
    { nama: "Sᴜʙᴜʜ", tutup: "04:30", buka: "04:40", emoji: "🌅" },
    { nama: "Dᴢᴜʜᴜʀ", tutup: "12:00", buka: "12:10", emoji: "☀️" },
    { nama: "Asʜᴀʀ", tutup: "15:15", buka: "15:25", emoji: "🌤️" },
    { nama: "Mᴀɢʜʀɪʙ", tutup: "18:00", buka: "18:10", emoji: "🌇" },
    { nama: "Isʏᴀ", tutup: "19:15", buka: "19:25", emoji: "🌙" }
];

const jamOperasional = { tutup: "22:30", buka: "07:30" };
const groupNameCache = {};
let actionExecuted = {}; 

// ==========================================
// 📡 5. SISTEM MONITORING PANEL
// ==========================================
const logConsole = (tipe, nomor, grup, pesan) => {
    const timeFull = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "medium" });
    const isBot = tipe === 'OUT';
    const c = isBot ? "\x1b[32m" : "\x1b[36m"; 
    const r = "\x1b[0m"; 
    const icon = isBot ? "🤖 [BOT REPLY]" : "👤 [USER IN]  ";
    const cleanPesan = pesan ? pesan.replace(/\n/g, `\n${c}┊             ${r}`) : "[Media/Attachment]";

    console.log(`${c}╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}`);
    console.log(`${c}┊ 🕰️ ${timeFull}${r}`);
    console.log(`${c}┊ ${icon} : ${nomor.split('@')[0]}${r}`);
    console.log(`${c}┊ 🏛️ Ruang             : ${grup}${r}`);
    console.log(`${c}┊ 💬 Pesan             : ${cleanPesan}${r}`);
    console.log(`${c}╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}\n`);
};

// ==========================================
// 🎨 6. FUNGSI MEDIA (UPLOADER & DOWNLOADER)
// ==========================================
const uploadImageToTmp = async (buffer) => {
    const boundary = 'Nailong' + Math.random().toString(16).substring(2);
    try {
        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`),
            buffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);
        const res = await fetch('https://telegra.ph/upload', {
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: body
        });
        const text = await res.text();
        if (text.includes('src')) return 'https://telegra.ph' + JSON.parse(text)[0].src;
    } catch (e) {}

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

const getBuffer = async (url, options = {}) => {
    try {
        const res = await fetch(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }, 
            ...options 
        });
        if (!res.ok) return null;
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (e) { return null; }
};

const createSticker = async (buffer, crop = false) => {
    try {
        let img = sharp(buffer);
        if (crop) img = img.trim();
        return await img
            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .webp({ quality: 90 })
            .toBuffer();
    } catch (error) {
        return null;
    }
};

const formatMemegen = (text) => text.trim().replace(/\s+/g, '_').replace(/\?/g, '~q').replace(/%/g, '~p') || '_';

// ==========================================
// 🚀 7. MESIN UTAMA BOT
// ==========================================
async function startBot() {
    console.clear();
    console.log(`\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
    console.log(`\x1b[33m┃\x1b[0m \x1b[36m 🎩 NAILONG VIP SYSTEM EST. 2024 \x1b[0m \x1b[33m┃\x1b[0m`);
    console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m\n`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        printQRInTerminal: false, // WAJIB FALSE untuk Pairing Code
        logger: pino({ level: 'silent' }),
        // WAJIB menggunakan OS default (Ubuntu) agar API WhatsApp mau memberikan Pairing Code
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
    });

    // ==========================================
    // 🔑 8. SISTEM PAIRING CODE (PENGGANTI QR)
    // ==========================================
    if (!sock.authState.creds.registered) {
        const phoneNumber = config.nomorBot.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
                console.log(`\x1b[33m┃\x1b[0m \x1b[32m🔑 KODE PAIRING ANDA: \x1b[36m${code} \x1b[0m \x1b[33m┃\x1b[0m`);
                console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m`);
                console.log(`\x1b[37mBuka notifikasi WhatsApp di HP Bot Anda dan masukkan kode di atas.\x1b[0m\n`);
            } catch (err) {
                console.log(`\x1b[31m[ 🚨 ERROR ] Gagal mendapatkan kode pairing:\x1b[0m`, err.message);
            }
        }, 3000); // Jeda 3 detik agar socket benar-benar siap
    }

    sock.ev.on('creds.update', saveCreds);

    const sendTyping = async (jid, content, options, namaGrup, nomorTarget) => {
        const textLen = (content.text || content.caption || "").length;
        const delayTyping = Math.min(Math.max(textLen * 50, 2000), 5000); 

        await sock.sendPresenceUpdate('composing', jid);
        await new Promise(res => setTimeout(res, delayTyping));
        await sock.sendPresenceUpdate('paused', jid);
        
        let sentMsg = await sock.sendMessage(jid, content, options);
        let logText = content.text || content.caption || "[Mengirim Media/Stiker]";
        logConsole('OUT', nomorTarget, namaGrup, logText);
        return sentMsg;
    };

    const broadcastAllGroups = async (actionSetting, textMsg) => {
        try {
            const getGroups = await sock.groupFetchAllParticipating();
            for (let from in getGroups) {
                try {
                    let grpName = getGroups[from].subject || "Unknown Group";
                    await sock.groupSettingUpdate(from, actionSetting);
                    await sock.sendMessage(from, { text: textMsg });
                    logConsole('OUT', 'SYSTEM BROADCAST', grpName, textMsg);
                    await new Promise(res => setTimeout(res, 2000));
                } catch (errGroup) {}
            }
        } catch (e) {}
    };

    setInterval(async () => {
        const dNow = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
        const currentTime = `${dNow.getHours().toString().padStart(2, '0')}:${dNow.getMinutes().toString().padStart(2, '0')}`;
        const currentDate = dNow.toDateString();
        const actionKey = `${currentDate}-${currentTime}`;

        if (currentTime === "00:00" && !actionExecuted[`clear-${currentDate}`]) {
            actionExecuted = {};
            actionExecuted[`clear-${currentDate}`] = true;
        }

        if (actionExecuted[actionKey]) return;

        let sholatTutup = jadwalSholat.find(j => j.tutup === currentTime);
        if (sholatTutup) {
            actionExecuted[actionKey] = true;
            let txt = `⚜️ *JEDA TRANSAKSI SEJENAK* ⚜️\n\nHalo kak, sudah masuk waktu *${sholatTutup.nama}* nih ${sholatTutup.emoji}.\nSistem kami jeda 10 menit ya. Mari kita ambil wudhu dan tunaikan ibadah dulu. ☕🤍`;
            await broadcastAllGroups('announcement', txt);
        }

        let sholatBuka = jadwalSholat.find(j => j.buka === currentTime);
        if (sholatBuka) {
            actionExecuted[actionKey] = true;
            let txt = `🎩 *TOKO KEMBALI DIBUKA*\n\nAlhamdulillah, ibadah selesai! Pintu layanan sudah dibuka kembali. Mari kita lanjutkan hari yang indah ini! ✨`;
            await broadcastAllGroups('not_announcement', txt);
        }

        if (currentTime === jamOperasional.tutup) {
            actionExecuted[actionKey] = true;
            let txt = `🔒 *JAM OPERASIONAL BERAKHIR* 🔒\n\nTerima kasih atas kunjungannya hari ini, Kak! ☕\nSaat ini manajemen Nailong VIP sedang beristirahat. Layanan akan kembali beroperasi esok pagi. 🎩💤`;
            await broadcastAllGroups('announcement', txt);
        }

        if (currentTime === jamOperasional.buka) {
            actionExecuted[actionKey] = true;
            let txt = `☀️ *SELAMAT PAGI* ☀️\n\nPintu etalase Nailong VIP telah kembali dibuka! 🎩✨\nSemoga hari ini membawa rezeki dan kelancaran untuk kita semua. \n\nSilakan sampaikan pesanan Anda! ☕`;
            await broadcastAllGroups('not_announcement', txt);
        }
    }, 15000); 

    sock.ev.on('connection.update', (up) => {
        const { connection, lastDisconnect } = up;
        // qrcode.generate dihilangkan karena diganti pairing code
        
        if (connection === 'open') {
            console.log(`\x1b[32m[ ✓ ] KONEKSI STABIL. BOT NAILONG VIP SIAP MELAYANI!\x1b[0m\n`);
        }
        if (connection === 'close') {
            const r = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (r) {
                console.log(`\x1b[33m[ ! ] Koneksi terputus, menyambungkan kembali...\x1b[0m`);
                startBot();
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

            let rawBody = (m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "").trim();
            
            let namaRuang = "Private Chat";
            let isAdmin = false; 
            let groupMetadata = null;

            if (from.endsWith('@g.us')) {
                if (!groupNameCache[from]) {
                    groupMetadata = await sock.groupMetadata(from).catch(() => null);
                    if (groupMetadata) groupNameCache[from] = groupMetadata.subject;
                } else {
                    groupMetadata = await sock.groupMetadata(from).catch(() => null);
                }
                namaRuang = groupNameCache[from] || "Unknown Group";
                
                if (groupMetadata) {
                    const participant = groupMetadata.participants.find(p => p.id === jidNormalizedUser(sender));
                    if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) isAdmin = true;
                }
            }

            if (rawBody) {
                logConsole('IN', sender, namaRuang, rawBody);
            }

            const isOwner = sender.includes(config.nomorOwner.replace(/[^0-9]/g, ''));
            const isAuthorized = isOwner || isAdmin;

            // ==========================================
            // 🆕 SISTEM AUTO KIRIM AKUN (REPLY P@)
            // ==========================================
            if (rawBody.toLowerCase().startsWith('p@') && isAuthorized) {
                const quotedInfo = m.message.extendedTextMessage?.contextInfo;
                if (quotedInfo && quotedInfo.quotedMessage) {
                    const targetKategori = rawBody.split('@')[1]?.toLowerCase().trim();
                    const targetPembeli = quotedInfo.participant;

                    if (!targetKategori) return reply("🖋️ _Mohon sertakan kategori akun. Contoh: p@chatgpt_");
                    
                    if (db.stock[targetKategori] && db.stock[targetKategori].length > 0) {
                        const dataAkun = db.stock[targetKategori].shift(); // Ambil stok terlama (FIFO)
                        saveDb();

                        let templateAkun = `🎩 *D E T A I L  A K U N  E X C L U S I V E* 🎩\n` +
                                         `━━━━━━━━━━━━━━━━━━━━\n` +
                                         `📦 *Produk:* ${targetKategori.toUpperCase()}\n\n` +
                                         `🔐 *Data Akun:*\n\`\`\`${dataAkun}\`\`\`\n` +
                                         `━━━━━━━━━━━━━━━━━━━━\n` +
                                         `_Terima kasih telah berbelanja di Nailong VIP. Cheers!_ 🥂`;

                        // Kirim ke Private Chat pembeli
                        await sock.sendMessage(targetPembeli, { text: templateAkun });
                        
                        // Notifikasi di Grup
                        let notifGrup = `✅ *PENGIRIMAN SUKSES*\n\nSatu aset *${targetKategori.toUpperCase()}* telah dikirimkan ke @${targetPembeli.split('@')[0]}. 🎩✨`;
                        await sock.sendMessage(from, { text: notifGrup, mentions: [targetPembeli] }, { quoted: m });
                        
                        return; // Selesai
                    } else {
                        return reply(`📭 _Mohon maaf, laci stok *${targetKategori.toUpperCase()}* sedang kosong._`);
                    }
                }
            }

            if (!from.endsWith('@g.us') && !isOwner) {
                let warnTxt = `⚜️ *SISTEM KEAMANAN NAILONG VIP* ⚜️\n\n` +
                              `⚠️ *PERINGATAN KERAS* ⚠️\n` +
                              `Dilarang chat nomor bot ini secara pribadi! Anda dikenakan denda sebesar *Rp 10.000*.\n\n` +
                              `_Jika Anda masih melakukan spam di sini, sistem kami akan memblokir Anda!_ 🎩`;
                await sendTyping(from, { text: warnTxt }, { quoted: m }, "Private Chat", sender);
                return; 
            }

            const budy = rawBody.toLowerCase();
            const isCmd = budy.startsWith(config.prefix);
            const command = isCmd ? budy.slice(config.prefix.length).trim().split(/ +/).shift() : budy.split(/ +/).shift();
            const text = isCmd ? rawBody.slice(config.prefix.length + command.length).trim() : rawBody.slice(command.length).trim();

            const reply = async (teks) => {
                await sock.sendPresenceUpdate('composing', from);
                const delayTyping = Math.min(Math.max(teks.length * 50, 2000), 5000);
                await new Promise(res => setTimeout(res, delayTyping));
                await sock.sendPresenceUpdate('paused', from);
                await sock.sendMessage(from, { text: teks }, { quoted: m });
                logConsole('OUT', sender, namaRuang, teks);
            };

            const smallTalk = {
                "p": "Panggilan diterima! 🎩 Silakan ketik *LIST* untuk melihat apa yang bisa saya bantu hari ini.",
                "pagi": "Pagi yang indah! Semoga hari Anda menyenangkan. ☕",
                "siang": "Selamat siang! Jangan lupa istirahat sejenak dan kopi hangatnya. ☕",
                "sore": "Sore yang syahdu! Ada yang bisa kami bantu sebelum hari berakhir? 🌤️",
                "malam": "Malam, Kak! Masih butuh sesuatu? Kami di sini menemani Anda. 🌙",
                "terima kasih": "Sama-sama, Kak! Sudah menjadi kewajiban kami memberikan yang terbaik. ✨",
                "thanks": "Sama-sama! Senang bisa membantu Anda. 🥂",
                "halo": "Halo juga! Selamat datang di layanan premium Nailong VIP. Ketik *.menu* untuk memulai. 🎩",
                "bot": "Panggilan diterima, Tuan/Nyonya! 🎩✨ Asisten Nailong senantiasa berjaga di sini."
            };

            if (!isCmd && smallTalk[budy]) {
                return await reply(smallTalk[budy]);
            }

            if (!isCmd && db.list[budy]) {
                let textRes = `\`\`\`[ PRODUCT DETAILS ]\`\`\`\n\n${db.list[budy]}\n\n_Berminat? Ketik .pay untuk melihat metode pembayaran kami._ ☕`;
                return await sendTyping(from, { text: textRes }, { quoted: m }, namaRuang, sender);
            }

            switch (command) {
                case 'menu':
                case 'help':
                    let mnu = `⚜️ *N A I L O N G  V I P* ⚜️\n` +
                              `_Where Digital Needs Meet Elegance_\n\n` +
                              `Selamat ${getGreeting()}, Kak! ☕\n` +
                              `Senang melihat Anda kembali. Silakan jelajahi layanan eksklusif kami di bawah ini:\n\n` +
                              `┌── « 🛍️ *C O N C I E R G E* »\n` +
                              `│ ⊳ *.list* (Katalog Eksklusif)\n` +
                              `│ ⊳ *.pay* (Metode Pembayaran)\n` +
                              `│\n` +
                              `┌── « 🎨 *S T U D I O  K R E A S I* »\n` +
                              `│ ⊳ *.s* / *.sticker* (Gambar ➔ Stiker)\n` +
                              `│ ⊳ *.smeme* atas | bawah (Meme Stiker)\n` +
                              `│ ⊳ *.brat* / *.bratid* (Teks ➔ Brat)\n` +
                              `│ ⊳ *.bratvideo* / *.bratvidio* (Teks Animasi)\n` +
                              `│ ⊳ *.bratpink* (Teks Brat Pink)\n` +
                              `│ ⊳ *.qc* (Teks ➔ Quote)\n` +
                              `│ ⊳ *.hd* / *.upscale* (Jernihkan Gambar)\n` +
                              `│\n` +
                              `┌── « 📥 *T I K T O K  D O W N L O A D* »\n` +
                              `│ ⊳ *.download* link_tiktok | mp4\n` +
                              `│ ⊳ *.download* link_tiktok | mp3\n` +
                              `└───────────────────────────\n`;

                    if (isAuthorized) {
                        mnu += `\n┌── « 🎩 *A D M I N  O N L Y* »\n` +
                               `│ ⊳ *p@NAMAPRODUK* (Reply SS Pembeli)\n` +
                               `│ ⊳ *.p* (Proses Pesanan)\n` +
                               `│ ⊳ *.d* (Pesanan Selesai)\n` +
                               `│ ⊳ *.addstock* / *.getstock*\n` +
                               `│ ⊳ *.cekstock* (Cek Brankas)\n` +
                               `│ ⊳ *.addlist* / *.setpay*\n` +
                               `│ ⊳ *.open* / *.close*\n` +
                               `│ ⊳ *.h* (Broadcast/Tag)\n` +
                               `└───────────────────────────\n`;
                    }
                    
                    mnu += `\n_Your premium digital partner._ ✨`;
                    await sendTyping(from, { text: mnu }, { quoted: m }, namaRuang, sender);
                    break;

                case 'download':
                case 'dl': {
                    if (!text) return reply("📝 _Mohon sertakan link TikTok dan formatnya. \nContoh:_ *.download https://tiktok.com/... | mp4*");
                    
                    const [rawLink, formatStr] = text.split('|').map(v => v ? v.trim() : '');
                    if (!rawLink || !formatStr) return reply("📝 _Format penulisan salah. Pastikan memisahkan link dan format dengan simbol '|'.\nContoh:_ *.download link_tiktok | mp3*");
                    
                    const cleanLinkMatch = rawLink.match(/https?:\/\/[^\s]+/);
                    if (!cleanLinkMatch) return reply("📝 _Link tidak valid atau tidak ditemukan dalam pesan Anda._");
                    let link = cleanLinkMatch[0];

                    const format = formatStr.toLowerCase();
                    if (format !== 'mp3' && format !== 'mp4') return reply("📝 _Mohon maaf, format yang didukung hanya *mp3* (Audio) dan *mp4* (Video)._");

                    if (!link.includes('tiktok.com')) {
                        return reply("⚠️ _Link tidak dikenali. Layanan kami saat ini hanya mendukung unduhan dari TikTok._");
                    }

                    await sendTyping(from, { text: "🪄 _Pesan diterima! Pelayan kami sedang mengambil media tersebut dan akan mengirimkannya secara rahasia ke Private Chat (PM) Anda..._" }, { quoted: m }, namaRuang, sender);

                    try {
                        let mediaUrl = null;
                        let captionText = `🎩 *E X C L U S I V E  D O W N L O A D E R*\n\nVoila! Pesanan media TikTok Anda sudah mendarat dengan selamat. ☕`;
                        let isAudio = format === 'mp3';

                        let res1 = await fetch(`https://www.tikwm.com/api/?url=${link}`).then(r => r.json()).catch(() => null);
                        if (res1?.data) {
                            mediaUrl = isAudio ? res1.data.music : res1.data.play;
                        } 
                        else {
                            let res2 = await fetch(`https://api.tiklydown.eu.org/api/download?url=${link}`).then(r => r.json()).catch(() => null);
                            if (res2) mediaUrl = isAudio ? res2.music?.play_url : res2.video?.noWatermark;
                        }

                        if (!mediaUrl) return reply("😵‍💫 _Gagal menemukan link media. Video mungkin dikunci (Private) atau dihapus oleh pemiliknya._");

                        await sock.sendPresenceUpdate('composing', sender);
                        
                        let mediaBuffer = await getBuffer(mediaUrl);
                        if (!mediaBuffer) return reply("😵‍💫 _Berhasil mendapat akses, tetapi server TikTok menolak permintaan unduhan._");

                        if (isAudio) {
                            await sock.sendMessage(sender, { 
                                audio: mediaBuffer, 
                                mimetype: 'audio/mp4',
                                ptt: false 
                            });
                            await sock.sendMessage(sender, { text: captionText });
                        } else {
                            await sock.sendMessage(sender, { 
                                video: mediaBuffer, 
                                caption: captionText 
                            });
                        }

                        if (from.endsWith('@g.us')) {
                            reply(`✅ _Selesai! Media telah dikirimkan ke Private Chat (PM) Anda, Tuan/Nyonya._ 🎩`);
                        }

                    } catch (e) {
                        console.log("Downloader Error:", e);
                        reply("😵‍💫 _Sistem pengunduh sedang mengalami gangguan teknis._");
                    }
                    break;
                }

                case 'hd':
                case 'upscale': {
                    const targetMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || m.message.imageMessage;
                    const isVideoMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage || m.message.videoMessage;

                    if (isVideoMsg) {
                        return reply("🍷 _Mohon maaf Tuan/Nyonya, pemrosesan Upscale/HD untuk Video (Frame-by-Frame) memakan daya komputasi ekstrim dan hanya tersedia di server VIP kami yang sedang dalam pemeliharaan. Silakan gunakan fitur ini untuk memperjelas Gambar/Foto._ 🎩");
                    }

                    if (!targetMsg) {
                        return reply("🖼️ _Mohon kirim atau balas sebuah *Gambar/Foto* dengan caption_ *.hd* _untuk meningkatkan kualitasnya._");
                    }

                    await sendTyping(from, { text: "🪄 _Sedang bekerja di ruang gelap... Memperjelas dan meningkatkan resolusi gambar Anda..._" }, { quoted: m }, namaRuang, sender);
                    
                    try {
                        const stream = await downloadContentFromMessage(targetMsg, 'image');
                        let buffer = Buffer.from([]);
                        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                        
                        let imgUrl = await uploadImageToTmp(buffer);
                        let hdBuffer = null;

                        if (imgUrl) {
                            const apis = [
                                `https://api.siputzx.my.id/api/tools/remini?url=${encodeURIComponent(imgUrl)}`,
                                `https://api.ryzendesu.vip/api/ai/remini?url=${encodeURIComponent(imgUrl)}`
                            ];
                            for (let api of apis) {
                                try {
                                    let tempBuff = await getBuffer(api);
                                    if (tempBuff && tempBuff.length > 5000) { 
                                        hdBuffer = tempBuff;
                                        break;
                                    }
                                } catch (errApi) {}
                            }
                        }

                        if (!hdBuffer) {
                            const metadata = await sharp(buffer).metadata();
                            const newWidth = Math.min(metadata.width * 2, 4096);
                            const newHeight = Math.min(metadata.height * 2, 4096);
                            
                            hdBuffer = await sharp(buffer)
                                .resize(newWidth, newHeight)
                                .sharpen({ sigma: 1.5 }) 
                                .jpeg({ quality: 100 })
                                .toBuffer();
                        }

                        if (hdBuffer) {
                            await sock.sendMessage(from, { image: hdBuffer, caption: "✨ *H I G H  D E F I N I T I O N*\n\nGambar Anda telah berhasil diperjelas. 🎩" }, { quoted: m });
                        } else {
                            reply("😵‍💫 _Gagal memproses gambar. Resolusi asli mungkin terlalu besar atau format tidak didukung._");
                        }
                    } catch (e) {
                        console.log("HD Error:", e);
                        reply("😵‍💫 _Terjadi kesalahan saat memproses gambar._");
                    }
                    break;
                }

                case 's':
                case 'sticker': {
                    const qImg = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || m.message.imageMessage;
                    if (!qImg) return reply("🖼️ _Mohon kirim atau balas sebuah gambar dengan caption_ *.s* _untuk mengubahnya menjadi stiker._");
                    await sendTyping(from, { text: "🪄 _Merapalkan mantra... Mengubah gambar menjadi stiker..._" }, { quoted: m }, namaRuang, sender);
                    
                    const stream = await downloadContentFromMessage(qImg, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    const finalStickerBuffer = await createSticker(buffer, false);
                    if (finalStickerBuffer) {
                        await sock.sendMessage(from, { sticker: finalStickerBuffer }, { quoted: m });
                    } else {
                        reply("😵‍💫 _Gagal memproses gambar Anda menjadi stiker._");
                    }
                    break;
                }

                case 'smeme': {
                    const qImg = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || m.message.imageMessage;
                    if (!qImg) return reply("🖼️ _Balas gambar dengan caption_ *.smeme teks atas | teks bawah*");
                    if (!text) return reply("📝 _Mohon sertakan teksnya. Contoh: .smeme Ini Atas | Ini Bawah_");
                    
                    const [atas, bawah] = text.split('|').map(v => v ? v.trim() : '');
                    await sendTyping(from, { text: "🪄 _Merapalkan mantra meme stiker..._" }, { quoted: m }, namaRuang, sender);
                    
                    const stream = await downloadContentFromMessage(qImg, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    
                    const imgUrl = await uploadImageToTmp(buffer);
                    if (!imgUrl) return reply("😵‍💫 _Sistem gagal mengunggah gambar Anda untuk dijadikan meme._");
                    
                    const urlMeme = `https://api.memegen.link/images/custom/${formatMemegen(atas)}/${formatMemegen(bawah)}.png?background=${imgUrl}`;
                    const rawMemeBuffer = await getBuffer(urlMeme);
                    if (!rawMemeBuffer) return reply("😵‍💫 _Gagal mengunduh hasil meme dari server._");

                    const finalStickerBuffer = await createSticker(rawMemeBuffer, false);
                    if (finalStickerBuffer) {
                        await sock.sendMessage(from, { sticker: finalStickerBuffer }, { quoted: m });
                    } else {
                        reply("😵‍💫 _Gagal mengubah meme menjadi stiker._");
                    }
                    break;
                }

                case 'brat':
                case 'bratid': {
                    if (!text) return reply("📝 _Mohon sertakan teksnya, Tuan/Nyonya. Contoh: .brat Nailong VIP_");
                    await sendTyping(from, { text: "🪄 _Sedang mencetak desain brat eksklusif..._" }, { quoted: m }, namaRuang, sender);
                    
                    const apis = [
                        `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`,
                        `https://api.ryzendesu.vip/api/sticker/brat?text=${encodeURIComponent(text)}`,
                        `https://widipe.com/brat?text=${encodeURIComponent(text)}`
                    ];

                    let rawBuff = null;
                    for (let url of apis) {
                        let buff = await getBuffer(url);
                        if (buff && buff.length > 2000) {
                            rawBuff = buff;
                            break;
                        }
                    }

                    if (!rawBuff) return reply("😵‍💫 _Mohon maaf, semua studio desain (API) sedang penuh._");

                    const finalStickerBuffer = await createSticker(rawBuff, true);
                    if (finalStickerBuffer) {
                        await sock.sendMessage(from, { sticker: finalStickerBuffer }, { quoted: m });
                    } else {
                        await sock.sendMessage(from, { image: rawBuff, caption: "🎩 _Desain Brat Exclusive_" }, { quoted: m });
                    }
                    break;
                }

                case 'bratvideo':
                case 'bratvidio': {
                    if (!text) return reply("📝 _Mohon sertakan teksnya. Contoh: .bratvideo Nailong VIP_");
                    await sendTyping(from, { text: "🪄 _Sedang mencetak video animasi brat eksklusif..._" }, { quoted: m }, namaRuang, sender);
                    
                    const apis = [
                        `https://api.ryzendesu.vip/api/sticker/bratvideo?text=${encodeURIComponent(text)}`,
                        `https://api.siputzx.my.id/api/m/bratvideo?text=${encodeURIComponent(text)}`,
                        `https://api.agatz.xyz/api/bratvideo?text=${encodeURIComponent(text)}`,
                        `https://widipe.com/bratvideo?text=${encodeURIComponent(text)}`
                    ];

                    let rawBuff = null;

                    for (let url of apis) {
                        try {
                            let req = await fetch(url, { 
                                headers: { 
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                                    'Accept': '*/*'
                                } 
                            });
                            
                            let contentType = req.headers.get('content-type') || '';
                            
                            // SKENARIO 1: API MENGEMBALIKAN JSON
                            if (contentType.includes('application/json')) {
                                let json = await req.json();
                                let mediaUrl = json?.data?.url || json?.url || json?.result?.url || (typeof json?.result === 'string' ? json.result : null);
                                
                                if (mediaUrl) {
                                    let tempBuff = await getBuffer(mediaUrl);
                                    if (tempBuff && tempBuff.length > 2000) {
                                        rawBuff = tempBuff;
                                        break;
                                    }
                                }
                            } 
                            // SKENARIO 2: API MENGEMBALIKAN FILE VIDEO/GAMBAR MENTAH
                            else {
                                let buff = await req.arrayBuffer();
                                let tempBuff = Buffer.from(buff);
                                if (tempBuff && tempBuff.length > 2000) {
                                    rawBuff = tempBuff;
                                    break;
                                }
                            }
                        } catch (e) {}
                    }

                    if (!rawBuff) return reply("😵‍💫 _Mohon maaf, semua studio desain animasi (API) sedang penuh atau server memblokir akses._");

                    let isMp4 = rawBuff[0] === 0x00 && rawBuff[1] === 0x00 && rawBuff[2] === 0x00 && 
                                (rawBuff[3] === 0x18 || rawBuff[3] === 0x20 || rawBuff[3] === 0x14 || rawBuff[3] === 0x1C) && 
                                rawBuff[4] === 0x66 && rawBuff[5] === 0x74 && rawBuff[6] === 0x79 && rawBuff[7] === 0x70;
                    
                    if (isMp4) {
                        await sock.sendMessage(from, { video: rawBuff, gifPlayback: true, caption: "🎩 _Desain Brat Video Exclusive_" }, { quoted: m });
                    } else {
                        await sock.sendMessage(from, { sticker: rawBuff }, { quoted: m });
                    }
                    break;
                }

                case 'bratpink': {
                    if (!text) return reply("📝 _Mohon sertakan teksnya. Contoh: .bratpink Nailong VIP_");
                    await sendTyping(from, { text: "🪄 _Sedang mencetak desain brat pink eksklusif..._" }, { quoted: m }, namaRuang, sender);
                    
                    const apis = [
                        `https://api.siputzx.my.id/api/m/brat?text=${encodeURIComponent(text)}`,
                        `https://api.ryzendesu.vip/api/sticker/brat?text=${encodeURIComponent(text)}`,
                        `https://widipe.com/brat?text=${encodeURIComponent(text)}`
                    ];

                    let rawBuff = null;
                    for (let url of apis) {
                        let buff = await getBuffer(url);
                        if (buff && buff.length > 2000) {
                            rawBuff = buff;
                            break;
                        }
                    }

                    if (!rawBuff) return reply("😵‍💫 _Mohon maaf, semua studio desain (API) sedang penuh._");

                    try {
                        const finalStickerBuffer = await sharp(rawBuff)
                            .tint({ r: 255, g: 105, b: 180 })
                            .trim()
                            .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
                            .webp({ quality: 90 })
                            .toBuffer();

                        if (finalStickerBuffer) {
                            await sock.sendMessage(from, { sticker: finalStickerBuffer }, { quoted: m });
                        } else {
                            throw new Error("Gagal render");
                        }
                    } catch (e) {
                        await sock.sendMessage(from, { image: rawBuff, caption: "🎩 _Desain Brat Pink Exclusive_" }, { quoted: m });
                    }
                    break;
                }

                case 'qc': {
                    if (!text) return reply("📝 _Tinggalkan kutipan Anda di sini, Tuan/Nyonya. Contoh: .qc Selamat pagi dunia_");
                    await sendTyping(from, { text: "🪄 _Sedang melukis kutipan berharga Anda..._" }, { quoted: m }, namaRuang, sender);
                    
                    let ppUrl;
                    try {
                        ppUrl = await sock.profilePictureUrl(sender, 'image');
                    } catch {
                        ppUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_960_720.png';
                    }
                    
                    const nameUser = m.pushName || "Member VIP";
                    
                    const qcApis = [
                        `https://api.siputzx.my.id/api/m/qc?text=${encodeURIComponent(text)}&name=${encodeURIComponent(nameUser)}&avatar=${encodeURIComponent(ppUrl)}`,
                        `https://api.ryzendesu.vip/api/sticker/qc?text=${encodeURIComponent(text)}&name=${encodeURIComponent(nameUser)}&avatar=${encodeURIComponent(ppUrl)}`,
                        `https://widipe.com/qc?text=${encodeURIComponent(text)}&name=${encodeURIComponent(nameUser)}&avatar=${encodeURIComponent(ppUrl)}`
                    ];

                    let rawBuff = null;
                    for (let url of qcApis) {
                        let buff = await getBuffer(url);
                        if (buff && buff.length > 2000) {
                            rawBuff = buff;
                            break;
                        }
                    }

                    if (!rawBuff) return reply("🍷 _Mohon maaf, server desain sedang mengalami kendala teknis._");

                    const finalStickerBuffer = await createSticker(rawBuff, false);
                    if (finalStickerBuffer) {
                        await sock.sendMessage(from, { sticker: finalStickerBuffer }, { quoted: m });
                    } else {
                        await sock.sendMessage(from, { image: rawBuff, caption: "🎩 _Desain Quote Exclusive_" }, { quoted: m });
                    }
                    break;
                }

                case 'addstock': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    const [kategori, ...isiDataArr] = text.split('@');
                    if (!kategori || !isiDataArr.length) return reply("🖋️ _Format penulisan:_ *.addstock Nama@Isi Akun*\n_Contoh:_ *.addstock chatgpt@email:pass | Keterangan*");
                    
                    const cat = kategori.trim().toLowerCase();
                    const isiAkun = isiDataArr.join('@').trim();
                    
                    if (!db.stock[cat]) db.stock[cat] = [];
                    db.stock[cat].push(isiAkun);
                    saveDb();
                    
                    reply(`📥 *Brankas Diperbarui!*\nSatu stok telah dimasukkan ke dalam laci *${cat.toUpperCase()}*. Total stok saat ini: ${db.stock[cat].length} aset. 🎩`);
                    break;
                }

                case 'getstock': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    const cat = text.trim().toLowerCase();
                    if (!cat) return reply("🖋️ _Mohon sebutkan laci mana yang ingin dibuka._\n_Contoh:_ *.getstock chatgpt*");
                    
                    if (!db.stock[cat] || db.stock[cat].length === 0) {
                        return reply(`📭 _Mohon maaf, laci stok *${cat.toUpperCase()}* saat ini sedang kosong._`);
                    }
                    
                    const akunDiambil = db.stock[cat].shift(); 
                    saveDb();
                    
                    let txtRes = `🗝️ *PENGAMBILAN ASET BERHASIL* 🗝️\n\n` +
                                 `*Kategori:* ${cat.toUpperCase()}\n` +
                                 `*Detail Akun:*\n${akunDiambil}\n\n` +
                                 `_Sisa stok di laci ini: ${db.stock[cat].length}_ 🎩`;

                    if (from.endsWith('@g.us')) {
                        await sock.sendPresenceUpdate('composing', sender);
                        const delayPM = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
                        await new Promise(res => setTimeout(res, delayPM));
                        await sock.sendPresenceUpdate('paused', sender);
                        
                        await sock.sendMessage(sender, { text: txtRes });
                        reply("📦 _Satu aset telah dikeluarkan dari brankas dan dikirimkan secara rahasia ke pesan pribadi (PM) Anda, Tuan/Nyonya._ 🎩");
                        logConsole('OUT', sender, 'Private Chat (Stock)', txtRes);
                    } else {
                        await sendTyping(from, { text: txtRes }, { quoted: m }, namaRuang, sender);
                    }
                    break;
                }

                case 'cekstock': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    let keys = Object.keys(db.stock);
                    if (keys.length === 0) return reply("📭 _Brankas stok masih sepenuhnya kosong._");
                    
                    let res = `🗄️ *I N V E N T O R Y  B R A N K A S* 🗄️\n\n`;
                    for (let k of keys) {
                        res += `   ⊳ *${k.toUpperCase()}* : ${db.stock[k].length} akun\n`;
                    }
                    res += `\n_Gunakan .getstock [nama] untuk mengambilnya._ 🎩`;
                    await sendTyping(from, { text: res }, { quoted: m }, namaRuang, sender);
                    break;
                }

                case 'p':
                case 'proses': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    let target = m.message.extendedTextMessage?.contextInfo?.participant || m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!target) return reply("🔖 _Silakan balas (reply) pesan pelanggan yang ingin diproses._");
                    
                    let responP = `⚙️ *W E  A R E  O N  I T* ⚙️\n\n` +
                                  `Pesanan Anda telah kami terima dengan hormat, kak @${target.split('@')[0]}.\n` +
                                  `Mohon berikan kami waktu sejenak untuk memastikan segalanya sempurna. \n` +
                                  `Staf kami sedang bekerja di balik layar... 🎩✨`;
                    await sendTyping(from, { text: responP, mentions: [target] }, { quoted: m }, namaRuang, target);
                    break;
                }

                case 'd':
                case 'done': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    let target = m.message.extendedTextMessage?.contextInfo?.participant || m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!target) return reply("🔖 _Silakan balas (reply) pesan pelanggan yang transaksinya sudah selesai._");
                    
                    let responD = `🎩 *S U C C E S S  D E L I V E R Y* 🎩\n\n` +
                                  `Voila! ✨ Kak @${target.split('@')[0]}, aset digital Anda telah siap digunakan.\n\n` +
                                  `Semoga layanan kami membantu kelancaran urusan Anda hari ini. \n` +
                                  `Ditunggu pesanan berikutnya, *Cheers!* 🥂`;
                    await sendTyping(from, { text: responD, mentions: [target] }, { quoted: m }, namaRuang, target);
                    break;
                }

                case 'addlist': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    const [n, ...c] = text.split('@');
                    if (!n || !c.length) return reply("🖋️ _Format penulisan:_ *.addlist Nama@Deskripsi*\n_Contoh:_ *.addlist netflix@Premium 4K seharga 30K*");
                    db.list[n.trim().toLowerCase()] = c.join('@').trim();
                    saveDb(); 
                    reply(`✅ *Sukses!* Produk *${n.trim().toUpperCase()}* telah ditambahkan ke etalase utama.`);
                    break;
                }

                case 'list': {
                    let keys = Object.keys(db.list);
                    if (keys.length === 0) return reply("🕰️ _Etalase kami sedang dirapikan. Belum ada produk yang dipajang saat ini._");
                    let res = `⚜️ *E T A L A S E  P R O D U K* ⚜️\n\n_Ketik nama produk di bawah ini untuk melihat rinciannya:_\n\n`;
                    res += keys.sort().map((k, i) => `  ${i+1}. ⊳ *${k.toUpperCase()}*`).join('\n');
                    res += `\n\n_Kualitas Bintang Lima, Pelayanan Paripurna._ 🎩`;
                    await sendTyping(from, { text: res }, { quoted: m }, namaRuang, sender);
                    break;
                }

                case 'setpay': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    const qImg = m.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage || m.message.imageMessage;
                    if (!qImg) return reply("🖼️ _Mohon kirim atau balas gambar QRIS dengan caption_ *.setpay*");
                    const stream = await downloadContentFromMessage(qImg, 'image');
                    let buffer = Buffer.from([]);
                    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
                    db.payment.image = buffer.toString('base64');
                    db.payment.text = text || "💳 *G E R B A N G  P E M B A Y A R A N* 💳\n\nSilakan pindai kode QR di atas untuk menyelesaikan transaksi. Jika sudah, mohon sertakan bukti transfer di sini. ☕";
                    saveDb(); 
                    reply("✅ *Akses Pembayaran Diperbarui!* QRIS telah tersimpan rapi di sistem.");
                    break;
                }

                case 'pay': {
                    if (db.payment.image) {
                        await sendTyping(from, { image: Buffer.from(db.payment.image, 'base64'), caption: db.payment.text }, { quoted: m }, namaRuang, sender);
                    } else {
                        await sendTyping(from, { text: db.payment.text }, { quoted: m }, namaRuang, sender);
                    }
                    break;
                }

                case 'h':
                case 'hidetag': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, hanya manajemen yang memiliki akses fitur ini._");
                    if (!from.endsWith('@g.us')) return reply("❌ Fitur ini didesain khusus untuk ruangan grup.");
                    
                    const members = groupMetadata.participants.map(v => v.id);
                    const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

                    if (quotedMsg) {
                        try {
                            let type = Object.keys(quotedMsg)[0];
                            if (type === 'conversation' || type === 'extendedTextMessage') {
                                let textContent = type === 'conversation' ? quotedMsg.conversation : quotedMsg.extendedTextMessage.text;
                                await sock.sendMessage(from, { text: textContent, mentions: members });
                                logConsole('OUT', sender, namaRuang, `[HIDETAG TEXT] ${textContent}`);
                            } else {
                                let msgData = JSON.parse(JSON.stringify(quotedMsg));
                                if (!msgData[type].contextInfo) msgData[type].contextInfo = {};
                                msgData[type].contextInfo.mentionedJid = members;
                                await sock.relayMessage(from, msgData, {});
                                logConsole('OUT', sender, namaRuang, `[HIDETAG MEDIA] Broadcast Media`);
                            }
                        } catch (err) {
                            reply("😵‍💫 _Sistem mengalami kendala saat menyalin pesan._");
                        }
                    } else {
                        if (!text) return reply("📝 _Mohon sertakan teks atau balas pesan yang ingin diumumkan._");
                        await sock.sendMessage(from, { text: text, mentions: members });
                        logConsole('OUT', sender, namaRuang, `[HIDETAG TEXT] ${text}`);
                    }
                    break;
                }

                case 'open':
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    await sock.groupSettingUpdate(from, 'not_announcement');
                    reply("🔓 *PINTU TERBUKA* \n\nSelamat datang! Layanan telah beroperasi kembali. Silakan sampaikan kebutuhan Anda. ☕✨");
                    break;

                case 'close':
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    await sock.groupSettingUpdate(from, 'announcement');
                    reply("🔒 *PINTU TERTUTUP* \n\nJam operasional sedang jeda sejenak. Staf kami sedang beristirahat. Terima kasih atas pengertiannya! 🎩💤");
                    break;
            }
        } catch (err) { 
            console.log("System Error:", err); 
        }
    });
}
startBot();
