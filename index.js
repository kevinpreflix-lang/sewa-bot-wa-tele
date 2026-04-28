const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    getContentType,
    fetchLatestBaileysVersion,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');

// --- ✧ CONFIGURATION ✧ ---
const config = {
    nomorBot: "628xxx",     // <--- ISI NOMOR PELANGGAN DI SINI
    nomorOwner: "628xxx",   // <--- NOMOR KAMU SEBAGAI PUSAT
    prefix: "."
};

// --- ✧ DATABASE SYSTEM (PRIVATE PER FOLDER) ✧ ---
const dbPath = './database.json';
const initDb = { 
    list: {}, 
    payment: { text: "ʙᴇʟᴜᴍ ᴅɪᴀᴛᴜʀ.", image: null }, 
    scheduler: { open: "07.00", close: "22.30" },
    rent: { status: false, expired: null }, // Sistem sewa per grup
    responses: {
        proses: "ᴘᴇsᴀɴᴀɴ ᴀɴᴅᴀ sᴇᴅᴀɴɢ ᴅᴀʟᴀᴍ ᴘʀᴏsᴇs. ᴍᴏʜᴏɴ ᴍᴇɴᴜɴɢɢᴜ.",
        done: "ᴛᴇʀɪᴍᴀ ᴋᴀsɪʜ ᴛᴇʟᴀʜ ᴍᴇɴɢɢᴜɴᴀᴋᴀɴ ʟᴀʏᴀɴᴀɴ ᴋᴀᴍɪ! ♡"
    }
};

