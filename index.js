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
const sharp = require('sharp'); 

// ==========================================
// 🛡️ 1. ANTI CRASH & DETEKSI WEBP
// ==========================================
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("rate-overlimit") || e.includes("Connection Closed")) return;
    console.log('\x1b[31m[ 🚨 ERROR TEREDAM ]\x1b[0m ➜', err.message);
});

// ==========================================
// ⚙️ 2. KONFIGURASI UTAMA
// ==========================================
const config = {
    nomorBot: "6285179905048", 
    nomorOwner: "6289519096772", 
    nameOwner: "Nailong VIP",
    prefix: ".",
    emailUtama: "purnawankevin63@gmail.com" 
};

// ==========================================
// 🗄️ 3. DATABASE SYSTEM
// ==========================================
const dbPath = './database.json';
let db = { list: {}, payment: { text: "⚠️ *QRIS BELUM DIATUR* ⚠️\n\nSilahkan minta admin untuk setpay.", image: null }, settings: {}, stock: {} };

const loadDb = () => {
    try {
        if (fs.existsSync(dbPath)) {
            db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (!db.stock) db.stock = {}; 
        } else { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
    } catch (e) { fs.writeFileSync(dbPath, JSON.stringify(db, null, 2)); }
};
loadDb();
const saveDb = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

const logConsole = (tipe, nomor, grup, pesan) => {
    const timeFull = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "medium" });
    const isBot = tipe === 'OUT';
    const c = isBot ? "\x1b[32m" : "\x1b[36m"; 
    const r = "\x1b[0m"; 
    const icon = isBot ? "🤖 [BOT REPLY]" : "👤 [USER IN]  ";
    const cleanPesan = pesan ? pesan.replace(/\n/g, `\n${c}┊             ${r}`) : "[Media/Attachment]";
    console.log(`${c}╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}`);
    console.log(`${c}┊ 🕰️ ${timeFull} | ${icon} : ${nomor.split('@')[0]} | Ruang : ${grup}${r}`);
    console.log(`${c}┊ 💬 Pesan : ${cleanPesan}${r}`);
    console.log(`${c}╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}\n`);
};

// ==========================================
// 🚀 7. MESIN UTAMA BOT
// ==========================================
async function startBot() {
    console.clear();
    console.log(`\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
    console.log(`\x1b[33m┃\x1b[0m \x1b[36m 🎩 NAILONG VIP SYSTEM EST. 2024 \x1b[0m \x1b[33m┃\x1b[0m`);
    console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m\n`);

    // 🔥 PERUBAHAN PENTING: Mengubah nama folder sesi untuk memaksa reset 100%
    const { state, saveCreds } = await useMultiFileAuthState('sesi_nailong_baru');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        printQRInTerminal: false, 
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], 
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = config.nomorBot.replace(/[^0-9]/g, '');
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
                console.log(`\x1b[33m┃\x1b[0m \x1b[32m🔑 KODE PAIRING ANDA: \x1b[36m${code} \x1b[0m \x1b[33m┃\x1b[0m`);
                console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m`);
                console.log(`\x1b[37mCEPAT! Buka notifikasi WhatsApp di HP Bot Anda dan masukkan kode di atas.\x1b[0m\n`);
            } catch (err) {
                console.log(`\x1b[31m[ 🚨 ERROR ] Gagal mendapatkan kode:\x1b[0m`, err.message);
            }
        }, 3000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (up) => {
        const { connection, lastDisconnect } = up;
        
        if (connection === 'open') {
            console.log(`\x1b[32m[ ✓ ] KONEKSI STABIL. BOT NAILONG VIP SIAP MELAYANI!\x1b[0m\n`);
        }
        if (connection === 'close') {
            const statusCode = (lastDisconnect.error instanceof Boom)?.output?.statusCode;
            const r = statusCode !== DisconnectReason.loggedOut;
            if (r) {
                // 🔥 ANTI SPAM LOOPING: Menambahkan jeda 5 detik sebelum restart
                console.log(`\x1b[33m[ ! ] Koneksi terputus (Code: ${statusCode}), mencoba ulang dalam 5 detik...\x1b[0m`);
                setTimeout(startBot, 5000);
            } else {
                console.log(`\x1b[31m[ ! ] Perangkat Dikeluarkan. Silakan hubungkan ulang.\x1b[0m`);
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
            if (rawBody) logConsole('IN', sender, "Chat", rawBody);

            const isOwner = sender.includes(config.nomorOwner.replace(/[^0-9]/g, ''));
            const budy = rawBody.toLowerCase();
            const isCmd = budy.startsWith(config.prefix);
            const command = isCmd ? budy.slice(config.prefix.length).trim().split(/ +/).shift() : budy.split(/ +/).shift();
            const text = isCmd ? rawBody.slice(config.prefix.length + command.length).trim() : rawBody.slice(command.length).trim();

            const reply = async (teks) => {
                await sock.sendMessage(from, { text: teks }, { quoted: m });
                logConsole('OUT', sender, "Chat", teks);
            };

            switch (command) {
                case 'menu':
                    reply(`⚜️ *N A I L O N G  V I P* ⚜️\n_Your premium digital partner._ ✨`);
                    break;
                case 'addstock': 
                    if (!isOwner) return reply("🍷 _Akses ditolak._");
                    const [kategori, ...isiDataArr] = text.split('@');
                    if (!kategori || !isiDataArr.length) return reply("🖋️ _Format: .addstock Nama@Isi Akun_");
                    const cat = kategori.trim().toLowerCase();
                    const isiAkun = isiDataArr.join('@').trim();
                    if (!db.stock[cat]) db.stock[cat] = [];
                    db.stock[cat].push(isiAkun);
                    saveDb();
                    reply(`📥 *Stok ditambahkan ke laci ${cat.toUpperCase()}!*`);
                    break;
                case 'cekstock':
                    if (!isOwner) return reply("🍷 _Akses ditolak._");
                    let keys = Object.keys(db.stock);
                    if (keys.length === 0) return reply("📭 _Brankas kosong._");
                    let res = `🗄️ *INVENTORY BRANKAS* 🗄️\n\n`;
                    for (let k of keys) { res += `   ⊳ *${k.toUpperCase()}* : ${db.stock[k].length} akun\n`; }
                    reply(res);
                    break;
                case 'ping':
                    reply("PONG! 🏓 Bot Aktif.");
                    break;
            }
        } catch (err) { console.log(err); }
    });
}
startBot();
