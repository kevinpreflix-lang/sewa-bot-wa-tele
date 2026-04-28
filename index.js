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
const qrcode = require('qrcode-terminal');

// ==========================================
// 🛡️ 1. ANTI CRASH SYSTEM
// ==========================================
process.on('uncaughtException', (err) => {
    let e = String(err);
    if (e.includes("conflict") || e.includes("not-authorized") || e.includes("rate-overlimit")) return;
    console.log('\x1b[31m[ 🚨 ERROR TEREDAM ]\x1b[0m ➜', err.message);
});

// ==========================================
// ⚙️ 2. KONFIGURASI UTAMA
// ==========================================
const config = {
    nomorBot: "6285179905048",
    nomorOwner: "6289519096772", 
    nameOwner: "Kevin Preflix",
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
// ⏰ 4. WAKTU & JADWAL SHOLAT
// ==========================================
const getWIBTime = () => {
    const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

const getGreeting = () => {
    const hour = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"})).getHours();
    if (hour >= 4 && hour < 11) return "Pagi";
    if (hour >= 11 && hour < 15) return "Siang";
    if (hour >= 15 && hour < 18) return "Sore";
    return "Malam";
};

const jadwalSholat = [
    { nama: "Sᴜʙᴜʜ", waktu: "04:30", emoji: "🌅" },
    { nama: "Dᴢᴜʜᴜʀ", waktu: "12:00", emoji: "☀️" },
    { nama: "Asʜᴀʀ", waktu: "15:15", emoji: "🌤️" },
    { nama: "Mᴀɢʜʀɪʙ", waktu: "18:00", emoji: "🌇" },
    { nama: "Isʏᴀ", waktu: "19:15", emoji: "🌙" }
];

const groupNameCache = {};

// ==========================================
// 📡 5. SISTEM MONITORING PANEL (CLASSIC LOG)
// ==========================================
const logConsole = (tipe, nomor, grup, pesan) => {
    const timeFull = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "long", timeStyle: "medium" });
    const isBot = tipe === 'OUT';
    
    const c = isBot ? "\x1b[32m" : "\x1b[36m"; 
    const r = "\x1b[0m"; 
    const icon = isBot ? "🤖 [BOT REPLY]" : "👤 [USER IN]  ";
    
    const cleanPesan = pesan ? pesan.replace(/\n/g, `\n${c}┊            ${r}`) : "[Media/Attachment]";

    console.log(`${c}╭┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}`);
    console.log(`${c}┊ 🕰️ ${timeFull}${r}`);
    console.log(`${c}┊ ${icon} : ${nomor.split('@')[0]}${r}`);
    console.log(`${c}┊ 🏛️ Ruang         : ${grup}${r}`);
    console.log(`${c}┊ 💬 Pesan         : ${cleanPesan}${r}`);
    console.log(`${c}╰┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈${r}\n`);
};