function loadDb() {
    try {
        if (!fs.existsSync(dbPath)) {
            fs.writeFileSync(dbPath, JSON.stringify(initDb, null, 2));
            return initDb;
        }
        const data = fs.readFileSync(dbPath, 'utf8');
        return data ? JSON.parse(data) : initDb;
    } catch (e) { return initDb; }
}
let db = loadDb();
const saveDb = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBot() {
    // Setiap folder bot akan memiliki folder auth_info sendiri
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'fatal' }),
        browser: ["Luxury Bot", "Chrome", "20.0.04"]
    });

    // --- ✧ AUTO SCHEDULER & RENT CHECK ✧ ---
    setInterval(async () => {
        try {
            const skrg = new Date();
            const jktTime = skrg.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit', hour12: false }).replace(':', '.');
            const groups = Object.keys(await sock.groupFetchAllParticipating());

            for (let jid of groups) {
                // 1. Scheduler Open/Close
                if (jktTime === db.scheduler.open) await sock.groupSettingUpdate(jid, 'not_announcement');
                if (jktTime === db.scheduler.close) await sock.groupSettingUpdate(jid, 'announcement');

                // 2. Rent System Check
                if (db.rent[jid]) {
                    const exp = new Date(db.rent[jid]);
                    if (skrg > exp) {
                        await sock.sendMessage(jid, { text: "⚠️ *ᴍᴀsᴀ sᴇᴡᴀ ʙᴏᴛ ᴛᴇʟᴀʜ ʜᴀʙɪs!* ⚠️\nʙᴏᴛ ᴀᴋᴀɴ ᴋᴇʟᴜᴀʀ ᴏᴛᴏᴍᴀᴛɪs." });
                        await wait(3000);
                        await sock.groupLeave(jid);
                        delete db.rent[jid];
                        saveDb();
                    }
                }
            }
        } catch (e) {}
    }, 60000);

    // --- ✧ PAIRING CODE SYSTEM ✧ ---
    if (!sock.authState.creds.registered) {
        console.log(`\x1b[36m[SYSTEM]\x1b[0m Memulai Pairing untuk Nomor: ${config.nomorBot}`);
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(config.nomorBot);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\x1b[32mKODE PAIRING ANDA: ${code}\x1b[0m`);
            } catch (err) { console.log('Gagal meminta kode, pastikan nomor benar.'); }
        }, 10000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (up) => {
        const { connection, lastDisconnect } = up;
        if (connection === 'open') console.log(`✧ Bot ${config.nomorBot} Berhasil Online! ✧`);
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const type = getContentType(m.message);
        let body = (type === 'conversation') ? m.message.conversation : (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : (type === 'imageMessage') ? m.message.imageMessage.caption : '';
        body = body.replace(/\s+/g, ' ').trim();

        const sender = m.key.participant || m.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const isOwner = sender.includes(config.nomorOwner.replace(/[^0-9]/g, ''));
        const quoted = m.message.extendedTextMessage?.contextInfo || null;

        let isAdmin = false;
        if (isGroup) {
            try {
                const groupMetadata = await sock.groupMetadata(from);
                isAdmin = groupMetadata.participants.find(p => p.id === sender)?.admin || false;
            } catch (e) {}
        }

        const sendAction = async (jid, content, options) => {
            await sock.sendPresenceUpdate('composing', jid);
            await wait(1200); 
            return await sock.sendMessage(jid, content, options);
        };

        // --- ✧ AUTO RESPOND LIST & BOT ✧ ---
        if (db.list[body]) return await sendAction(from, { text: db.list[body] }, { quoted: m });
        if (body.toLowerCase() === 'bot' && (isAdmin || isOwner)) return await sendAction(from, { text: "✧ sɪᴀᴘ ᴋᴀ, ᴀᴅᴀ ʏᴀɴɢ ʙɪsᴀ ᴀᴋᴜ ʙᴀɴᴛᴜ? ♡" }, { quoted: m });

        // --- ✧ STITCH P/D ✧ ---
        if (quoted && (isAdmin || isOwner)) {
            const target = quoted.participant;
            const now = new Date();
            const tgl = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: '2-digit', month: 'long', year: 'numeric' });
            const wkt = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + " WIB";
            const replyKey = { key: { remoteJid: from, fromMe: false, id: quoted.stanzaId, participant: target }, message: { conversation: "..." } };

            if (body.toLowerCase() === 'p') {
                let pTxt = `🚀 *ᴛʀᴀɴsᴀᴋsɪ sᴇᴅᴀɴɢ ᴘʀᴏsᴇs* 🚀\n\n🗓️ ᴛɢʟ : ${tgl}\n⌚ ᴊᴀᴍ : ${wkt}\n👤 ᴛᴀɢ : @${target.split('@')[0]}\n\n_${db.responses.proses}_`;
                return await sendAction(from, { text: pTxt, mentions: [target] }, { quoted: replyKey });
            }
            if (body.toLowerCase() === 'done' || body.toLowerCase() === 'd') {
                let dTxt = `✅ *ᴛʀᴀɴsᴀᴋsɪ ʙᴇʀʜᴀsɪʟ!* 🎉\n\n🗓️ ᴛɢʟ : ${tgl}\n⌚ ᴊᴀᴍ : ${wkt}\n👤 ᴛᴀɢ : @${target.split('@')[0]}\n\n_${db.responses.done}_`;
                return await sendAction(from, { text: dTxt, mentions: [target] }, { quoted: replyKey });
            }
        }

        if (!body.startsWith(config.prefix)) return;
        const args = body.slice(config.prefix.length).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        const text = args.join(" ");

        switch (command) {
            case 'menu':
                let mnu = `╭─── ✧  「 *ᴍᴇɴᴜ ᴜᴛᴀᴍᴀ* 」\n│\n│ ✧ .addlist / .dellist\n│ ✧ .list / .pay\n│ ✧ .rent (ᴄᴇᴋ sᴇᴡᴀ)\n│ ✧ .addrent (ᴏᴡɴᴇʀ)\n│ ✧ .setopen / .setclose\n│\n╰───────────────── ✧\n\n_ᴘᴏᴡᴇʀᴇᴅ ʙʏ ᴋᴇᴠɪɴ ᴘʀᴇꜰʟɪx_`;
                await sendAction(from, { text: mnu });
                break;

            case 'addrent':
                if (!isOwner) return;
                const hari = parseInt(args[0]);
                if (isNaN(hari)) return sendAction(from, { text: "✧ Contoh: .addrent 30" });
                let exp = new Date();
                exp.setDate(exp.getDate() + hari);
                db.rent[from] = exp.toISOString();
                saveDb();
                await sendAction(from, { text: `✅ sᴇᴡᴀ ᴀᴋᴛɪꜰ sᴇʟᴀᴍᴀ *${hari} ʜᴀʀɪ*` });
                break;

            case 'rent':
                if (!db.rent[from]) return sendAction(from, { text: "✧ ɢʀᴜᴘ ɪɴɪ ʙᴇʟᴜᴍ sᴇᴡᴀ." });
                const d = new Date(db.rent[from]);
                await sendAction(from, { text: `╭─── ✧  「 *ɪɴꜰᴏ sᴇᴡᴀ* 」\n│\n│ ✧ ᴇxᴘ: ${d.toLocaleDateString('id-ID')}\n│ ✧ sᴛᴀᴛᴜs: ᴀᴋᴛɪꜰ ✅\n╰───────────────── ✧` });
                break;

            case 'addlist':
                if (!isAdmin && !isOwner) return;
                const [n, ...v] = text.split('@');
                db.list[n.trim()] = v.join('@').trim();
                saveDb();
                await sendAction(from, { text: `✅ sᴜᴋsᴇs ᴍᴇɴᴀᴍʙᴀʜᴋᴀɴ *${n.trim()}*` });
                break;

            case 'list':
                const sorted = Object.keys(db.list).sort();
                let res = `╭─── ✧  「 *ᴅᴀꜰᴛᴀʀ ᴘʀᴏᴅᴜᴋ* 」\n│\n`;
                sorted.forEach(k => res += `│ • ${k}\n`);
                res += `│\n╰───────────────── ✧`;
                await sendAction(from, { text: res });
                break;
        }
    });
}

startBot();