// ==========================================
// 🚀 6. MESIN UTAMA BOT
// ==========================================
async function startBot() {
    console.clear();
    console.log(`\x1b[33m╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮\x1b[0m`);
    console.log(`\x1b[33m┃\x1b[0m \x1b[36m 🎩 KEVIN PREFLIX EST. 2024... \x1b[0m \x1b[33m┃\x1b[0m`);
    console.log(`\x1b[33m╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\x1b[0m\n`);

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ["Kevin Preflix V-FINAL", "Chrome", "1.0.0"],
    });

    sock.ev.on('creds.update', saveCreds);

    const sendTyping = async (jid, content, options, namaGrup, nomorTarget) => {
        await sock.sendPresenceUpdate('composing', jid);
        // Delay acak antara 3000ms (3 detik) hingga 4000ms (4 detik)
        const delayTyping = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
        await new Promise(res => setTimeout(res, delayTyping));
        await sock.sendPresenceUpdate('paused', jid);
        
        let sentMsg = await sock.sendMessage(jid, content, options);
        let logText = content.text || content.caption || "[Mengirim Gambar/Media]";
        logConsole('OUT', nomorTarget, namaGrup, logText);
        return sentMsg;
    };

    let lastSholat = {};
    setInterval(async () => {
        try {
            const currentTime = getWIBTime();
            const sholatNow = jadwalSholat.find(j => j.waktu === currentTime);
            
            if (sholatNow) {
                const getGroups = await sock.groupFetchAllParticipating();
                
                for (let from in getGroups) {
                    if (lastSholat[from] !== currentTime) {
                        let grpName = getGroups[from].subject || "Unknown Group";
                        
                        try {
                            await sock.groupSettingUpdate(from, 'announcement');
                            
                            let txtClose = `⚜️ *JEDA TRANSAKSI SEJENAK* ⚜️\n\nHalo kak, sudah masuk waktu *${sholatNow.nama}* nih ${sholatNow.emoji}.\nSistem kami jeda 10 menit ya. Mari kita ambil wudhu dan tunaikan ibadah dulu. Ketenangan hati membawa berkah di setiap transaksi. ☕🤍`;
                            await sock.sendMessage(from, { text: txtClose });
                            logConsole('OUT', 'BROADCAST SHOLAT', grpName, txtClose);
                            
                            lastSholat[from] = currentTime;
                            
                            setTimeout(async () => {
                                try {
                                    await sock.groupSettingUpdate(from, 'not_announcement');
                                    let txtOpen = `🎩 *TOKO KEMBALI DIBUKA*\n\nAlhamdulillah, ibadah selesai! Pintu layanan sudah dibuka kembali. Mari kita lanjutkan hari yang indah ini! ✨`;
                                    await sock.sendMessage(from, { text: txtOpen });
                                    logConsole('OUT', 'BROADCAST SHOLAT', grpName, txtOpen);
                                } catch (errOpen) {}
                            }, 10 * 60 * 1000);
                            
                        } catch (errGroup) {}
                    }
                }
            }
        } catch (e) {
            console.log("Error Global Scheduler:", e.message);
        }
    }, 30000);

    sock.ev.on('connection.update', (up) => {
        const { connection, lastDisconnect, qr } = up;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') {
            console.log(`\x1b[32m[ ✓ ] KONEKSI STABIL. BOT SIAP MELAYANI!\x1b[0m\n`);
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
            // 🚫 SISTEM BLOKIR SPAM PRIVATE CHAT 🚫
            // ==========================================
            if (!from.endsWith('@g.us') && !isOwner) {
                let warnTxt = `⚜️ *SISTEM KEAMANAN KEVIN PREFLIX* ⚜️\n\n` +
                              `⚠️ *PERINGATAN KERAS* ⚠️\n` +
                              `Dilarang chat nomor bot ini secara pribadi! Anda dikenakan denda sebesar *Rp 10.000*.\n\n` +
                              `_Jika Anda masih melakukan spam di sini, sistem kami akan mengirimkan bug UI (Crash System) ke perangkat Anda! Harap bertransaksi hanya di dalam grup._ 🎩`;
                
                await sendTyping(from, { text: warnTxt }, { quoted: m }, "Private Chat", sender);
                return; 
            }

            const budy = rawBody.toLowerCase();
            const isCmd = budy.startsWith(config.prefix);
            const command = isCmd ? budy.slice(config.prefix.length).trim().split(/ +/).shift() : budy.split(/ +/).shift();
            const text = isCmd ? rawBody.slice(config.prefix.length + command.length).trim() : rawBody.slice(command.length).trim();

            const reply = async (teks) => {
                await sock.sendPresenceUpdate('composing', from);
                const delayTyping = Math.floor(Math.random() * (4000 - 3000 + 1)) + 3000;
                await new Promise(res => setTimeout(res, delayTyping));
                await sock.sendPresenceUpdate('paused', from);
                await sock.sendMessage(from, { text: teks }, { quoted: m });
                logConsole('OUT', sender, namaRuang, teks);
            };

            // Auto Response List tanpa titik
            if (!isCmd && db.list[budy]) {
                let textRes = `\`\`\`[ PRODUCT DETAILS ]\`\`\`\n\n${db.list[budy]}\n\n_Berminat? Ketik .pay untuk melihat metode pembayaran kami._ ☕`;
                return await sendTyping(from, { text: textRes }, { quoted: m }, namaRuang, sender);
            }

            switch (command) {
                case 'menu':
                case 'help':
                    let mnu = `⚜️ *K E V I N  P R E F L I X* ⚜️\n` +
                              `_Elegance in Every Transaction_\n\n` +
                              `Selamat ${getGreeting()}, Kak! ☕\n` +
                              `Ada yang bisa kami bantu hari ini?\n\n` +
                              `┌── « 🛍️ *C O N C I E R G E* »\n` +
                              `│ ⊳ *.list* (Katalog Eksklusif)\n` +
                              `│ ⊳ *.pay* (Metode Pembayaran)\n` +
                              `└───────────────────────────\n`;

                    if (isAuthorized) {
                        mnu += `\n┌── « 🎩 *A D M I N   O N L Y* »\n` +
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

                // ==========================================
                // 🗄️ MANAJEMEN BRANKAS (STOCK AKUN) 🗄️
                // ==========================================
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
                        res += `  ⊳ *${k.toUpperCase()}* : ${db.stock[k].length} akun\n`;
                    }
                    res += `\n_Gunakan .getstock [nama] untuk mengambilnya._ 🎩`;
                    await sendTyping(from, { text: res }, { quoted: m }, namaRuang, sender);
                    break;
                }

                // ==========================================
                // ⚙️ MANAJEMEN TRANSAKSI & ETALASE ⚙️
                // ==========================================
                case 'p':
                case 'proses': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    let target = m.message.extendedTextMessage?.contextInfo?.participant || m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!target) return reply("🔖 _Silakan balas (reply) pesan pelanggan yang ingin diproses._");
                    
                    let responP = `⚙️ *P E S A N A N  D I T E R I M A* ⚙️\n\n` +
                                  `Halo kak @${target.split('@')[0]}! 👋\n` +
                                  `Silakan duduk santai ☕. Tim kami sedang meracik pesanan kakak dengan penuh ketelitian.\n` +
                                  `Mohon ditunggu sebentar ya! ✨`;
                    await sendTyping(from, { text: responP, mentions: [target] }, { quoted: m }, namaRuang, target);
                    break;
                }

                case 'd':
                case 'done': {
                    if (!isAuthorized) return reply("🍷 _Mohon maaf, akses ditolak._");
                    let target = m.message.extendedTextMessage?.contextInfo?.participant || m.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
                    if (!target) return reply("🔖 _Silakan balas (reply) pesan pelanggan yang transaksinya sudah selesai._");
                    
                    let responD = `🎩 *T R A N S A K S I  S E L E S A I* 🎩\n\n` +
                                  `Voila! ✨ Kak @${target.split('@')[0]}, pesanan Anda sudah mendarat dengan selamat.\n\n` +
                                  `Terima kasih telah mempercayakan kebutuhan digital Anda kepada kami. Kami tunggu kedatangan Anda selanjutnya! 🥂`;
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

                case 'bot':
                    await sendTyping(from, { text: "Panggilan diterima, Tuan/Nyonya! 🎩✨ Asisten Kevin Preflix senantiasa berjaga di sini. Ada yang bisa dibantu?" }, { quoted: m }, namaRuang, sender);
                    break;
            }
        } catch (err) { 
            console.log("System Error:", err); 
        }
    });
}
startBot();
