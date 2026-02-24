const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const moment = require('moment-timezone');
const axios = require('axios');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('El bot de WhatsApp está funcionando 24/7 🚀');
});

app.listen(port, () => {
  console.log(`🌐 Servidor web escuchando en el puerto ${port}`);
});

const TIMEZONE = 'America/El_Salvador';
const ADMIN_CREDENTIALS = {
    username: "jarabe",
    password: "jarabe123"
};

const FIREBASE_CONFIG = {
    databaseURL: "https://seguridadterritorial-64f0f-default-rtdb.firebaseio.com/"
};

const FIREBASE_RECLAMOS_CONFIG = {
    apiKey: "AIzaSyAneea8jq-qIoymTG909zP76OjcFx7ufa8",
    authDomain: "reclamo-39ff3.firebaseapp.com",
    projectId: "reclamo-39ff3",
    messagingSenderId: "443679031726",
    appId: "1:443679031726:web:568838f29089d4fb74483f"
};

const FIREBASE_GUARDIAN_CONFIG = {
    apiKey: "AIzaSyC0ySpb88p6jf3v8S6zC9lUQhE3XBqHpCc",
    authDomain: "reportesdeguardian.firebaseapp.com",
    databaseURL: "https://reportesdeguardian-default-rtdb.firebaseio.com",
    projectId: "reportesdeguardian",
    storageBucket: "reportesdeguardian.appspot.com",
    messagingSenderId: "109827856831",
    appId: "1:109827856831:web:89a7b114733f7bc6e55fe5"
};

const FIREBASE_CIP_CONFIG = {
    apiKey: "AIzaSyDuumSoM9tuDTrw6TWLqhGKdT94hX_cIbA",
    authDomain: "cijarabe2.firebaseapp.com",
    databaseURL: "https://cijarabe2-default-rtdb.firebaseio.com/",
    projectId: "cijarabe2",
    storageBucket: "cijarabe2.firebasestorage.app",
    messagingSenderId: "502025011637",
    appId: "1:502025011637:web:9e38b7eb79686226a7d9fc"
};

const userStates = new Map();
const scheduledMessages = [];
let availableGroups = [];

const TANQUES_LIST = [
    'TQ 1', 'TQ 2', 'TQ 3', 'TQ 4', 'TQ 5', 'TQ 6', 'TQ 7', 'TQ 8', 'TQ 9', 'TQ 10',
    'TQ 11', 'TQ 12', 'TQ 13', 'TQ 14', 'TQ 15', 'TQ 16', 'TQ 400'
];

const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

async function findChrome() {
    const possiblePaths = [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/app/.apt/usr/bin/google-chrome',
        '/app/.apt/usr/bin/chromium-browser'
    ];
    
    for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
            console.log(`✅ Chrome encontrado en: ${path}`);
            return path;
        }
    }
    
    try {
        const { execSync } = require('child_process');
        const which = execSync('which google-chrome-stable || which chromium-browser || which chromium').toString().trim();
        if (which) {
            console.log(`✅ Chrome encontrado via which: ${which}`);
            return which;
        }
    } catch (e) {}
    
    console.log('⚠️ Chrome no encontrado, usando chromium-browser por defecto');
    return '/usr/bin/chromium-browser';
}

const chromePath = await findChrome();

const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "bot-seguridad",
        dataPath: path.join(__dirname, 'whatsapp-session')
    }),
    puppeteer: {
        headless: true,
        executablePath: chromePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions'
        ]
    },
    webVersionCache: {
        type: "remote",
        remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html"
    }
});

function crearCarpetas() {
    const carpetas = [
        path.join(__dirname, 'whatsapp-session'),
        path.join(__dirname, 'temp'),
        path.join(__dirname, 'media'),
        path.join(__dirname, 'imagenes-programadas'),
        path.join(__dirname, 'videos-programados'),
        path.join(__dirname, 'pdf-programados'),
        path.join(__dirname, 'reportes-cip')
    ];
    
    carpetas.forEach(carpeta => {
        if (!fs.existsSync(carpeta)) {
            fs.mkdirSync(carpeta, { recursive: true });
        }
    });
}

function limpiarArchivosTemporales() {
    console.log(`🧹 Iniciando limpieza de archivos temporales...`);
    
    const carpetasALimpiar = [
        path.join(__dirname, 'temp'),
        path.join(__dirname, 'media', 'imagenes'),
        path.join(__dirname, 'media', 'videos'),
        path.join(__dirname, 'media', 'documentos'),
        path.join(__dirname, 'media', 'otros'),
        path.join(__dirname, 'reportes-cip')
    ];
    
    const ahora = Date.now();
    const tiempoMaximo = 24 * 60 * 60 * 1000;
    let archivosEliminados = 0;
    let espacioLiberado = 0;
    
    carpetasALimpiar.forEach(carpeta => {
        if (fs.existsSync(carpeta)) {
            try {
                const archivos = fs.readdirSync(carpeta);
                
                archivos.forEach(archivo => {
                    const rutaCompleta = path.join(carpeta, archivo);
                    
                    try {
                        const stats = fs.statSync(rutaCompleta);
                        
                        if (stats.isFile()) {
                            const tiempoArchivo = stats.mtimeMs;
                            const edadArchivo = ahora - tiempoArchivo;
                            
                            if (edadArchivo > tiempoMaximo) {
                                const tamañoArchivo = stats.size;
                                fs.unlinkSync(rutaCompleta);
                                archivosEliminados++;
                                espacioLiberado += tamañoArchivo;
                            }
                        }
                    } catch (error) {}
                });
            } catch (error) {}
        }
    });
    
    if (archivosEliminados > 0) {
        console.log(`✅ Limpieza: ${archivosEliminados} archivos (${(espacioLiberado / (1024 * 1024)).toFixed(2)} MB)`);
    }
}

function obtenerSaludo() {
    const horaActual = moment().tz(TIMEZONE).hour();
    
    if (horaActual >= 6 && horaActual < 12) {
        return "buenos días";
    } else if (horaActual >= 12 && horaActual < 18) {
        return "buenas tardes";
    } else {
        return "buenas noches";
    }
}

function parsearHora(horaString) {
    const regex24h = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const regex12h = /^([0-1]?[0-9]):([0-5][0-9])\s*(am|pm)$/i;
    
    horaString = horaString.trim().toLowerCase();
    
    if (regex24h.test(horaString)) {
        const [horas, minutos] = horaString.split(':');
        return `${horas.padStart(2, '0')}:${minutos}`;
    }
    
    if (regex12h.test(horaString)) {
        const match = horaString.match(/^(\d+):(\d+)\s*(am|pm)$/);
        let horas = parseInt(match[1]);
        const minutos = match[2];
        const periodo = match[3];
        
        if (periodo === 'pm' && horas < 12) horas += 12;
        if (periodo === 'am' && horas === 12) horas = 0;
        
        return `${horas.toString().padStart(2, '0')}:${minutos}`;
    }
    
    return null;
}

async function guardarArchivo(media, userId, tipo) {
    let carpeta = '';
    let extension = '';
    
    if (tipo === 'imagen') {
        carpeta = path.join(__dirname, 'media', 'imagenes');
        extension = media.mimetype.includes('jpeg') ? '.jpg' : 
                   media.mimetype.includes('png') ? '.png' : 
                   media.mimetype.includes('gif') ? '.gif' : '.jpg';
    } else if (tipo === 'video') {
        carpeta = path.join(__dirname, 'media', 'videos');
        extension = media.mimetype.includes('mp4') ? '.mp4' : 
                   media.mimetype.includes('avi') ? '.avi' : 
                   media.mimetype.includes('mov') ? '.mov' : '.mp4';
    } else if (tipo === 'pdf' || tipo === 'documento') {
        carpeta = path.join(__dirname, 'media', 'documentos');
        extension = media.mimetype.includes('pdf') ? '.pdf' : 
                   media.mimetype.includes('word') ? '.docx' : '.pdf';
    } else {
        carpeta = path.join(__dirname, 'media', 'otros');
        extension = '.dat';
    }
    
    if (!fs.existsSync(carpeta)) {
        fs.mkdirSync(carpeta, { recursive: true });
    }
    
    const nombreArchivo = `${tipo}_${userId}_${Date.now()}${extension}`;
    const rutaCompleta = path.join(carpeta, nombreArchivo);
    
    const buffer = Buffer.from(media.data, 'base64');
    fs.writeFileSync(rutaCompleta, buffer);
    
    return {
        ruta: rutaCompleta,
        tipo: tipo,
        mimetype: media.mimetype,
        nombre: nombreArchivo
    };
}

async function obtenerGrupos() {
    try {
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup);
        return grupos;
    } catch (error) {
        return [];
    }
}

function generarVistaPrevia(datos) {
    let preview = "📋 *VISTA PREVIA DEL MENSAJE*\n\n";
    
    if (datos.archivoInfo) {
        preview += `📎 *Archivo:* ${datos.archivoInfo.tipo.toUpperCase()} adjunto ✅\n`;
        preview += `📄 *Tipo:* ${datos.archivoInfo.mimetype}\n`;
    } else if (datos.imagenPath) {
        preview += "🖼️ *Imagen:* Adjuntada ✅\n";
    } else {
        preview += "📎 *Archivo:* Sin archivo adjunto\n";
    }
    
    if (datos.mensaje && datos.mensaje !== "") {
        preview += `💬 *Mensaje:* ${datos.mensaje}\n`;
    }
    
    preview += `⏰ *Horas programadas:* ${datos.horas.join(', ')}\n`;
    preview += `📅 *Frecuencia:* ${datos.frecuencia === 'una_vez' ? 'Una sola vez' : 
                datos.frecuencia === 'diario' ? 'Diariamente' : 
                datos.frecuencia === 'semanal' ? 'Semanalmente' : 'Personalizado'}\n`;
    
    if (datos.fechaInicio) {
        preview += `📅 *Fecha inicio:* ${moment(datos.fechaInicio).tz(TIMEZONE).format('DD/MM/YYYY')}\n`;
    }
    
    if (datos.fechaFin) {
        preview += `📅 *Fecha fin:* ${moment(datos.fechaFin).tz(TIMEZONE).format('DD/MM/YYYY')}\n`;
    }
    
    if (datos.enviarATodos) {
        preview += `👥 *Enviar a:* Todos los grupos\n`;
    } else if (datos.gruposSeleccionados && datos.gruposSeleccionados.length > 0) {
        preview += `👥 *Enviar a:* ${datos.gruposSeleccionados.length} grupo(s) seleccionado(s)\n`;
    }
    
    preview += `\n📅 *Fecha de creación:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
    
    return preview;
}

const GRUPOS_DISPONIBLES = [
    "Cazadores del sabor",
    "Heroes del sabor", 
    "Caramelos del sabor",
    "Linea 6"
];

function formatearFecha(fechaStr) {
    if (!fechaStr) return 'N/A';
    const [year, month, day] = fechaStr.split('-');
    return `${day}/${month}/${year}`;
}

function numeroConEmoji(num) {
    const emojis = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
    const numStr = num.toString();
    let resultado = '';
    for (let i = 0; i < numStr.length; i++) {
        const digito = parseInt(numStr[i]);
        resultado += emojis[digito];
    }
    return resultado;
}

async function consultarRegistrosCIP(tanque, tipoBusqueda, fechaInicio, fechaFin, mes, año) {
    try {
        let url = `${FIREBASE_CIP_CONFIG.databaseURL}/registrosCIP.json`;
        const response = await axios.get(url, { timeout: 30000 });
        const registros = response.data || {};
        
        let registrosArray = [];
        for (const key in registros) {
            if (registros.hasOwnProperty(key)) {
                registrosArray.push({
                    id: key,
                    ...registros[key]
                });
            }
        }
        
        let registrosFiltrados = registrosArray;
        if (tanque !== 'todos') {
            registrosFiltrados = registrosArray.filter(r => 
                r.tanqueLinea && r.tanqueLinea.toLowerCase() === tanque.toLowerCase()
            );
        }
        
        if (tipoBusqueda === 'rango_fechas' && fechaInicio && fechaFin) {
            registrosFiltrados = registrosFiltrados.filter(r => 
                r.fecha && r.fecha >= fechaInicio && r.fecha <= fechaFin
            );
        } else if (tipoBusqueda === 'mes' && mes && año) {
            const mesNum = (MESES.indexOf(mes) + 1).toString().padStart(2, '0');
            registrosFiltrados = registrosFiltrados.filter(r => {
                if (!r.fecha) return false;
                const [rAño, rMes] = r.fecha.split('-');
                return rAño === año.toString() && rMes === mesNum;
            });
        }
        
        registrosFiltrados.sort((a, b) => {
            if (!a.fecha) return 1;
            if (!b.fecha) return -1;
            return b.fecha.localeCompare(a.fecha);
        });
        
        return registrosFiltrados;
        
    } catch (error) {
        return [];
    }
}

function generarResumenRegistros(registros) {
    if (registros.length === 0) {
        return "No se encontraron registros para los criterios seleccionados.";
    }
    
    const tanquesUnicos = new Set();
    const operadoresUnicos = new Set();
    const pasosCount = {};
    
    registros.forEach(r => {
        if (r.tanqueLinea) tanquesUnicos.add(r.tanqueLinea);
        if (r.operador) operadoresUnicos.add(r.operador);
        if (r.pasos) {
            pasosCount[r.pasos] = (pasosCount[r.pasos] || 0) + 1;
        }
    });
    
    let resumen = `📊 *RESUMEN DE REGISTROS*\n\n`;
    resumen += `• Total registros: ${registros.length}\n`;
    resumen += `• Tanques involucrados: ${tanquesUnicos.size}\n`;
    resumen += `• Operadores: ${operadoresUnicos.size}\n\n`;
    
    resumen += `📋 *TIPOS DE CIP REALIZADOS:*\n`;
    Object.entries(pasosCount)
        .sort((a, b) => b[1] - a[1])
        .forEach(([paso, count]) => {
            resumen += `• ${paso}: ${count}\n`;
        });
    
    return resumen;
}

async function generarExcel(registros, tanque, tipoBusqueda, filtros) {
    try {
        const wb = XLSX.utils.book_new();
        
        const datos = registros.map(registro => {
            const datosCompletos = {
                'Fecha': formatearFecha(registro.fecha),
                'Hora': registro.hora || 'N/A',
                'Turno': registro.turno || 'N/A',
                'Operador': registro.operador || 'N/A',
                'Catador': registro.catador || 'N/A',
                'Segundo Catador': registro.catador2 || 'N/A',
                'Tanque/Línea': registro.tanqueLinea || 'N/A',
                'CIP': registro.cip || 'N/A',
                'Pasos': registro.pasos || 'N/A',
                'Concentración Cloro Enjuague': registro.concentracionCloro || 'N/A',
                'Sabor del Tanque': registro.saborTanque || 'N/A',
                'Comentarios': registro.comentarios || 'N/A',
                'Inspección Visual': registro.inspeccionVisual || 'N/A',
                'Temperatura Soda (°C)': registro.tempSoda || 'N/A',
                'Concentración Soda': registro.concentracionSoda || 'N/A',
                'Temperatura Agua (°C)': registro.tempAgua || 'N/A',
                'Temperatura AC55 (°C)': registro.tempAC55 || 'N/A',
                'Concentración AC55': registro.concentracionAC55 || 'N/A',
                'Temperatura Dióxido Cloro (°C)': registro.tempDioxidoCloro || 'N/A',
                'Concentración Dióxido Cloro': registro.concentracionDioxidoCloro || 'N/A',
                'Temperatura Acelerate (°C)': registro.tempAccelerate || 'N/A',
                'Concentración Acelerate': registro.concentracionAccelerate || 'N/A',
                'Temperatura Oxonia (°C)': registro.tempOxonia || 'N/A',
                'Concentración Oxonia': registro.concentracionOxonia || 'N/A',
                'Temperatura Vortex (°C)': registro.tempVortex || 'N/A',
                'Concentración Vortex': registro.concentracionVortex || 'N/A',
                'PH Final': registro.phFinal || 'N/A',
                'Arrastre Soda': registro.arrastreSoda || 'N/A',
                'Olor': registro.olor || 'N/A',
                'Sabor': registro.sabor || 'N/A',
                'Prueba Cafeína': registro.pruebaCafeina || 'N/A',
                'Prueba Azúcar': registro.pruebaAzucar || 'N/A'
            };

            if (registro.flujos) {
                for (const [key, value] of Object.entries(registro.flujos)) {
                    datosCompletos[`${key} Inicio`] = value.inicio || 'N/A';
                    datosCompletos[`${key} Fin`] = value.fin || 'N/A';
                    datosCompletos[`${key} Valor`] = value.valor || 'N/A';
                }
            }

            return datosCompletos;
        });

        const ws = XLSX.utils.json_to_sheet(datos);
        
        const columnas = [
            { wch: 10 }, { wch: 8 }, { wch: 6 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 8 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 30 },
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
            { wch: 15 }, { wch: 15 }
        ];
        
        ws['!cols'] = columnas;

        XLSX.utils.book_append_sheet(wb, ws, 'Registros CIP');

        const fechaActual = moment().tz(TIMEZONE).format('YYYYMMDD_HHmmss');
        const tanqueNombre = tanque === 'todos' ? 'TODOS' : tanque.replace(/\s+/g, '_');
        const nombreArchivo = `CIP_${tanqueNombre}_${fechaActual}.xlsx`;
        const rutaArchivo = path.join(__dirname, 'reportes-cip', nombreArchivo);

        XLSX.writeFile(wb, rutaArchivo);
        
        return {
            success: true,
            ruta: rutaArchivo,
            nombre: nombreArchivo
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function generarPDF(registros, tanque, tipoBusqueda, filtros) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
            
            const fechaActual = moment().tz(TIMEZONE).format('YYYYMMDD_HHmmss');
            const tanqueNombre = tanque === 'todos' ? 'TODOS' : tanque.replace(/\s+/g, '_');
            const nombreArchivo = `CIP_${tanqueNombre}_${fechaActual}.pdf`;
            const rutaArchivo = path.join(__dirname, 'reportes-cip', nombreArchivo);
            
            const stream = fs.createWriteStream(rutaArchivo);
            doc.pipe(stream);
            
            doc.fontSize(16).font('Helvetica-Bold').text('REPORTE CIP JARABE TERMINADO', { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(10).font('Helvetica');
            doc.text(`Tanque: ${tanque === 'todos' ? 'TODOS' : tanque}`);
            
            if (tipoBusqueda === 'rango_fechas') {
                doc.text(`Período: ${formatearFecha(filtros.fechaInicio)} - ${formatearFecha(filtros.fechaFin)}`);
            } else if (tipoBusqueda === 'mes') {
                doc.text(`Mes: ${filtros.mes} ${filtros.año}`);
            }
            
            doc.text(`Total registros: ${registros.length}`);
            doc.text(`Fecha generación: ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm:ss')}`);
            doc.moveDown();
            
            const tableTop = 150;
            const rowHeight = 20;
            const colWidths = [70, 50, 50, 80, 80, 70, 60, 100];
            
            doc.font('Helvetica-Bold').fontSize(8);
            const headers = ['Fecha', 'Hora', 'Turno', 'Operador', 'Catador', 'Tanque', 'CIP', 'Pasos'];
            let x = 30;
            headers.forEach((header, i) => {
                doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });
            
            doc.moveTo(30, tableTop + 15).lineTo(30 + colWidths.reduce((a, b) => a + b, 0), tableTop + 15).stroke();
            
            doc.font('Helvetica').fontSize(7);
            let y = tableTop + 20;
            
            registros.slice(0, 50).forEach((registro, index) => {
                if (y > 500) {
                    doc.addPage();
                    y = 50;
                    
                    doc.font('Helvetica-Bold').fontSize(8);
                    x = 30;
                    headers.forEach((header, i) => {
                        doc.text(header, x, y, { width: colWidths[i], align: 'left' });
                        x += colWidths[i];
                    });
                    doc.moveTo(30, y + 15).lineTo(30 + colWidths.reduce((a, b) => a + b, 0), y + 15).stroke();
                    y += 20;
                    doc.font('Helvetica').fontSize(7);
                }
                
                x = 30;
                doc.text(formatearFecha(registro.fecha), x, y, { width: colWidths[0], align: 'left' });
                x += colWidths[0];
                doc.text(registro.hora || 'N/A', x, y, { width: colWidths[1], align: 'left' });
                x += colWidths[1];
                doc.text(registro.turno || 'N/A', x, y, { width: colWidths[2], align: 'left' });
                x += colWidths[2];
                doc.text(registro.operador || 'N/A', x, y, { width: colWidths[3], align: 'left' });
                x += colWidths[3];
                doc.text(registro.catador || 'N/A', x, y, { width: colWidths[4], align: 'left' });
                x += colWidths[4];
                doc.text(registro.tanqueLinea || 'N/A', x, y, { width: colWidths[5], align: 'left' });
                x += colWidths[5];
                doc.text(registro.cip || 'N/A', x, y, { width: colWidths[6], align: 'left' });
                x += colWidths[6];
                doc.text(registro.pasos || 'N/A', x, y, { width: colWidths[7], align: 'left' });
                
                y += rowHeight;
            });
            
            doc.end();
            
            stream.on('finish', () => {
                resolve({
                    success: true,
                    ruta: rutaArchivo,
                    nombre: nombreArchivo
                });
            });
            
            stream.on('error', (error) => {
                reject(error);
            });
            
        } catch (error) {
            reject(error);
        }
    });
}

async function manejarCIPJarabeTerminado(message, userId) {
    userStates.set(userId, { 
        estado: 'cip_esperando_tanque',
        datos: {}
    });
    
    let menuTanques = `🧪 *CIP JARABE TERMINADO*\n\n`;
    menuTanques += `Selecciona el tanque que deseas consultar:\n\n`;
    
    TANQUES_LIST.forEach((tanque, index) => {
        menuTanques += `${numeroConEmoji(index + 1)} - ${tanque}\n`;
    });
    
    menuTanques += `\n${numeroConEmoji(TANQUES_LIST.length + 1)} - *TODOS LOS TANQUES*\n\n`;
    menuTanques += `Envía el número de la opción (1-${TANQUES_LIST.length + 1})\n`;
    menuTanques += `O envía *cancelar* para regresar al menú principal.`;
    
    await message.reply(menuTanques);
}

async function manejarSeleccionTanque(message, userId, estadoUsuario) {
    const opcion = parseInt(message.body.trim());
    
    if (isNaN(opcion) || opcion < 1 || opcion > TANQUES_LIST.length + 1) {
        await message.reply(`❌ Opción inválida. Por favor envía un número del 1 al ${TANQUES_LIST.length + 1}.`);
        return;
    }
    
    let tanqueSeleccionado;
    if (opcion === TANQUES_LIST.length + 1) {
        tanqueSeleccionado = 'todos';
    } else {
        tanqueSeleccionado = TANQUES_LIST[opcion - 1];
    }
    
    estadoUsuario.datos.tanque = tanqueSeleccionado;
    estadoUsuario.estado = 'cip_esperando_tipo_busqueda';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        `✅ Tanque seleccionado: *${tanqueSeleccionado === 'todos' ? 'TODOS LOS TANQUES' : tanqueSeleccionado}*\n\n` +
        `¿Cómo quieres buscar la información?\n\n` +
        `1️⃣ - *Por rango de fechas*\n` +
        `2️⃣ - *Por mes completo*\n\n` +
        `Envía el número de la opción (1-2)`
    );
}

async function manejarTipoBusqueda(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion === '1') {
        estadoUsuario.estado = 'cip_esperando_rango_fechas';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "📅 *RANGO DE FECHAS*\n\n" +
            "Envía el rango de fechas en formato:\n" +
            "`DD-MM-YYYY hasta DD-MM-YYYY`\n\n" +
            "*Ejemplos:*\n" +
            "• `01-03-2025 hasta 20-03-2025`\n" +
            "• `1-3-2025 hasta 20-3-2025`\n\n" +
            "O envía *cancelar* para regresar."
        );
        
    } else if (opcion === '2') {
        estadoUsuario.estado = 'cip_esperando_mes';
        userStates.set(userId, estadoUsuario);
        
        let menuMeses = "📅 *SELECCIONA EL MES*\n\n";
        MESES.forEach((mes, index) => {
            menuMeses += `${numeroConEmoji(index + 1)} - ${mes}\n`;
        });
        
        menuMeses += `\nEnvía el número del mes (1-12)`;
        
        await message.reply(menuMeses);
        
    } else {
        await message.reply("❌ Opción inválida. Por favor envía 1 o 2.");
    }
}

async function manejarRangoFechas(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    const patron = /(\d{1,2})-(\d{1,2})-(\d{4})\s+(?:hasta|a)\s+(\d{1,2})-(\d{1,2})-(\d{4})/i;
    const match = texto.match(patron);
    
    if (!match) {
        await message.reply(
            "❌ Formato incorrecto.\n\n" +
            "Usa el formato: `DD-MM-YYYY hasta DD-MM-YYYY`\n" +
            "Ejemplo: `01-03-2025 hasta 20-03-2025`"
        );
        return;
    }
    
    const diaInicio = match[1].padStart(2, '0');
    const mesInicio = match[2].padStart(2, '0');
    const añoInicio = match[3];
    const fechaInicio = `${añoInicio}-${mesInicio}-${diaInicio}`;
    
    const diaFin = match[4].padStart(2, '0');
    const mesFin = match[5].padStart(2, '0');
    const añoFin = match[6];
    const fechaFin = `${añoFin}-${mesFin}-${diaFin}`;
    
    if (fechaInicio > fechaFin) {
        await message.reply("❌ La fecha de inicio debe ser menor o igual a la fecha de fin.");
        return;
    }
    
    estadoUsuario.datos.tipoBusqueda = 'rango_fechas';
    estadoUsuario.datos.fechaInicio = fechaInicio;
    estadoUsuario.datos.fechaFin = fechaFin;
    estadoUsuario.estado = 'cip_esperando_formato_descarga';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ Rango de fechas configurado correctamente.\n\n" +
        "¿En qué formato deseas descargar la información?\n\n" +
        "1️⃣ - *Excel*\n" +
        "2️⃣ - *PDF*\n\n" +
        "Envía el número de la opción (1-2)"
    );
}

async function manejarSeleccionMes(message, userId, estadoUsuario) {
    const mes = parseInt(message.body.trim());
    
    if (isNaN(mes) || mes < 1 || mes > 12) {
        await message.reply("❌ Opción inválida. Por favor envía un número del 1 al 12.");
        return;
    }
    
    estadoUsuario.datos.mesSeleccionado = MESES[mes - 1];
    estadoUsuario.estado = 'cip_esperando_anio';
    userStates.set(userId, estadoUsuario);
    
    const años = [2025, 2026, 2027];
    
    let menuAños = `📅 *SELECCIONA EL AÑO*\n\n`;
    años.forEach((año, index) => {
        menuAños += `${numeroConEmoji(index + 1)} - ${año}\n`;
    });
    
    menuAños += `\nEnvía el número del año (1-3)`;
    
    await message.reply(menuAños);
}

async function manejarSeleccionAnio(message, userId, estadoUsuario) {
    const opcion = parseInt(message.body.trim());
    
    if (isNaN(opcion) || opcion < 1 || opcion > 3) {
        await message.reply("❌ Opción inválida. Por favor envía un número del 1 al 3.");
        return;
    }
    
    const años = [2025, 2026, 2027];
    const añoSeleccionado = años[opcion - 1];
    
    estadoUsuario.datos.tipoBusqueda = 'mes';
    estadoUsuario.datos.año = añoSeleccionado;
    estadoUsuario.estado = 'cip_esperando_formato_descarga';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ Mes y año configurados correctamente.\n\n" +
        "¿En qué formato deseas descargar la información?\n\n" +
        "1️⃣ - *Excel*\n" +
        "2️⃣ - *PDF*\n\n" +
        "Envía el número de la opción (1-2)"
    );
}

function eliminarArchivoSeguro(rutaArchivo) {
    return new Promise((resolve) => {
        try {
            if (rutaArchivo && fs.existsSync(rutaArchivo)) {
                setTimeout(() => {
                    try {
                        fs.unlinkSync(rutaArchivo);
                        resolve(true);
                    } catch (error) {
                        resolve(false);
                    }
                }, 8000);
            } else {
                resolve(false);
            }
        } catch (error) {
            resolve(false);
        }
    });
}

async function manejarFormatoDescarga(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion !== '1' && opcion !== '2') {
        await message.reply("❌ Opción inválida. Por favor envía 1 para Excel o 2 para PDF.");
        return;
    }
    
    await message.reply("🔍 Consultando registros CIP...");
    
    let registros = [];
    try {
        registros = await consultarRegistrosCIP(
            estadoUsuario.datos.tanque,
            estadoUsuario.datos.tipoBusqueda,
            estadoUsuario.datos.fechaInicio,
            estadoUsuario.datos.fechaFin,
            estadoUsuario.datos.mesSeleccionado,
            estadoUsuario.datos.año
        );
    } catch (error) {
        await message.reply("❌ Error al consultar los registros.");
        userStates.delete(userId);
        return;
    }
    
    if (registros.length === 0) {
        await message.reply(
            "❌ *No se encontraron registros*\n\n" +
            "No hay información disponible para los criterios seleccionados."
        );
        userStates.delete(userId);
        return;
    }
    
    const resumen = generarResumenRegistros(registros);
    await message.reply(resumen);
    
    let resultado;
    try {
        if (opcion === '1') {
            resultado = await generarExcel(registros, estadoUsuario.datos.tanque, estadoUsuario.datos.tipoBusqueda, estadoUsuario.datos);
        } else {
            resultado = await generarPDF(registros, estadoUsuario.datos.tanque, estadoUsuario.datos.tipoBusqueda, estadoUsuario.datos);
        }
    } catch (error) {
        await message.reply("❌ Error al generar el archivo.");
        userStates.delete(userId);
        return;
    }
    
    if (resultado.success) {
        try {
            const media = MessageMedia.fromFilePath(resultado.ruta);
            
            await message.reply(
                media,
                undefined,
                { caption: `✅ *ARCHIVO GENERADO*\n\n📁 ${resultado.nombre}\n📊 Total registros: ${registros.length}` }
            );
            
            await eliminarArchivoSeguro(resultado.ruta);
            
        } catch (error) {
            await message.reply("❌ Error al enviar el archivo.");
            await eliminarArchivoSeguro(resultado.ruta);
        }
        
    } else {
        await message.reply("❌ Error al generar el archivo.");
    }
    
    userStates.delete(userId);
}

function base64ToArrayBuffer(base64) {
    const binaryString = Buffer.from(base64, 'base64').toString('binary');
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function procesarExcelDesdeBase64(base64) {
    try {
        const buffer = Buffer.from(base64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const datos = XLSX.utils.sheet_to_json(sheet);
        return datos;
    } catch (error) {
        return [];
    }
}

async function consultarGuardian(codigoEmpleado, mesSeleccionado, anioSeleccionado) {
    try {
        const mes = mesSeleccionado.toString().padStart(2, '0');
        const anio = anioSeleccionado.toString();
        
        const snapshot = await axios.get(`${FIREBASE_GUARDIAN_CONFIG.databaseURL}/reportes.json`, {
            timeout: 15000
        });
        
        const reportes = snapshot.data || {};
        let todosLosRegistros = [];
        
        for (const [reporteId, reporte] of Object.entries(reportes)) {
            if (reporte.mes === mes && reporte.anio === anio && reporte.archivo) {
                try {
                    const registros = await procesarExcelDesdeBase64(reporte.archivo);
                    todosLosRegistros.push(...registros.map(r => ({
                        ...r,
                        tipoReporte: reporte.tipo
                    })));
                } catch (error) {}
            }
        }
        
        if (todosLosRegistros.length === 0) {
            return {
                success: false,
                mensaje: `❌ *No hay registros* para el período ${mes}/${anio} en Guardian.`
            };
        }
        
        const COLUMNA_ID_IMPLICADO = 'ID del implicado';
        const COLUMNA_DESCRIPCION = 'Descripción';
        const COLUMNA_AREA = 'Área de ocurrencia';
        const COLUMNA_SUBAREA = 'Subárea de ocurrencia';
        const COLUMNA_OBSERVADO_POR = 'Observado por';
        const COLUMNA_PILAR_MEDIO_AMBIENTE = 'Pilar del medio ambiente';
        
        const accionesInsegurasComoImplicado = todosLosRegistros.filter(reg => {
            const esAccionInsegura = reg.tipoReporte === 'accion_insegura';
            const idImplicado = reg[COLUMNA_ID_IMPLICADO] ? reg[COLUMNA_ID_IMPLICADO].toString().trim() : '';
            const coincideId = idImplicado.includes(codigoEmpleado) || codigoEmpleado.includes(idImplicado);
            return esAccionInsegura && coincideId;
        });
        
        const registrosComoObservador = todosLosRegistros.filter(reg => {
            const idObservador = reg['ID del observador'] ? reg['ID del observador'].toString().trim() : '';
            return idObservador.includes(codigoEmpleado) || codigoEmpleado.includes(idObservador);
        });
        
        if (registrosComoObservador.length === 0 && accionesInsegurasComoImplicado.length === 0) {
            return {
                success: false,
                mensaje: `❌ *No se encontraron registros* para el código *${codigoEmpleado}* en ${mes}/${anio}`
            };
        }
        
        const primerRegistroObservador = registrosComoObservador.length > 0 ? registrosComoObservador[0] : null;
        const nombreTecnico = primerRegistroObservador ? (primerRegistroObservador[COLUMNA_OBSERVADO_POR] || 'Desconocido') : 'Desconocido';
        const tipoUsuario = primerRegistroObservador ? (primerRegistroObservador['Tipo de usuario del observador'] || 'No especificado') : 'No especificado';
        
        let condicionesInseguras = 0;
        let reconocimientos = 0;
        let accionesInseguras = 0;
        let incidentesMenores = 0;
        let reportesAmbientales = 0;
        
        registrosComoObservador.forEach(reg => {
            const tipo = reg.tipoReporte || '';
            
            if (tipo === 'condicion_insegura') {
                condicionesInseguras++;
            } else if (tipo === 'reconocimiento') {
                reconocimientos++;
            } else if (tipo === 'accion_insegura') {
                accionesInseguras++;
            } else if (tipo === 'incidentes_menores') {
                incidentesMenores++;
            }
            
            const pilarMedioAmbiente = reg[COLUMNA_PILAR_MEDIO_AMBIENTE] || 
                                      reg['Pilar de medio ambiente'] || 
                                      reg['Pilar medio ambiente'];
            
            if (pilarMedioAmbiente) {
                const valorPilar = pilarMedioAmbiente.toString().toUpperCase().trim();
                if (valorPilar === 'SI' || valorPilar === 'SÍ') {
                    reportesAmbientales++;
                }
            }
        });
        
        let resultado = `📊 *INFORME GUARDIAN - JARABE*\n\n`;
        resultado += `👤 *Técnico:* ${nombreTecnico}\n`;
        resultado += `🔢 *Código:* ${codigoEmpleado}\n`;
        resultado += `📌 *Tipo de usuario:* ${tipoUsuario}\n`;
        resultado += `📅 *Período:* ${mes}/${anio}\n\n`;
        
        resultado += `📋 *REGISTROS DEL MES (Como observador):*\n\n`;
        
        resultado += `🚨 *Condiciones Inseguras:* ${condicionesInseguras}\n`;
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < condicionesInseguras) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `✅ *Reconocimientos:* ${reconocimientos}\n`;
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < reconocimientos) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `⚠️ *Acciones Inseguras:* ${accionesInseguras}\n`;
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < accionesInseguras) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `📋 *Incidentes Menores:* ${incidentesMenores}\n`;
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < incidentesMenores) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `🌱 *Reportes Ambientales:* ${reportesAmbientales}\n`;
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < reportesAmbientales) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `📊 *RESUMEN TOTAL (Como observador):*\n`;
        resultado += `• Condiciones Inseguras: ${condicionesInseguras}\n`;
        resultado += `• Reconocimientos: ${reconocimientos}\n`;
        resultado += `• Acciones Inseguras: ${accionesInseguras}\n`;
        resultado += `• Incidentes Menores: ${incidentesMenores}\n`;
        resultado += `• Reportes Ambientales: ${reportesAmbientales}\n`;
        resultado += `• Total registros: ${registrosComoObservador.length}\n\n`;
        
        if (accionesInsegurasComoImplicado.length > 0) {
            resultado += `⚠️ *ACCIONES INSEGURAS DONDE HAS SIDO REPORTADO COMO IMPLICADO:*\n\n`;
            
            accionesInsegurasComoImplicado.forEach((reg, index) => {
                const descripcion = reg[COLUMNA_DESCRIPCION] || 'Sin descripción';
                const area = reg[COLUMNA_AREA] || 'No especificada';
                const subarea = reg[COLUMNA_SUBAREA] || 'No especificada';
                const observadoPor = reg[COLUMNA_OBSERVADO_POR] || 'Desconocido';
                
                resultado += `⚠️ *ACCIÓN INSEGURA #${index + 1}*\n`;
                resultado += `📝 *Te han reportado por:* ${descripcion}\n`;
                resultado += `📍 *Área de ocurrencia:* ${area}\n`;
                resultado += `📍 *Subárea de ocurrencia:* ${subarea}\n`;
                resultado += `👤 *Reportado por:* ${observadoPor}\n`;
                resultado += `─────────────────────\n\n`;
            });
            
            resultado += `📊 *TOTAL DE ACCIONES INSEGURAS COMO IMPLICADO:* ${accionesInsegurasComoImplicado.length}\n\n`;
        } else {
            resultado += `✅ *¡FELICIDADES!* No tienes acciones inseguras reportadas como implicado en este período.\n\n`;
        }
        
        resultado += `⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
        resultado += `🔗 *Fuente:* Guardian Jarabe`;
        
        return {
            success: true,
            mensaje: resultado,
            datos: {
                nombre: nombreTecnico,
                tipoUsuario: tipoUsuario,
                condicionesInseguras,
                reconocimientos,
                accionesInseguras,
                incidentesMenores,
                reportesAmbientales,
                totalObservador: registrosComoObservador.length,
                totalAccionesImplicado: accionesInsegurasComoImplicado.length
            }
        };
        
    } catch (error) {
        let mensajeError = "❌ *ERROR EN CONSULTA GUARDIAN*\n\n";
        mensajeError += `No se pudo realizar la búsqueda para el código: ${codigoEmpleado}\n\n`;
        mensajeError += "🔗 *Enlace:* https://reportesdeguardian.web.app/infor.html\n";
        mensajeError += "⏰ *Hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";
        
        return {
            success: false,
            mensaje: mensajeError
        };
    }
}

async function manejarGuardian(message, userId) {
    userStates.set(userId, { 
        estado: 'guardian_esperando_codigo',
        datos: {}
    });
    
    await message.reply(
        `🛡️ *GUARDIAN - SISTEMA DE REPORTES*\n\n` +
        `Para consultar tus reportes, necesito tu código de empleado.\n\n` +
        `*Ejemplos:*\n` +
        `• 76001111\n` +
        `• 1111\n` +
        `• 76009949\n\n` +
        `Envía tu código ahora o escribe *cancelar* para regresar al menú.`
    );
}

async function consultarReclamosCalidad() {
    try {
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_RECLAMOS_CONFIG.projectId}/databases/(default)/documents/quality_claims?orderBy=createdAt desc`;
        
        const response = await axios.get(firestoreUrl, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const documents = response.data.documents || [];
        
        if (documents.length === 0) {
            return {
                success: true,
                sinReclamos: true,
                mensaje: "🎉 *¡FELICIDADES!*\n\nNo hay reclamos de calidad registrados en el sistema.\n\n🔗 *Sistema de reclamos:* https://reclamo-39ff3.web.app/"
            };
        }

        const reclamos = [];
        let fechaMasReciente = null;
        let reclamoMasReciente = null;

        for (const doc of documents) {
            const fields = doc.fields || {};
            
            let fechaReclamo = null;
            if (fields.date && fields.date.stringValue) {
                fechaReclamo = fields.date.stringValue;
            }

            const reclamo = {
                id: doc.name.split('/').pop(),
                fecha: fields.date?.stringValue || 'Sin fecha',
                lines: fields.lines?.stringValue || 'Sin área',
                type: fields.type?.stringValue || 'Sin tipo',
                reason: fields.reason?.stringValue || 'Sin descripción',
                status: fields.status?.stringValue || 'Nuevo',
                solution: fields.solution?.stringValue || ''
            };
            reclamos.push(reclamo);

            if (fechaReclamo && (!fechaMasReciente || fechaReclamo > fechaMasReciente)) {
                fechaMasReciente = fechaReclamo;
                reclamoMasReciente = reclamo;
            }
        }

        let diasSinReclamos = 0;
        const hoy = moment().tz(TIMEZONE).format('YYYY-MM-DD');
        
        if (fechaMasReciente) {
            const fechaUltimo = moment(fechaMasReciente, 'YYYY-MM-DD');
            const fechaHoy = moment(hoy, 'YYYY-MM-DD');
            diasSinReclamos = fechaHoy.diff(fechaUltimo, 'days');
        }

        const reclamosOrdenados = reclamos.sort((a, b) => {
            if (a.fecha < b.fecha) return 1;
            if (a.fecha > b.fecha) return -1;
            return 0;
        });

        let resultado = "📋 *SISTEMA DE RECLAMOS DE CALIDAD*\n\n";
        
        if (diasSinReclamos > 0) {
            resultado += `🎉 *¡FELICIDADES!* Llevamos *${diasSinReclamos}* día${diasSinReclamos !== 1 ? 's' : ''} sin reclamos de calidad.\n\n`;
        } else if (diasSinReclamos === 0) {
            resultado += "⚠️ *ATENCIÓN:* Hoy se registró un reclamo de calidad.\n\n";
        }

        if (reclamoMasReciente) {
            resultado += `📅 *Último reclamo:* ${reclamoMasReciente.fecha}\n`;
            resultado += `📍 *Área/Línea:* ${reclamoMasReciente.lines}\n`;
            resultado += `📌 *Tipo:* ${reclamoMasReciente.type}\n`;
            resultado += `📝 *Descripción:* ${reclamoMasReciente.reason}\n\n`;
        }

        resultado += `📋 *TODOS LOS RECLAMOS REGISTRADOS:*\n\n`;
        
        reclamosOrdenados.forEach((reclamo, index) => {
            resultado += `${index + 1}. *Fecha:* ${reclamo.fecha}\n`;
            resultado += `   *Área:* ${reclamo.lines}\n`;
            resultado += `   *Tipo:* ${reclamo.type}\n`;
            resultado += `   *Descripción:* ${reclamo.reason}\n`;
            if (reclamo.solution && reclamo.solution !== '') {
                resultado += `   *Solución:* ${reclamo.solution}\n`;
            }
            resultado += `\n`;
        });

        resultado += `🔗 *Sistema de reclamos:* https://reclamo-39ff3.web.app/\n`;
        resultado += `⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}`;

        return {
            success: true,
            sinReclamos: false,
            reclamos: reclamos,
            mensaje: resultado
        };

    } catch (error) {
        let mensajeError = "❌ *ERROR AL CONSULTAR RECLAMOS DE CALIDAD*\n\n";
        mensajeError += "No se pudo conectar con la base de datos de reclamos.\n\n";
        mensajeError += "🔗 *Enlace alternativo:* https://reclamo-39ff3.web.app/\n";
        mensajeError += "⏰ *Hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";
        
        return {
            success: false,
            error: error.message,
            mensaje: mensajeError
        };
    }
}

async function obtenerChecklistSeguridad(message, userId) {
    const menuOpciones = `✅ *CHECKLIST DE SEGURIDAD*\n\n¿Qué deseas verificar?\n\n1️⃣ - Grupos\n2️⃣ - Técnicos\n\n*Envía el número de la opción (1-2)*\nO envía *cancelar* para regresar al menú principal.`;
    
    await message.reply(menuOpciones);
    userStates.set(userId, { 
        estado: 'checklist_menu_principal',
        datos: {}
    });
}

async function obtenerGruposDisponibles(message, userId) {
    try {
        const response = await axios.get(`${FIREBASE_CONFIG.databaseURL}/registros.json`, {
            timeout: 15000
        });
        
        const usuarios = response.data || {};
        const gruposUnicos = new Set();
        
        Object.values(usuarios).forEach(usuario => {
            if (usuario.grupo) {
                gruposUnicos.add(usuario.grupo);
            }
        });
        
        const grupos = gruposUnicos.size > 0 ? Array.from(gruposUnicos) : GRUPOS_DISPONIBLES;
        
        let menuGrupos = `👥 *GRUPOS DISPONIBLES*\n\n`;
        grupos.forEach((grupo, index) => {
            menuGrupos += `${numeroConEmoji(index + 1)} - ${grupo}\n`;
        });
        
        menuGrupos += `\n*Selecciona el número del grupo que deseas consultar*\nO envía *cancelar* para regresar.`;
        
        await message.reply(menuGrupos);
        
        userStates.set(userId, { 
            estado: 'checklist_esperando_grupo',
            datos: { grupos: grupos }
        });
        
    } catch (error) {
        let menuGrupos = `👥 *GRUPOS DISPONIBLES*\n\n`;
        GRUPOS_DISPONIBLES.forEach((grupo, index) => {
            menuGrupos += `${numeroConEmoji(index + 1)} - ${grupo}\n`;
        });
        
        menuGrupos += `\n*Selecciona el número del grupo que deseas consultar*\nO envía *cancelar* para regresar.`;
        
        await message.reply(menuGrupos);
        
        userStates.set(userId, { 
            estado: 'checklist_esperando_grupo',
            datos: { grupos: GRUPOS_DISPONIBLES }
        });
    }
}

async function obtenerAnosDisponibles(message, userId, tipo, identificador) {
    try {
        let anosSet = new Set();
        const añoActual = moment().tz(TIMEZONE).year();
        
        anosSet.add(añoActual);
        anosSet.add(añoActual - 1);
        
        const reportesResponse = await axios.get(`${FIREBASE_CONFIG.databaseURL}/reportes_seguridad.json`, {
            timeout: 15000
        });
        const reportes = reportesResponse.data || {};
        
        Object.values(reportes).forEach(report => {
            if (report.fecha) {
                const añoReporte = moment(report.fecha).year();
                if (añoReporte >= 2020) {
                    anosSet.add(añoReporte);
                }
            }
        });
        
        const anos = Array.from(anosSet).sort((a, b) => b - a);
        
        let menuAnos = `📅 *SELECCIONA EL AÑO*\n\n`;
        if (tipo === 'grupo') {
            menuAnos += `Grupo: *${identificador}*\n\n`;
        } else {
            menuAnos += `Técnico: *${identificador}*\n\n`;
        }
        
        anos.forEach((ano, index) => {
            menuAnos += `${numeroConEmoji(index + 1)} - ${ano}\n`;
        });
        
        menuAnos += `\n*Envía el número del año*\nO envía *cancelar* para regresar.`;
        
        await message.reply(menuAnos);
        
        userStates.set(userId, { 
            estado: tipo === 'grupo' ? 'checklist_esperando_ano_grupo' : 'checklist_esperando_ano_tecnico',
            datos: { 
                [tipo]: identificador,
                anos: anos,
                tecnicoInfo: userId 
            }
        });
        
    } catch (error) {
        await message.reply("❌ Error al consultar años disponibles.");
        
        if (tipo === 'grupo') {
            await obtenerMesesGrupo(message, userId, identificador, moment().tz(TIMEZONE).year());
        } else {
            await obtenerMesesTecnico(message, userId, identificador, moment().tz(TIMEZONE).year());
        }
    }
}

async function obtenerMesesGrupo(message, userId, grupoSeleccionado, añoSeleccionado) {
    let menuMeses = `📅 *SELECCIONA EL MES*\n\nGrupo: *${grupoSeleccionado}*\nAño: *${añoSeleccionado}*\n\n`;
    
    for (let i = 0; i < MESES.length; i++) {
        menuMeses += `${numeroConEmoji(i + 1)} - ${MESES[i]}\n`;
    }
    
    menuMeses += `\n*Envía el número del mes (1-12)*\nO envía *cancelar* para regresar.`;
    
    await message.reply(menuMeses);
    
    userStates.set(userId, { 
        estado: 'checklist_esperando_mes_grupo',
        datos: { grupo: grupoSeleccionado, año: añoSeleccionado }
    });
}

async function obtenerResultadosGrupo(message, userId, grupo, añoSeleccionado, mesSeleccionado) {
    try {
        await message.reply(`🔍 Buscando resultados para *${grupo}*...`);
        
        const fechaInicio = moment().tz(TIMEZONE).year(añoSeleccionado).month(mesSeleccionado - 1).startOf('month');
        const fechaFin = moment().tz(TIMEZONE).year(añoSeleccionado).month(mesSeleccionado - 1).endOf('month');
        
        const usuariosResponse = await axios.get(`${FIREBASE_CONFIG.databaseURL}/registros.json`, {
            timeout: 15000
        });
        const usuarios = usuariosResponse.data || {};
        
        const reportesResponse = await axios.get(`${FIREBASE_CONFIG.databaseURL}/reportes_seguridad.json`, {
            timeout: 15000
        });
        const reportes = reportesResponse.data || {};
        
        const usuariosGrupo = [];
        Object.entries(usuarios).forEach(([userId, usuario]) => {
            if (usuario.grupo === grupo) {
                const nombreCompleto = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
                usuariosGrupo.push({
                    id: userId,
                    nombre: nombreCompleto || 'Sin nombre',
                    codigo: usuario.codigo || 'Sin código',
                    grupo: usuario.grupo
                });
            }
        });
        
        const reportesFiltrados = [];
        Object.values(reportes).forEach(report => {
            if (report.fecha && report.grupo_usuario === grupo) {
                const fechaReporte = moment(report.fecha);
                if (fechaReporte.isBetween(fechaInicio, fechaFin, null, '[]')) {
                    reportesFiltrados.push(report);
                }
            }
        });
        
        const estadisticasTecnicos = {};
        
        usuariosGrupo.forEach(usuario => {
            estadisticasTecnicos[usuario.nombre] = {
                nombre: usuario.nombre,
                codigo: usuario.codigo,
                diario: 0,
                semanal: 0,
                mensual: 0,
                total: 0
            };
        });
        
        reportesFiltrados.forEach(report => {
            const tecnico = report.usuario;
            if (estadisticasTecnicos[tecnico]) {
                if (report.seguimiento === 'diario') {
                    estadisticasTecnicos[tecnico].diario++;
                } else if (report.seguimiento === 'semanal') {
                    estadisticasTecnicos[tecnico].semanal++;
                } else if (report.seguimiento === 'mensual') {
                    estadisticasTecnicos[tecnico].mensual++;
                }
                estadisticasTecnicos[tecnico].total++;
            }
        });
        
        const totalTecnicos = usuariosGrupo.length;
        const totalDiario = Object.values(estadisticasTecnicos).reduce((sum, t) => sum + t.diario, 0);
        const totalSemanal = Object.values(estadisticasTecnicos).reduce((sum, t) => sum + t.semanal, 0);
        const totalMensual = Object.values(estadisticasTecnicos).reduce((sum, t) => sum + t.mensual, 0);
        
        const maxDiario = 20 * totalTecnicos;
        const maxSemanal = 4 * totalTecnicos;
        const maxMensual = 1 * totalTecnicos;
        
        const porcentajeDiario = maxDiario > 0 ? Math.min(Math.round((totalDiario / maxDiario) * 100), 100) : 0;
        const porcentajeSemanal = maxSemanal > 0 ? Math.min(Math.round((totalSemanal / maxSemanal) * 100), 100) : 0;
        const porcentajeMensual = maxMensual > 0 ? Math.min(Math.round((totalMensual / maxMensual) * 100), 100) : 0;
        
        let resultado = `📊 *RESULTADOS CHECKLIST DE SEGURIDAD*\n\n`;
        resultado += `👥 *Grupo:* ${grupo}\n`;
        resultado += `📅 *Período:* ${MESES[mesSeleccionado - 1]} ${añoSeleccionado}\n`;
        resultado += `👤 *Total técnicos:* ${totalTecnicos}\n`;
        resultado += `📋 *Total reportes:* ${reportesFiltrados.length}\n\n`;
        
        resultado += `📈 *ESTADÍSTICAS GENERALES:*\n`;
        resultado += `• Diarios: ${totalDiario}/${maxDiario} (${porcentajeDiario}%)\n`;
        resultado += `• Semanales: ${totalSemanal}/${maxSemanal} (${porcentajeSemanal}%)\n`;
        resultado += `• Mensuales: ${totalMensual}/${maxMensual} (${porcentajeMensual}%)\n\n`;
        
        resultado += `📋 *DETALLE POR TÉCNICO:*\n\n`;
        
        const tecnicosOrdenados = Object.values(estadisticasTecnicos).sort((a, b) => b.total - a.total);
        
        tecnicosOrdenados.forEach(tecnico => {
            if (tecnico.nombre && tecnico.nombre !== 'Sin nombre') {
                const porcentajePromedio = 3 > 0 ? Math.round((tecnico.diario/20 + tecnico.semanal/4 + tecnico.mensual/1) / 3 * 100) : 0;
                
                resultado += `👤 *${tecnico.nombre}* (${tecnico.codigo})\n`;
                resultado += `   📅 Diario: ${tecnico.diario}/20 (${Math.min(Math.round(tecnico.diario/20*100), 100)}%)\n`;
                resultado += `   📅 Semanal: ${tecnico.semanal}/4 (${Math.min(Math.round(tecnico.semanal/4*100), 100)}%)\n`;
                resultado += `   📅 Mensual: ${tecnico.mensual}/1 (${Math.min(Math.round(tecnico.mensual/1*100), 100)}%)\n`;
                resultado += `   📊 Promedio: ${porcentajePromedio}%\n\n`;
            }
        });
        
        resultado += `⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
        resultado += `🔗 *Fuente:* Dashboard de seguridad territorial`;
        
        await message.reply(resultado);
        
        userStates.delete(userId);
        
    } catch (error) {
        await message.reply(`❌ *Error al consultar resultados*\n\nNo se pudo obtener la información del grupo ${grupo}.`);
        
        userStates.delete(userId);
    }
}

async function obtenerInfoTecnico(message, userId) {
    await message.reply(
        `👤 *CONSULTAR TÉCNICO*\n\n` +
        `Por favor, ingresa el *código del técnico* que deseas consultar.\n\n` +
        `*Ejemplos:*\n` +
        `• 12345\n` +
        `• 76001111\n` +
        `• 1111\n\n` +
        `O envía *cancelar* para regresar.`
    );
    
    userStates.set(userId, { 
        estado: 'checklist_esperando_codigo_tecnico',
        datos: {}
    });
}

async function obtenerMesesTecnico(message, userId, codigoTecnico, añoSeleccionado) {
    try {
        const usuariosResponse = await axios.get(`${FIREBASE_CONFIG.databaseURL}/registros.json`, {
            timeout: 15000
        });
        const usuarios = usuariosResponse.data || {};
        
        let tecnicoEncontrado = null;
        let nombreTecnico = null;
        
        for (const [userId, usuario] of Object.entries(usuarios)) {
            if (usuario.codigo && usuario.codigo.toString().includes(codigoTecnico)) {
                tecnicoEncontrado = usuario;
                nombreTecnico = `${usuario.nombres || ''} ${usuario.apellidos || ''}`.trim();
                break;
            }
        }
        
        if (!tecnicoEncontrado) {
            await message.reply(`❌ *Técnico no encontrado*\n\nNo se encontró ningún técnico con el código *${codigoTecnico}*.`);
            
            await obtenerInfoTecnico(message, userId);
            return;
        }
        
        let menuMeses = `📅 *SELECCIONA EL MES*\n\nTécnico: *${nombreTecnico || 'Desconocido'}* (${codigoTecnico})\nAño: *${añoSeleccionado}*\n\n`;
        
        for (let i = 0; i < MESES.length; i++) {
            menuMeses += `${numeroConEmoji(i + 1)} - ${MESES[i]}\n`;
        }
        
        menuMeses += `\n*Envía el número del mes (1-12)*\nO envía *cancelar* para regresar.`;
        
        await message.reply(menuMeses);
        
        userStates.set(userId, { 
            estado: 'checklist_esperando_mes_tecnico',
            datos: { 
                codigo: codigoTecnico,
                tecnico: tecnicoEncontrado,
                nombre: nombreTecnico,
                año: añoSeleccionado
            }
        });
        
    } catch (error) {
        await message.reply(`❌ *Error al buscar técnico*\n\nNo se pudo conectar con la base de datos.`);
        
        userStates.delete(userId);
    }
}

async function obtenerResultadosTecnico(message, userId, tecnicoInfo, añoSeleccionado, mesSeleccionado) {
    try {
        const codigo = tecnicoInfo.codigo;
        const nombreCompleto = tecnicoInfo.nombre || `${tecnicoInfo.tecnico.nombres || ''} ${tecnicoInfo.tecnico.apellidos || ''}`.trim();
        
        await message.reply(`🔍 Buscando resultados para *${nombreCompleto}*...`);
        
        const fechaInicio = moment().tz(TIMEZONE).year(añoSeleccionado).month(mesSeleccionado - 1).startOf('month');
        const fechaFin = moment().tz(TIMEZONE).year(añoSeleccionado).month(mesSeleccionado - 1).endOf('month');
        
        const reportesResponse = await axios.get(`${FIREBASE_CONFIG.databaseURL}/reportes_seguridad.json`, {
            timeout: 15000
        });
        const reportes = reportesResponse.data || {};
        
        let diario = 0;
        let semanal = 0;
        let mensual = 0;
        
        Object.values(reportes).forEach(report => {
            if (report.usuario === nombreCompleto && report.fecha) {
                const fechaReporte = moment(report.fecha);
                if (fechaReporte.isBetween(fechaInicio, fechaFin, null, '[]')) {
                    if (report.seguimiento === 'diario') diario++;
                    else if (report.seguimiento === 'semanal') semanal++;
                    else if (report.seguimiento === 'mensual') mensual++;
                }
            }
        });
        
        const limiteDiario = 20;
        const limiteSemanal = 4;
        const limiteMensual = 1;
        
        const porcentajeDiario = Math.min(Math.round((diario / limiteDiario) * 100), 100);
        const porcentajeSemanal = Math.min(Math.round((semanal / limiteSemanal) * 100), 100);
        const porcentajeMensual = Math.min(Math.round((mensual / limiteMensual) * 100), 100);
        const porcentajeTotal = Math.round((diario/limiteDiario + semanal/limiteSemanal + mensual/limiteMensual) / 3 * 100);
        
        let resultado = `📊 *RESULTADOS CHECKLIST DE SEGURIDAD*\n\n`;
        resultado += `👤 *Técnico:* ${nombreCompleto}\n`;
        resultado += `🔢 *Código:* ${codigo}\n`;
        resultado += `📅 *Período:* ${MESES[mesSeleccionado - 1]} ${añoSeleccionado}\n\n`;
        
        resultado += `📈 *ESTADÍSTICAS:*\n\n`;
        
        resultado += `📅 *Formularios Diarios:*\n`;
        resultado += `   • Completados: ${diario}\n`;
        resultado += `   • Límite: ${limiteDiario}\n`;
        resultado += `   • Porcentaje: ${porcentajeDiario}%\n`;
        
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < Math.round(diario / 2)) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `📆 *Formularios Semanales:*\n`;
        resultado += `   • Completados: ${semanal}\n`;
        resultado += `   • Límite: ${limiteSemanal}\n`;
        resultado += `   • Porcentaje: ${porcentajeSemanal}%\n`;
        
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < Math.round(semanal * 5)) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `📊 *Formularios Mensuales:*\n`;
        resultado += `   • Completados: ${mensual}\n`;
        resultado += `   • Límite: ${limiteMensual}\n`;
        resultado += `   • Porcentaje: ${porcentajeMensual}%\n`;
        
        resultado += `   `;
        for (let i = 0; i < 20; i++) {
            if (i < (mensual * 20)) resultado += `█`;
            else resultado += `░`;
        }
        resultado += `\n\n`;
        
        resultado += `🎯 *CUMPLIMIENTO TOTAL: ${porcentajeTotal}%*\n\n`;
        
        resultado += `📋 *EVALUACIÓN:*\n`;
        if (porcentajeTotal >= 90) {
            resultado += `✅ *EXCELENTE* - Cumplimiento sobresaliente\n`;
        } else if (porcentajeTotal >= 75) {
            resultado += `👍 *BUENO* - Buen cumplimiento\n`;
        } else if (porcentajeTotal >= 50) {
            resultado += `⚠️ *REGULAR* - Necesita mejorar\n`;
        } else {
            resultado += `❌ *BAJO* - Incumplimiento crítico\n`;
        }
        
        resultado += `\n⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
        resultado += `🔗 *Fuente:* Dashboard de seguridad territorial`;
        
        await message.reply(resultado);
        
        userStates.delete(userId);
        
    } catch (error) {
        await message.reply(`❌ *Error al consultar resultados*\n\nNo se pudo obtener la información del técnico.`);
        
        userStates.delete(userId);
    }
}

async function obtenerSemaforoTerritorio() {
    try {
        const FIREBASE_CONFIG_FIRESTORE = {
            apiKey: "AIzaSyA_-UWmel0SkQfgcTOEf2tgcOjYFVkYR2M",
            authDomain: "seguridad-ae995.firebaseapp.com",
            projectId: "seguridad-ae995",
            storageBucket: "seguridad-ae995.firebasestorage.app",
            messagingSenderId: "204933074839",
            appId: "1:204933074839:web:cfe171257a37966413fed2"
        };

        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG_FIRESTORE.projectId}/databases/(default)/documents/territories`;
        
        const response = await axios.get(firestoreUrl, {
            timeout: 15000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const documents = response.data.documents || [];
        
        const territoriosValidos = {};
        for (let i = 1; i <= 9; i++) {
            territoriosValidos[`territory_${i}`] = i;
        }

        const territoriosEnRojo = [];
        const detallesTerritorios = [];

        for (const doc of documents) {
            const pathParts = doc.name.split('/');
            const territoryId = pathParts[pathParts.length - 1];
            
            if (!territoriosValidos[territoryId]) {
                continue;
            }

            const territorioNumero = territoriosValidos[territoryId];
            const fields = doc.fields || {};
            
            let status = 'unknown';
            
            if (fields.status) {
                if (fields.status.stringValue) {
                    status = fields.status.stringValue.toLowerCase() === 'danger' ? 'danger' : 'safe';
                } else if (fields.status.integerValue !== undefined) {
                    const statusNum = parseInt(fields.status.integerValue);
                    status = statusNum === 1 ? 'danger' : 'safe';
                } else if (fields.status.booleanValue !== undefined) {
                    status = fields.status.booleanValue ? 'danger' : 'safe';
                }
            }
            
            if (status === 'danger') {
                territoriosEnRojo.push(`Territorio ${territorioNumero}`);
                
                let owner = 'No asignado';
                if (fields.owner && fields.owner.stringValue) {
                    owner = fields.owner.stringValue;
                }

                const unsafeConditions = [];
                
                if (fields.unsafeConditions && fields.unsafeConditions.arrayValue) {
                    const conditionsArray = fields.unsafeConditions.arrayValue.values || [];
                    
                    for (const conditionItem of conditionsArray) {
                        if (conditionItem.mapValue && conditionItem.mapValue.fields) {
                            const conditionFields = conditionItem.mapValue.fields;
                            
                            let conditionStatus = 'active';
                            if (conditionFields.status && conditionFields.status.stringValue) {
                                conditionStatus = conditionFields.status.stringValue;
                            }
                            
                            if (conditionStatus !== 'cerrada') {
                                const condition = {
                                    descripcion: conditionFields.description?.stringValue || 'Sin descripción',
                                    fecha: conditionFields.timestamp?.timestampValue ? 
                                        new Date(conditionFields.timestamp.timestampValue).toLocaleDateString() : 'Sin fecha',
                                    medidaControl: conditionFields.controlMeasure?.stringValue || 'Sin medida de control',
                                    status: conditionStatus
                                };
                                unsafeConditions.push(condition);
                            }
                        }
                    }
                }
                
                try {
                    const subcollectionUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG_FIRESTORE.projectId}/databases/(default)/documents/territories/${territoryId}/unsafeConditions`;
                    const subResponse = await axios.get(subcollectionUrl, { timeout: 5000 });
                    
                    if (subResponse.data.documents) {
                        for (const conditionDoc of subResponse.data.documents) {
                            const conditionFields = conditionDoc.fields || {};
                            
                            let conditionStatus = conditionFields.status?.stringValue || 'active';
                            
                            if (conditionStatus !== 'cerrada') {
                                const condition = {
                                    descripcion: conditionFields.description?.stringValue || 'Sin descripción',
                                    fecha: conditionFields.timestamp?.timestampValue ? 
                                        new Date(conditionFields.timestamp.timestampValue).toLocaleDateString() : 'Sin fecha',
                                    medidaControl: conditionFields.controlMeasure?.stringValue || 'Sin medida de control',
                                    status: conditionStatus
                                };
                                unsafeConditions.push(condition);
                            }
                        }
                    }
                } catch (subError) {}

                detallesTerritorios.push({
                    numero: territorioNumero,
                    id: territoryId,
                    owner: owner,
                    unsafeConditions: unsafeConditions
                });
            }
        }
        
        let resultado = "🚦 *INFORME SEMÁFORO DE TERRITORIOS*\n\n";
        resultado += "⏰ *Fecha y hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";

        if (territoriosEnRojo.length === 0) {
            resultado += "✅ *ESTADO ACTUAL:* Todos los 9 territorios están en verde ✅\n\n";
            resultado += "No hay territorios en rojo. Todas las áreas operan de manera segura.\n";
        } else {
            resultado += `🔴 *ESTADO ACTUAL:* ${territoriosEnRojo.length} de 9 territorios en rojo.\n\n`;
            resultado += `*Territorios en rojo:* ${territoriosEnRojo.join(', ')}\n\n`;
            
            resultado += `📋 *DETALLES DE TERRITORIOS EN ROJO:*\n\n`;
            
            detallesTerritorios.forEach((territorio) => {
                resultado += `📍 *TERRITORIO ${territorio.numero}*\n`;
                resultado += `• *Dueño:* ${territorio.owner}\n`;
                
                if (territorio.unsafeConditions && territorio.unsafeConditions.length > 0) {
                    resultado += `• *Condiciones inseguras activas:* ${territorio.unsafeConditions.length}\n`;
                    
                    territorio.unsafeConditions.forEach((condicion, idx) => {
                        resultado += `\n  *Condición ${idx + 1}:*\n`;
                        resultado += `  📝 *Descripción:* ${condicion.descripcion}\n`;
                        resultado += `  📅 *Fecha:* ${condicion.fecha}\n`;
                        resultado += `  ✅ *Medida de control:* ${condicion.medidaControl}\n`;
                        resultado += `  📊 *Estado:* ${condicion.status === 'active' ? 'Activa' : condicion.status}\n`;
                    });
                } else {
                    resultado += `• *Condiciones inseguras:* No hay condiciones activas registradas\n`;
                }
                
                resultado += `\n`;
            });
        }

        resultado += "\n📊 *INFORMACIÓN GENERAL:*\n";
        resultado += "• Total territorios monitoreados: 9\n";
        resultado += "• Verde: Condiciones seguras\n";
        resultado += "• Rojo: Condiciones inseguras detectadas\n\n";
        
        resultado += "🔗 *Fuente:* Semáforo de territorios\n";
        resultado += "⚠️ *Para más detalles, visita:* https://territorios-jarabe.web.app/\n";

        return resultado;

    } catch (error) {
        let mensajeError = "🚦 *INFORME SEMÁFORO DE TERRITORIOS*\n\n";
        mensajeError += "❌ *Error al obtener información*\n\n";
        mensajeError += "No se pudo conectar con la base de datos de Firestore.\n\n";
        mensajeError += "🔗 *Enlace alternativo:* https://territorios-jarabe.web.app/\n";
        mensajeError += "⏰ *Hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";
        
        return mensajeError;
    }
}

const FIREBASE_CONFIG_ILC = {
    apiKey: "AIzaSyDYSicDGQc48QLUtWHroRB30UNbATFu4c8",
    databaseURL: "https://conocestusbrechas-d911a-default-rtdb.firebaseio.com"
};

const FIREBASE_CONFIG_OUTS = {
    apiKey: "AIzaSyBX0_IzQWnUrdhHH-H0jMNbAp0thOVhfpU",
    databaseURL: "https://skapdeouts-default-rtdb.firebaseio.com"
};

function esNoAplica(respuesta) {
    if (!respuesta) return false;
    
    const feedback = respuesta.feedback || '';
    const comentario = respuesta.comentario || '';
    const estado = respuesta.estado || '';
    
    const feedbackLower = feedback.toString().toLowerCase().trim();
    const comentarioLower = comentario.toString().toLowerCase().trim();
    const estadoLower = estado.toString().toLowerCase().trim();
    
    return (
        feedbackLower === 'n/a' ||
        feedbackLower === 'na' ||
        feedbackLower === 'no aplica' ||
        feedbackLower.includes('no aplica') ||
        feedbackLower.includes('n/a') ||
        comentarioLower.includes('no aplica') ||
        comentarioLower.includes('n/a') ||
        estadoLower === 'n/a' ||
        estadoLower === 'na' ||
        estadoLower === 'no aplica' ||
        estadoLower.includes('no aplica')
    );
}

async function buscarSkapILC(codigoEmpleado) {
    try {
        const codigoBusqueda = codigoEmpleado.trim();
        
        const databaseUrl = FIREBASE_CONFIG_ILC.databaseURL;
        
        const usuariosResponse = await axios.get(`${databaseUrl}/usuarios.json`, {
            timeout: 15000
        });
        
        const usuarios = usuariosResponse.data;
        
        if (!usuarios) {
            return `❌ *NO ENCONTRADO - ILC*\n\n` +
                   `No hay usuarios registrados en la base de datos ILC.`;
        }
        
        let usuarioEncontrado = null;
        let usuarioIdEncontrado = null;
        
        for (const usuarioId in usuarios) {
            const usuario = usuarios[usuarioId];
            
            if (usuario.carnet && usuario.carnet.toString().trim() === codigoBusqueda) {
                usuarioEncontrado = usuario;
                usuarioIdEncontrado = usuarioId;
                break;
            }
        }
        
        if (!usuarioEncontrado) {
            for (const usuarioId in usuarios) {
                const usuario = usuarios[usuarioId];
                
                const camposABuscar = ['carnet', 'codigo', 'empleado', 'id', 'numero', 'legajo'];
                let encontrado = false;
                
                for (const campo of camposABuscar) {
                    if (usuario[campo] && usuario[campo].toString().includes(codigoBusqueda)) {
                        usuarioEncontrado = usuario;
                        usuarioIdEncontrado = usuarioId;
                        encontrado = true;
                        break;
                    }
                }
                
                if (encontrado) break;
                
                if (usuario.nombre && usuario.nombre.toString().toLowerCase().includes(codigoBusqueda.toLowerCase())) {
                    usuarioEncontrado = usuario;
                    usuarioIdEncontrado = usuarioId;
                    break;
                }
            }
        }
        
        if (!usuarioEncontrado) {
            return `❌ *NO ENCONTRADO - ILC*\n\n` +
                   `El código *${codigoBusqueda}* no fue encontrado en la base de datos ILC.\n\n` +
                   `🔍 *Revisa directamente:* https://skapjarabe.web.app/usuario.html`;
        }
        
        let respuestas = {};
        try {
            const respuestasResponse = await axios.get(`${databaseUrl}/respuestas.json`, {
                timeout: 10000
            });
            respuestas = respuestasResponse.data || {};
            
            const respuestasUsuario = {};
            for (const respuestaId in respuestas) {
                if (respuestas[respuestaId].usuarioId === usuarioIdEncontrado) {
                    respuestasUsuario[respuestaId] = respuestas[respuestaId];
                }
            }
            respuestas = respuestasUsuario;
        } catch (error) {}
        
        let preguntas = {};
        try {
            const preguntasResponse = await axios.get(`${databaseUrl}/preguntas.json`, {
                timeout: 10000
            });
            preguntas = preguntasResponse.data || {};
        } catch (error) {}
        
        let habilidadesAvanzadas = [];
        let habilidadesIntermedias = [];
        let licenciaOperar = [];
        
        for (const respuestaId in respuestas) {
            const respuesta = respuestas[respuestaId];
            const preguntaId = respuesta.preguntaId;
            
            if (preguntas[preguntaId]) {
                const pregunta = preguntas[preguntaId];
                
                if (pregunta.tipoHabilidad === 'Habilidades avanzadas' || 
                    pregunta.tipoHabilidad?.includes('avanzada')) {
                    habilidadesAvanzadas.push({
                        pregunta: pregunta.texto || pregunta.pregunta || 'Sin texto',
                        feedback: respuesta.feedback || 'unknown',
                        comentario: respuesta.comentario || '',
                        aprobada: respuesta.feedback === 'thumbs-up' || respuesta.estado === 'aprobado',
                        esNoAplica: esNoAplica(respuesta),
                        pilar: pregunta.pilar || 'Sin pilar',
                        criterioCierre: pregunta.criterioCierre || 'Sin criterio'
                    });
                } else if (pregunta.tipoHabilidad === 'Habilidades intermedias' || 
                          pregunta.tipoHabilidad?.includes('intermedia')) {
                    habilidadesIntermedias.push({
                        pregunta: pregunta.texto || pregunta.pregunta || 'Sin texto',
                        feedback: respuesta.feedback || 'unknown',
                        comentario: respuesta.comentario || '',
                        aprobada: respuesta.feedback === 'thumbs-up' || respuesta.estado === 'aprobado',
                        esNoAplica: esNoAplica(respuesta),
                        pilar: pregunta.pilar || 'Sin pilar',
                        criterioCierre: pregunta.criterioCierre || 'Sin criterio'
                    });
                } else if (pregunta.tipoHabilidad === 'Licencia para operar' || 
                          pregunta.tipoHabilidad?.includes('licencia')) {
                    licenciaOperar.push({
                        pregunta: pregunta.texto || pregunta.pregunta || 'Sin texto',
                        feedback: respuesta.feedback || 'unknown',
                        comentario: respuesta.comentario || '',
                        aprobada: respuesta.feedback === 'thumbs-up' || respuesta.estado === 'aprobado',
                        esNoAplica: esNoAplica(respuesta),
                        pilar: pregunta.pilar || 'Sin pilar',
                        criterioCierre: pregunta.criterioCierre || 'Sin criterio'
                    });
                }
            }
        }
        
        const habilidadesAvanzadasAplicables = habilidadesAvanzadas.filter(h => !h.esNoAplica);
        const habilidadesIntermediasAplicables = habilidadesIntermedias.filter(h => !h.esNoAplica);
        const licenciaOperarAplicables = licenciaOperar.filter(h => !h.esNoAplica);
        
        const porcentajeAvanzadas = habilidadesAvanzadasAplicables.length > 0 ? 
            Math.round((habilidadesAvanzadasAplicables.filter(h => h.aprobada).length / habilidadesAvanzadasAplicables.length) * 100) : 0;
        
        const porcentajeIntermedias = habilidadesIntermediasAplicables.length > 0 ? 
            Math.round((habilidadesIntermediasAplicables.filter(h => h.aprobada).length / habilidadesIntermediasAplicables.length) * 100) : 0;
        
        const porcentajeLicencia = licenciaOperarAplicables.length > 0 ? 
            Math.round((licenciaOperarAplicables.filter(h => h.aprobada).length / licenciaOperarAplicables.length) * 100) : 0;
        
        let resultado = `📋 *INFORMACIÓN SKAP - ILC*\n\n`;
        resultado += `🔢 *Código:* ${usuarioEncontrado.carnet || codigoBusqueda}\n`;
        resultado += `👤 *Nombre:* ${usuarioEncontrado.nombre || 'No disponible'}\n`;
        
        if (usuarioEncontrado.area) {
            resultado += `🏭 *Área:* ${usuarioEncontrado.area}\n`;
        }
        if (usuarioEncontrado.puesto) {
            resultado += `💼 *Puesto:* ${usuarioEncontrado.puesto}\n`;
        }
        
        resultado += `\n📊 *ESTADÍSTICAS GENERALES:*\n`;
        resultado += `• Habilidades avanzadas: ${habilidadesAvanzadas.length} evaluaciones\n`;
        resultado += `• Habilidades intermedias: ${habilidadesIntermedias.length} evaluaciones\n`;
        resultado += `• Licencia para operar: ${licenciaOperar.length} evaluaciones\n\n`;
        
        resultado += `🎯 *PORCENTAJES DE APROBACIÓN:*\n`;
        resultado += `• Habilidades avanzadas: ${porcentajeAvanzadas}%\n`;
        resultado += `• Habilidades intermedias: ${porcentajeIntermedias}%\n`;
        resultado += `• Licencia para operar: ${porcentajeLicencia}%\n`;
        
        resultado += `\n⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
        resultado += `🔗 *Fuente:* Base de datos ILC`;
        
        return resultado;
        
    } catch (error) {
        let mensajeError = "❌ *ERROR EN CONSULTA SKAP ILC*\n\n";
        mensajeError += `No se pudo realizar la búsqueda para el código: ${codigoEmpleado}\n\n`;
        mensajeError += "🔗 *Enlace:* https://skapjarabe.web.app/usuario.html\n";
        mensajeError += "⏰ *Hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";
        
        return mensajeError;
    }
}

async function buscarSkapOUTS(codigoEmpleado) {
    try {
        const codigoBusqueda = codigoEmpleado.trim();
        
        const databaseUrl = FIREBASE_CONFIG_OUTS.databaseURL;
        
        const usuariosResponse = await axios.get(`${databaseUrl}/usuarios.json`, {
            timeout: 15000
        });
        
        const usuarios = usuariosResponse.data;
        
        if (!usuarios) {
            return `❌ *NO ENCONTRADO - OUTS*\n\n` +
                   `No hay usuarios registrados en la base de datos OUTS.`;
        }
        
        let usuarioEncontrado = null;
        let usuarioIdEncontrado = null;
        
        for (const usuarioId in usuarios) {
            const usuario = usuarios[usuarioId];
            
            if (usuario.carnet && usuario.carnet.toString().trim() === codigoBusqueda) {
                usuarioEncontrado = usuario;
                usuarioIdEncontrado = usuarioId;
                break;
            }
        }
        
        if (!usuarioEncontrado) {
            for (const usuarioId in usuarios) {
                const usuario = usuarios[usuarioId];
                
                const camposABuscar = ['carnet', 'codigo', 'empleado', 'id', 'numero', 'legajo'];
                let encontrado = false;
                
                for (const campo of camposABuscar) {
                    if (usuario[campo] && usuario[campo].toString().includes(codigoBusqueda)) {
                        usuarioEncontrado = usuario;
                        usuarioIdEncontrado = usuarioId;
                        encontrado = true;
                        break;
                    }
                }
                
                if (encontrado) break;
                
                if (usuario.nombre && usuario.nombre.toString().toLowerCase().includes(codigoBusqueda.toLowerCase())) {
                    usuarioEncontrado = usuario;
                    usuarioIdEncontrado = usuarioId;
                    break;
                }
            }
        }
        
        if (!usuarioEncontrado) {
            return `❌ *NO ENCONTRADO - OUTS*\n\n` +
                   `El código *${codigoBusqueda}* no fue encontrado en la base de datos OUTS.\n\n` +
                   `🔍 *Revisa directamente:* https://skapjarabe.web.app/usuario2.html`;
        }
        
        let respuestas = {};
        try {
            const respuestasResponse = await axios.get(`${databaseUrl}/respuestas.json`, {
                timeout: 10000
            });
            respuestas = respuestasResponse.data || {};
            
            const respuestasUsuario = {};
            for (const respuestaId in respuestas) {
                if (respuestas[respuestaId].usuarioId === usuarioIdEncontrado) {
                    respuestasUsuario[respuestaId] = respuestas[respuestaId];
                }
            }
            respuestas = respuestasUsuario;
        } catch (error) {}
        
        let preguntas = {};
        try {
            const preguntasResponse = await axios.get(`${databaseUrl}/preguntas.json`, {
                timeout: 10000
            });
            preguntas = preguntasResponse.data || {};
        } catch (error) {}
        
        let licenciaOperar = [];
        
        for (const respuestaId in respuestas) {
            const respuesta = respuestas[respuestaId];
            const preguntaId = respuesta.preguntaId;
            
            if (preguntas[preguntaId]) {
                const pregunta = preguntas[preguntaId];
                
                if (pregunta.tipoHabilidad === 'Licencia para operar' || 
                    pregunta.tipoHabilidad?.includes('licencia')) {
                    licenciaOperar.push({
                        pregunta: pregunta.texto || pregunta.pregunta || 'Sin texto',
                        feedback: respuesta.feedback || 'unknown',
                        comentario: respuesta.comentario || '',
                        aprobada: respuesta.feedback === 'thumbs-up' || respuesta.estado === 'aprobado',
                        esNoAplica: esNoAplica(respuesta),
                        pilar: pregunta.pilar || 'Sin pilar'
                    });
                }
            }
        }
        
        const licenciaOperarAplicables = licenciaOperar.filter(h => !h.esNoAplica);
        
        const porcentajeLicencia = licenciaOperarAplicables.length > 0 ? 
            Math.round((licenciaOperarAplicables.filter(h => h.aprobada).length / licenciaOperarAplicables.length) * 100) : 0;
        
        let resultado = `📋 *INFORMACIÓN SKAP - OUTS*\n\n`;
        resultado += `🔢 *Código:* ${usuarioEncontrado.carnet || codigoBusqueda}\n`;
        resultado += `👤 *Nombre:* ${usuarioEncontrado.nombre || 'No disponible'}\n`;
        
        if (usuarioEncontrado.area) {
            resultado += `🏭 *Área:* ${usuarioEncontrado.area}\n`;
        }
        if (usuarioEncontrado.puesto) {
            resultado += `💼 *Puesto:* ${usuarioEncontrado.puesto}\n`;
        }
        
        resultado += `\n📊 *ESTADÍSTICAS DE LICENCIA:*\n`;
        resultado += `• Total evaluaciones: ${licenciaOperar.length}\n`;
        resultado += `• Aprobadas: ${licenciaOperarAplicables.filter(h => h.aprobada).length}\n`;
        resultado += `• Pendientes: ${licenciaOperarAplicables.filter(h => !h.aprobada).length}\n`;
        resultado += `• Porcentaje de aprobación: ${porcentajeLicencia}%\n`;
        
        resultado += `\n⏰ *Consulta:* ${moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm')}\n`;
        resultado += `🔗 *Fuente:* Base de datos OUTS`;
        
        return resultado;
        
    } catch (error) {
        let mensajeError = "❌ *ERROR EN CONSULTA SKAP OUTS*\n\n";
        mensajeError += `No se pudo realizar la búsqueda para el código: ${codigoEmpleado}\n\n`;
        mensajeError += "🔗 *Enlace:* https://skapjarabe.web.app/usuario2.html\n";
        mensajeError += "⏰ *Hora:* " + moment().tz(TIMEZONE).format('DD/MM/YYYY HH:mm') + "\n\n";
        
        return mensajeError;
    }
}

async function iniciarProgramacion(message) {
    const userId = message.from;
    
    if (scheduledMessages.length > 0) {
        let mensajeOpciones = "📅 *MENSAJES PROGRAMADOS EXISTENTES*\n\n";
        
        scheduledMessages.forEach((msg, index) => {
            mensajeOpciones += `${index + 1}. Horas: ${msg.horas.join(', ')} - Creado: ${moment(msg.fechaCreacion).tz(TIMEZONE).format('DD/MM/YYYY')}\n`;
        });
        
        mensajeOpciones += "\n*Selecciona una opción:*\n\n";
        mensajeOpciones += "1️⃣ - Editar mensaje actual\n";
        mensajeOpciones += "2️⃣ - Crear nuevo registro con horas diferentes\n";
        mensajeOpciones += "3️⃣ - Eliminar mensaje programado\n";
        mensajeOpciones += "4️⃣ - Cancelar\n\n";
        mensajeOpciones += "Envía el número de la opción (1-4)";
        
        await message.reply(mensajeOpciones);
        userStates.set(userId, { estado: 'seleccionar_opcion_existente', datos: {} });
    } else {
        await iniciarNuevaProgramacion(message);
    }
}

async function iniciarNuevaProgramacion(message) {
    const userId = message.from;
    
    await message.reply(
        "🔐 *PROGRAMACIÓN DE MENSAJES*\n\n" +
        "Esta opción es solo para administradores.\n\n" +
        "Por favor envía tus credenciales en el formato:\n" +
        "`usuario:contraseña`\n\n" +
        "Ejemplo: admin:admin123\n\n" +
        "O envía *cancelar* para regresar al menú principal."
    );
    
    userStates.set(userId, {
        estado: 'esperando_credenciales',
        datos: { esNuevo: true }
    });
}

async function manejarCredenciales(message, userId, estadoUsuario) {
    const texto = message.body.trim();
    
    if (texto.includes(':')) {
        const partes = texto.split(':');
        const usuario = partes[0].trim();
        const contrasena = partes[1].trim();
        
        if (usuario === ADMIN_CREDENTIALS.username && contrasena === ADMIN_CREDENTIALS.password) {
            estadoUsuario.estado = 'seleccionar_tipo_contenido';
            userStates.set(userId, estadoUsuario);
            
            await message.reply(
                "✅ *Credenciales correctas*\n\n" +
                "¿Qué tipo de contenido deseas programar?\n\n" +
                "1️⃣ - Imagen\n" +
                "2️⃣ - Video\n" +
                "3️⃣ - Documento\n" +
                "4️⃣ - Solo texto\n\n" +
                "Envía el número de la opción (1-4)"
            );
        } else {
            await message.reply(
                "❌ *Credenciales incorrectas*\n\n" +
                "Por favor ingresa de nuevo las credenciales.\n" +
                "Formato: usuario:contraseña"
            );
        }
    } else {
        await message.reply("Formato incorrecto. Usa: usuario:contraseña");
    }
}

async function manejarTipoContenido(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion === '1') {
        estadoUsuario.datos.tipoContenido = 'imagen';
        estadoUsuario.estado = 'esperando_archivo';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "📸 *PROGRAMAR IMAGEN*\n\n" +
            "Ahora envía la imagen que deseas programar:\n\n" +
            "O envía *omitir* para programar solo texto."
        );
        
    } else if (opcion === '2') {
        estadoUsuario.datos.tipoContenido = 'video';
        estadoUsuario.estado = 'esperando_archivo';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "🎬 *PROGRAMAR VIDEO*\n\n" +
            "Ahora envía el video que deseas programar:\n\n" +
            "O envía *omitir* para programar solo texto."
        );
        
    } else if (opcion === '3') {
        estadoUsuario.datos.tipoContenido = 'documento';
        estadoUsuario.estado = 'esperando_archivo';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "📄 *PROGRAMAR DOCUMENTO*\n\n" +
            "Ahora envía el documento que deseas programar:\n\n" +
            "O envía *omitir* para programar solo texto."
        );
        
    } else if (opcion === '4') {
        estadoUsuario.datos.tipoContenido = 'texto';
        estadoUsuario.datos.archivoInfo = null;
        estadoUsuario.estado = 'esperando_mensaje';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "📝 *PROGRAMAR SOLO TEXTO*\n\n" +
            "Ahora envía el mensaje de texto que quieres programar:"
        );
        
    } else {
        await message.reply("❌ Opción inválida. Por favor envía un número del 1 al 4.");
    }
}

async function manejarArchivo(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    if (texto === 'omitir') {
        estadoUsuario.datos.archivoInfo = null;
        estadoUsuario.estado = 'esperando_mensaje';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "✅ *Sin archivo adjunto*\n\n" +
            "Ahora envía el mensaje de texto que quieres programar:"
        );
        return;
    }
    
    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            let tipo = estadoUsuario.datos.tipoContenido;
            
            if (!tipo) {
                if (media.mimetype.includes('image')) {
                    tipo = 'imagen';
                } else if (media.mimetype.includes('video')) {
                    tipo = 'video';
                } else {
                    tipo = 'documento';
                }
            }
            
            const archivoInfo = await guardarArchivo(media, userId, tipo);
            
            estadoUsuario.datos.archivoInfo = archivoInfo;
            estadoUsuario.datos.imagenPath = archivoInfo.ruta;
            estadoUsuario.estado = 'esperando_mensaje';
            userStates.set(userId, estadoUsuario);
            
            await message.reply(
                `✅ *${tipo.toUpperCase()} recibido correctamente*\n\n` +
                "Ahora envía el mensaje de texto que quieres que acompañe al archivo.\n\n" +
                "O envía *omitir* si solo quieres enviar el archivo sin texto."
            );
        } catch (error) {
            await message.reply("❌ Error al procesar el archivo.");
        }
    } else if (texto !== 'omitir') {
        await message.reply("❌ No se detectó ningún archivo.");
    }
}

async function manejarMensajeTexto(message, userId, estadoUsuario) {
    const texto = message.body.trim();
    
    if (texto.toLowerCase() === 'omitir') {
        estadoUsuario.datos.mensaje = "";
    } else {
        estadoUsuario.datos.mensaje = texto;
    }
    
    estadoUsuario.estado = 'seleccionar_cantidad_horas';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ *Mensaje configurado*\n\n" +
        "¿Cuántas horas al día quieres programar?\n\n" +
        "1️⃣ - 1 hora al día\n" +
        "2️⃣ - 2 horas al día\n" +
        "3️⃣ - 3 horas al día\n\n" +
        "Envía el número de la opción (1-3)"
    );
}

async function manejarCantidadHoras(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion === '1') {
        estadoUsuario.datos.cantidadHoras = 1;
        estadoUsuario.estado = 'esperando_hora_unica';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "⏰ *PROGRAMAR 1 HORA*\n\n" +
            "Envía la hora en la que quieres que se envíe el mensaje.\n\n" +
            "*Ejemplos:* 06:00, 8:30 am, 18:00"
        );
        
    } else if (opcion === '2') {
        estadoUsuario.datos.cantidadHoras = 2;
        estadoUsuario.estado = 'esperando_horas';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "⏰ *PROGRAMAR 2 HORAS*\n\n" +
            "Envía las 2 horas separadas por 'y'.\n\n" +
            "*Ejemplo:* 06:00 y 18:00"
        );
        
    } else if (opcion === '3') {
        estadoUsuario.datos.cantidadHoras = 3;
        estadoUsuario.estado = 'esperando_tres_horas';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "⏰ *PROGRAMAR 3 HORAS*\n\n" +
            "Envía las 3 horas separadas por comas y la última con 'y'.\n\n" +
            "*Ejemplo:* 06:00, 12:00 y 18:00"
        );
        
    } else {
        await message.reply("❌ Opción inválida.");
    }
}

async function manejarHoraUnica(message, userId, estadoUsuario) {
    const horaStr = message.body.trim();
    const horaParseada = parsearHora(horaStr);
    
    if (horaParseada) {
        estadoUsuario.datos.horas = [horaParseada];
        estadoUsuario.estado = 'seleccionar_frecuencia';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "✅ *Hora configurada correctamente*\n\n" +
            "*Hora programada:* " + horaParseada + "\n\n" +
            "¿Con qué frecuencia quieres que se envíe?\n\n" +
            "1️⃣ - *Una sola vez*\n" +
            "2️⃣ - *Diariamente*\n" +
            "3️⃣ - *Personalizado*\n\n" +
            "Envía el número de la opción (1-3)"
        );
    } else {
        await message.reply(`❌ Formato de hora inválido.`);
    }
}

async function manejarHorasDos(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    const horas = texto.split(' y ');
    
    if (horas.length !== 2) {
        await message.reply("❌ Debes enviar exactamente DOS horas separadas por 'y'");
        return;
    }
    
    const horasParseadas = [];
    
    for (let horaStr of horas) {
        const horaParseada = parsearHora(horaStr.trim());
        if (horaParseada) {
            horasParseadas.push(horaParseada);
        } else {
            await message.reply(`❌ Formato de hora inválido: "${horaStr}"`);
            return;
        }
    }
    
    estadoUsuario.datos.horas = horasParseadas;
    estadoUsuario.estado = 'seleccionar_frecuencia';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ *Horas configuradas correctamente*\n\n" +
        "*Horas programadas:* " + horasParseadas.join(' y ') + "\n\n" +
        "¿Con qué frecuencia quieres que se envíe?\n\n" +
        "1️⃣ - *Una sola vez*\n" +
        "2️⃣ - *Diariamente*\n" +
        "3️⃣ - *Personalizado*\n\n" +
        "Envía el número de la opción (1-3)"
    );
}

async function manejarTresHoras(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    const partes = texto.split(' y ');
    let horasArray = [];
    
    if (partes.length === 2) {
        const primerasHoras = partes[0].split(',').map(h => h.trim());
        const ultimaHora = partes[1].trim();
        horasArray = [...primerasHoras, ultimaHora];
    } else {
        horasArray = texto.split(',').map(h => h.trim());
    }
    
    if (horasArray.length !== 3) {
        await message.reply("❌ Debes enviar exactamente TRES horas\n\nEjemplo: 06:00, 12:00 y 18:00");
        return;
    }
    
    const horasParseadas = [];
    
    for (let horaStr of horasArray) {
        const horaParseada = parsearHora(horaStr);
        if (horaParseada) {
            horasParseadas.push(horaParseada);
        } else {
            await message.reply(`❌ Formato de hora inválido: "${horaStr}"`);
            return;
        }
    }
    
    estadoUsuario.datos.horas = horasParseadas;
    estadoUsuario.estado = 'seleccionar_frecuencia';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ *Horas configuradas correctamente*\n\n" +
        "*Horas programadas:* " + horasParseadas.join(', ') + "\n\n" +
        "¿Con qué frecuencia quieres que se envíe?\n\n" +
        "1️⃣ - *Una sola vez*\n" +
        "2️⃣ - *Diariamente*\n" +
        "3️⃣ - *Personalizado*\n\n" +
        "Envía el número de la opción (1-3)"
    );
}

async function manejarFrecuencia(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion === '1') {
        estadoUsuario.datos.frecuencia = 'una_vez';
        estadoUsuario.datos.fechaInicio = new Date();
        estadoUsuario.datos.fechaFin = new Date();
        
        estadoUsuario.estado = 'esperando_confirmacion_grupos';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "✅ *Frecuencia configurada: Una sola vez*\n\n" +
            "¿Quieres que el mensaje se envíe a *todos* los grupos?\n\n" +
            "1️⃣ - *Sí*, enviar a todos\n" +
            "2️⃣ - *No*, seleccionar grupos"
        );
        
    } else if (opcion === '2') {
        estadoUsuario.datos.frecuencia = 'diario';
        
        estadoUsuario.estado = 'esperando_confirmacion_grupos';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "✅ *Frecuencia configurada: Diariamente*\n\n" +
            "¿Quieres que el mensaje se envíe a *todos* los grupos?\n\n" +
            "1️⃣ - *Sí*, enviar a todos\n" +
            "2️⃣ - *No*, seleccionar grupos"
        );
        
    } else if (opcion === '3') {
        estadoUsuario.datos.frecuencia = 'personalizado';
        estadoUsuario.estado = 'esperando_fecha_inicio';
        userStates.set(userId, estadoUsuario);
        
        await message.reply(
            "📅 *FRECUENCIA PERSONALIZADA*\n\n" +
            "Envía la fecha de INICIO en formato DD/MM/YYYY\n\n" +
            "*Ejemplo:* 15/01/2024\n\n" +
            "O envía *hoy* para empezar hoy"
        );
        
    } else {
        await message.reply("❌ Opción inválida.");
    }
}

async function manejarFechaInicio(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    let fechaInicio;
    
    if (texto === 'hoy') {
        fechaInicio = new Date();
    } else {
        const regexFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = texto.match(regexFecha);
        
        if (match) {
            const dia = parseInt(match[1]);
            const mes = parseInt(match[2]) - 1;
            const anio = parseInt(match[3]);
            
            fechaInicio = new Date(anio, mes, dia);
            
            if (fechaInicio.getDate() !== dia || fechaInicio.getMonth() !== mes) {
                await message.reply("❌ Fecha inválida.");
                return;
            }
        } else {
            await message.reply("❌ Formato de fecha inválido.");
            return;
        }
    }
    
    estadoUsuario.datos.fechaInicio = fechaInicio;
    estadoUsuario.estado = 'esperando_fecha_fin';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ *Fecha de inicio configurada*\n\n" +
        "Envía la fecha de FIN en formato DD/MM/YYYY\n\n" +
        "*Ejemplo:* 31/12/2024\n\n" +
        "O envía *indefinido* para que no tenga fecha de fin"
    );
}

async function manejarFechaFin(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    let fechaFin = null;
    
    if (texto === 'indefinido') {
        fechaFin = null;
    } else {
        const regexFecha = /^(\d{2})\/(\d{2})\/(\d{4})$/;
        const match = texto.match(regexFecha);
        
        if (match) {
            const dia = parseInt(match[1]);
            const mes = parseInt(match[2]) - 1;
            const anio = parseInt(match[3]);
            
            fechaFin = new Date(anio, mes, dia);
            
            if (fechaFin.getDate() !== dia || fechaFin.getMonth() !== mes) {
                await message.reply("❌ Fecha inválida.");
                return;
            }
        } else {
            await message.reply("❌ Formato de fecha inválido.");
            return;
        }
    }
    
    estadoUsuario.datos.fechaFin = fechaFin;
    estadoUsuario.estado = 'esperando_confirmacion_grupos';
    userStates.set(userId, estadoUsuario);
    
    await message.reply(
        "✅ *Fechas configuradas correctamente*\n\n" +
        "¿Quieres que el mensaje se envíe a *todos* los grupos?\n\n" +
        "1️⃣ - *Sí*, enviar a todos\n" +
        "2️⃣ - *No*, seleccionar grupos"
    );
}

async function manejarConfirmacionGrupos(message, userId, estadoUsuario) {
    const opcion = message.body.trim();
    
    if (opcion === '1' || opcion.toLowerCase() === 'sí' || opcion.toLowerCase() === 'si') {
        estadoUsuario.datos.enviarATodos = true;
        estadoUsuario.estado = 'mostrando_vista_previa';
        userStates.set(userId, estadoUsuario);
        
        const preview = generarVistaPrevia(estadoUsuario.datos);
        await message.reply(preview + "\n\n¿Deseas guardar esta programación?\n\n1️⃣ - Sí\n2️⃣ - No");
        
    } else if (opcion === '2' || opcion.toLowerCase() === 'no') {
        estadoUsuario.datos.enviarATodos = false;
        estadoUsuario.estado = 'seleccionando_grupos';
        userStates.set(userId, estadoUsuario);
        
        const grupos = await obtenerGrupos();
        availableGroups = grupos;
        
        if (grupos.length === 0) {
            await message.reply("❌ No hay grupos disponibles.");
            userStates.delete(userId);
            return;
        }
        
        let listaGrupos = "📋 *GRUPOS DISPONIBLES*\n\n";
        grupos.forEach((grupo, index) => {
            listaGrupos += `${numeroConEmoji(index + 1)} - ${grupo.name}\n`;
        });
        
        listaGrupos += "\nEnvía los *números* de los grupos (separados por coma):\n";
        listaGrupos += "Ejemplo: 1,3,5\n";
        listaGrupos += "O envía *todos* para seleccionar todos los grupos";
        
        await message.reply(listaGrupos);
        
    } else {
        await message.reply("Por favor selecciona:\n1 - Sí\n2 - No");
    }
}

async function manejarSeleccionGrupos(message, userId, estadoUsuario) {
    const texto = message.body.trim().toLowerCase();
    
    if (texto === 'todos') {
        estadoUsuario.datos.gruposSeleccionados = availableGroups.map(g => g.id._serialized);
    } else {
        const numeros = texto.split(',').map(num => parseInt(num.trim()) - 1);
        const gruposValidos = [];
        
        for (const num of numeros) {
            if (num >= 0 && num < availableGroups.length) {
                gruposValidos.push(availableGroups[num].id._serialized);
            }
        }
        
        if (gruposValidos.length === 0) {
            await message.reply("❌ No seleccionaste grupos válidos.");
            return;
        }
        
        estadoUsuario.datos.gruposSeleccionados = gruposValidos;
    }
    
    estadoUsuario.estado = 'mostrando_vista_previa';
    userStates.set(userId, estadoUsuario);
    
    const preview = generarVistaPrevia(estadoUsuario.datos);
    await message.reply(preview + "\n\n*¿Deseas guardar esta programación?*\n\n1️⃣ - Sí\n2️⃣ - No");
}

async function guardarProgramacion(message, userId, estadoUsuario) {
    const programacion = {
        archivoInfo: estadoUsuario.datos.archivoInfo,
        imagenPath: estadoUsuario.datos.imagenPath || (estadoUsuario.datos.archivoInfo ? estadoUsuario.datos.archivoInfo.ruta : null),
        mensaje: estadoUsuario.datos.mensaje || "",
        horas: estadoUsuario.datos.horas,
        frecuencia: estadoUsuario.datos.frecuencia || 'diario',
        fechaInicio: estadoUsuario.datos.fechaInicio || new Date(),
        fechaFin: estadoUsuario.datos.fechaFin || null,
        grupos: estadoUsuario.datos.enviarATodos ? 'todos' : estadoUsuario.datos.gruposSeleccionados,
        fechaCreacion: new Date(),
        creadoPor: userId,
        ultimoEnvio: null,
        enviosHoy: []
    };
    
    scheduledMessages.push(programacion);
    
    try {
        const archivoProgramaciones = path.join(__dirname, 'programaciones.json');
        fs.writeFileSync(archivoProgramaciones, JSON.stringify(scheduledMessages, null, 2));
    } catch (error) {}
    
    await message.reply(
        "✅ *PROGRAMACIÓN GUARDADA EXITOSAMENTE*\n\n" +
        "El mensaje se enviará automáticamente a las horas especificadas."
    );
    
    userStates.delete(userId);
}

async function manejarOpcionExistente(message, userId, estadoUsuario) {
    const texto = message.body.trim();
    
    if (texto === '1') {
        estadoUsuario.estado = 'seleccionar_editar';
        userStates.set(userId, estadoUsuario);
        
        let mensajeLista = "📝 *SELECCIONAR MENSAJE A EDITAR*\n\n";
        scheduledMessages.forEach((msg, index) => {
            mensajeLista += `${numeroConEmoji(index + 1)}. Horas: ${msg.horas.join(', ')}\n`;
        });
        
        mensajeLista += "\nEnvía el número del mensaje que quieres editar:";
        await message.reply(mensajeLista);
        
    } else if (texto === '2') {
        await iniciarNuevaProgramacion(message);
        
    } else if (texto === '3') {
        estadoUsuario.estado = 'seleccionar_eliminar';
        userStates.set(userId, estadoUsuario);
        
        let mensajeLista = "🗑️ *SELECCIONAR MENSAJE A ELIMINAR*\n\n";
        scheduledMessages.forEach((msg, index) => {
            mensajeLista += `${numeroConEmoji(index + 1)}. Horas: ${msg.horas.join(', ')}\n`;
        });
        
        mensajeLista += "\nEnvía el número del mensaje que quieres eliminar:";
        await message.reply(mensajeLista);
        
    } else if (texto === '4') {
        userStates.delete(userId);
        await message.reply("❌ Operación cancelada.");
    } else {
        await message.reply("❌ Opción inválida.");
    }
}

async function manejarSeleccionEditar(message, userId, estadoUsuario) {
    const texto = message.body.trim();
    const indice = parseInt(texto) - 1;
    
    if (isNaN(indice) || indice < 0 || indice >= scheduledMessages.length) {
        await message.reply("❌ Número inválido.");
        return;
    }
    
    const programacionExistente = scheduledMessages[indice];
    
    await message.reply(
        "🔐 *EDITAR MENSAJE PROGRAMADO*\n\n" +
        "Por favor envía tus credenciales en el formato:\n" +
        "`usuario:contraseña`"
    );
    
    estadoUsuario.estado = 'esperando_credenciales_editar';
    estadoUsuario.datos.indiceEditar = indice;
    estadoUsuario.datos.programacionExistente = programacionExistente;
    userStates.set(userId, estadoUsuario);
}

async function manejarSeleccionEliminar(message, userId, estadoUsuario) {
    const texto = message.body.trim();
    const indice = parseInt(texto) - 1;
    
    if (isNaN(indice) || indice < 0 || indice >= scheduledMessages.length) {
        await message.reply("❌ Número inválido.");
        return;
    }
    
    const programacionEliminar = scheduledMessages[indice];
    
    await message.reply(
        "🔐 *ELIMINAR MENSAJE PROGRAMADO*\n\n" +
        "Por favor envía tus credenciales en el formato:\n" +
        "`usuario:contraseña`"
    );
    
    estadoUsuario.estado = 'esperando_credenciales_eliminar';
    estadoUsuario.datos.indiceEliminar = indice;
    estadoUsuario.datos.programacionEliminar = programacionEliminar;
    userStates.set(userId, estadoUsuario);
}

async function eliminarProgramacion(message, userId, estadoUsuario) {
    const indice = estadoUsuario.datos.indiceEliminar;
    const programacionEliminada = scheduledMessages.splice(indice, 1)[0];
    
    if (programacionEliminada.archivoInfo && fs.existsSync(programacionEliminada.archivoInfo.ruta)) {
        try {
            fs.unlinkSync(programacionEliminada.archivoInfo.ruta);
        } catch (error) {}
    }
    
    try {
        const archivoProgramaciones = path.join(__dirname, 'programaciones.json');
        fs.writeFileSync(archivoProgramaciones, JSON.stringify(scheduledMessages, null, 2));
    } catch (error) {}
    
    await message.reply("✅ *PROGRAMACIÓN ELIMINADA EXITOSAMENTE*");
    
    userStates.delete(userId);
}

async function manejarSkapILC(message, userId) {
    userStates.set(userId, { 
        estado: 'esperando_codigo_skap_ilc',
        datos: {}
    });
    
    await message.reply(
        "📋 *CONSULTA SKAP - ILC*\n\n" +
        "Envía tu código de empleado a continuación:\n\n" +
        "*Ejemplos:* 76001111, 1111\n\n" +
        "O envía *cancelar* para regresar."
    );
}

async function manejarSkapOUTS(message, userId) {
    userStates.set(userId, { 
        estado: 'esperando_codigo_skap_outs',
        datos: {}
    });
    
    await message.reply(
        "📋 *CONSULTA SKAP - OUTS*\n\n" +
        "Envía tu código de empleado a continuación:\n\n" +
        "*Ejemplos:* 20120638, 0638\n\n" +
        "O envía *cancelar* para regresar."
    );
}

async function manejarReclamosCalidad(message, userId) {
    await message.reply("🔍 Consultando reclamos de calidad...");
    
    const resultado = await consultarReclamosCalidad();
    await message.reply(resultado.mensaje);
}

async function enviarBienvenidaGrupo(chat) {
    try {
        const mensajeBienvenida = 
            `👋 *¡Hola a todos!*\n\n` +
            `Mi nombre es *Jarabito* 🤖, tu asistente de seguridad e información de *Jarabe*\n\n` +
            `Para interactuar conmigo, escribe el comando:\n` +
            `*/menu* o */menú*\n\n` +
            `*Funciones disponibles:*\n` +
            `• Consultar semáforo de territorios 🚦\n` +
            `• Consultar información SKAP 📋\n` +
            `• Acceder a checklists de seguridad ✅\n` +
            `• Consultar reclamos de calidad 📊\n` +
            `• Consultar CIP Jarabe Terminado 🧪\n\n` +
            `¡Estoy aquí para ayudar! 🚀`;
        
        await chat.sendMessage(mensajeBienvenida);
    } catch (error) {}
}

async function manejarEstadoUsuario(message, userId) {
    const estadoUsuario = userStates.get(userId);
    const texto = message.body.trim().toLowerCase();
    
    if (texto === 'cancelar') {
        userStates.delete(userId);
        await message.reply("❌ Operación cancelada.");
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_tanque') {
        await manejarSeleccionTanque(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_tipo_busqueda') {
        await manejarTipoBusqueda(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_rango_fechas') {
        await manejarRangoFechas(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_mes') {
        await manejarSeleccionMes(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_anio') {
        await manejarSeleccionAnio(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'cip_esperando_formato_descarga') {
        await manejarFormatoDescarga(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'guardian_esperando_codigo') {
        const codigo = message.body.trim();
        
        if (!codigo || codigo === '') {
            await message.reply("❌ Por favor ingresa un código válido.");
            return;
        }
        
        estadoUsuario.datos.codigo = codigo;
        estadoUsuario.estado = 'guardian_esperando_anio';
        userStates.set(userId, estadoUsuario);
        
        const añoActual = moment().tz(TIMEZONE).year();
        const años = [añoActual, añoActual - 1, añoActual - 2];
        
        let menuAños = `📅 *SELECCIONA EL AÑO*\n\n`;
        años.forEach((año, index) => {
            menuAños += `${numeroConEmoji(index + 1)} - ${año}\n`;
        });
        
        menuAños += `\n*Envía el número del año*`;
        
        await message.reply(menuAños);
        return;
    }
    
    if (estadoUsuario.estado === 'guardian_esperando_anio') {
        const opcion = parseInt(texto);
        
        if (isNaN(opcion) || opcion < 1 || opcion > 3) {
            await message.reply("❌ Opción inválida.");
            return;
        }
        
        const añoActual = moment().tz(TIMEZONE).year();
        const años = [añoActual, añoActual - 1, añoActual - 2];
        const añoSeleccionado = años[opcion - 1];
        
        estadoUsuario.datos.anio = añoSeleccionado;
        estadoUsuario.estado = 'guardian_esperando_mes';
        userStates.set(userId, estadoUsuario);
        
        let menuMeses = `📅 *SELECCIONA EL MES*\n\n`;
        MESES.forEach((mes, index) => {
            menuMeses += `${numeroConEmoji(index + 1)} - ${mes}\n`;
        });
        
        menuMeses += `\n*Envía el número del mes (1-12)*`;
        
        await message.reply(menuMeses);
        return;
    }
    
    if (estadoUsuario.estado === 'guardian_esperando_mes') {
        const mes = parseInt(texto);
        
        if (isNaN(mes) || mes < 1 || mes > 12) {
            await message.reply("❌ Opción inválida.");
            return;
        }
        
        await message.reply("🔍 Consultando Guardian...");
        
        const resultado = await consultarGuardian(
            estadoUsuario.datos.codigo,
            mes,
            estadoUsuario.datos.anio
        );
        
        await message.reply(resultado.mensaje);
        
        userStates.delete(userId);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_menu_principal') {
        if (texto === '1') {
            await obtenerGruposDisponibles(message, userId);
        } else if (texto === '2') {
            await obtenerInfoTecnico(message, userId);
        } else {
            await message.reply("❌ Opción inválida.");
        }
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_grupo') {
        const opcion = parseInt(texto);
        const grupos = estadoUsuario.datos.grupos;
        
        if (isNaN(opcion) || opcion < 1 || opcion > grupos.length) {
            await message.reply(`❌ Opción inválida.`);
            return;
        }
        
        const grupoSeleccionado = grupos[opcion - 1];
        await obtenerAnosDisponibles(message, userId, 'grupo', grupoSeleccionado);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_ano_grupo') {
        const opcion = parseInt(texto);
        const anos = estadoUsuario.datos.anos;
        
        if (isNaN(opcion) || opcion < 1 || opcion > anos.length) {
            await message.reply(`❌ Opción inválida.`);
            return;
        }
        
        const añoSeleccionado = anos[opcion - 1];
        await obtenerMesesGrupo(message, userId, estadoUsuario.datos.grupo, añoSeleccionado);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_mes_grupo') {
        const mes = parseInt(texto);
        
        if (isNaN(mes) || mes < 1 || mes > 12) {
            await message.reply("❌ Opción inválida.");
            return;
        }
        
        await obtenerResultadosGrupo(message, userId, estadoUsuario.datos.grupo, estadoUsuario.datos.año, mes);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_codigo_tecnico') {
        const codigo = message.body.trim();
        
        if (!codigo || codigo === '') {
            await message.reply("❌ Por favor ingresa un código válido.");
            return;
        }
        
        await obtenerAnosDisponibles(message, userId, 'tecnico', codigo);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_ano_tecnico') {
        const opcion = parseInt(texto);
        const anos = estadoUsuario.datos.anos;
        
        if (isNaN(opcion) || opcion < 1 || opcion > anos.length) {
            await message.reply(`❌ Opción inválida.`);
            return;
        }
        
        const añoSeleccionado = anos[opcion - 1];
        await obtenerMesesTecnico(message, userId, estadoUsuario.datos.tecnico, añoSeleccionado);
        return;
    }
    
    if (estadoUsuario.estado === 'checklist_esperando_mes_tecnico') {
        const mes = parseInt(texto);
        
        if (isNaN(mes) || mes < 1 || mes > 12) {
            await message.reply("❌ Opción inválida.");
            return;
        }
        
        await obtenerResultadosTecnico(message, userId, estadoUsuario.datos, estadoUsuario.datos.año, mes);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_codigo_skap_ilc') {
        const codigoEmpleado = message.body.trim();
        
        if (!codigoEmpleado || codigoEmpleado === '') {
            await message.reply("❌ Por favor ingresa un código válido.");
            return;
        }
        
        await message.reply("🔍 Buscando información de SKAP ILC...");
        
        try {
            const resultado = await buscarSkapILC(codigoEmpleado);
            await message.reply(resultado);
            
        } catch (error) {
            await message.reply("❌ Error en la búsqueda.");
        }
        
        userStates.delete(userId);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_codigo_skap_outs') {
        const codigoEmpleado = message.body.trim();
        
        if (!codigoEmpleado || codigoEmpleado === '') {
            await message.reply("❌ Por favor ingresa un código válido.");
            return;
        }
        
        await message.reply("🔍 Buscando información de SKAP OUTS...");
        
        try {
            const resultado = await buscarSkapOUTS(codigoEmpleado);
            await message.reply(resultado);
            
        } catch (error) {
            await message.reply("❌ Error en la búsqueda.");
        }
        
        userStates.delete(userId);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_tipo_skap') {
        if (texto === '1') {
            await manejarSkapILC(message, userId);
        } else if (texto === '2') {
            await manejarSkapOUTS(message, userId);
        } else {
            await message.reply("❌ Opción inválida.");
        }
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_opcion_existente') {
        await manejarOpcionExistente(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_editar') {
        await manejarSeleccionEditar(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_eliminar') {
        await manejarSeleccionEliminar(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_credenciales_editar' || estadoUsuario.estado === 'esperando_credenciales_eliminar') {
        if (texto.includes(':')) {
            const partes = texto.split(':');
            const usuario = partes[0].trim();
            const contrasena = partes[1].trim();
            
            if (usuario === ADMIN_CREDENTIALS.username && contrasena === ADMIN_CREDENTIALS.password) {
                if (estadoUsuario.estado === 'esperando_credenciales_editar') {
                    estadoUsuario.estado = 'seleccionar_tipo_contenido_editar';
                    estadoUsuario.datos = {
                        ...estadoUsuario.datos.programacionExistente,
                        indiceEditar: estadoUsuario.datos.indiceEditar
                    };
                    userStates.set(userId, estadoUsuario);
                    
                    await message.reply(
                        "✅ *Credenciales correctas*\n\n" +
                        "¿Qué tipo de contenido deseas programar?\n\n" +
                        "1️⃣ - Mantener archivo actual\n" +
                        "2️⃣ - Cambiar imagen\n" +
                        "3️⃣ - Cambiar video\n" +
                        "4️⃣ - Cambiar documento\n" +
                        "5️⃣ - Solo texto\n\n" +
                        "Envía el número de la opción (1-5)"
                    );
                } else {
                    await eliminarProgramacion(message, userId, estadoUsuario);
                }
            } else {
                await message.reply("❌ Credenciales incorrectas.");
            }
        } else {
            await message.reply("Formato incorrecto. Usa: usuario:contraseña");
        }
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_tipo_contenido_editar') {
        const opcion = texto;
        
        if (opcion === '1') {
            estadoUsuario.estado = 'esperando_mensaje_editar';
            userStates.set(userId, estadoUsuario);
            
            await message.reply(
                "✅ *Archivo conservado*\n\n" +
                "Ahora envía el NUEVO mensaje de texto:\n\n" +
                "O envía *omitir* o *mantener*"
            );
            
        } else if (opcion === '2' || opcion === '3' || opcion === '4') {
            let tipo = '';
            if (opcion === '2') tipo = 'imagen';
            else if (opcion === '3') tipo = 'video';
            else tipo = 'documento';
            
            estadoUsuario.datos.tipoContenido = tipo;
            estadoUsuario.estado = 'esperando_archivo_editar';
            userStates.set(userId, estadoUsuario);
            
            await message.reply(
                `📸 *CAMBIAR ${tipo.toUpperCase()}*\n\n` +
                `Envía el NUEVO ${tipo}:\n\n` +
                `O envía *mantener* para conservar el actual.`
            );
            
        } else if (opcion === '5') {
            estadoUsuario.datos.tipoContenido = 'texto';
            estadoUsuario.datos.archivoInfo = null;
            estadoUsuario.estado = 'esperando_mensaje_editar';
            userStates.set(userId, estadoUsuario);
            
            await message.reply(
                "📝 *SOLO TEXTO*\n\n" +
                "Ahora envía el NUEVO mensaje de texto:\n\n" +
                "O envía *mantener*"
            );
            
        } else {
            await message.reply("❌ Opción inválida.");
        }
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_credenciales') {
        await manejarCredenciales(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_tipo_contenido') {
        await manejarTipoContenido(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_archivo' || estadoUsuario.estado === 'esperando_archivo_editar') {
        await manejarArchivo(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_mensaje' || estadoUsuario.estado === 'esperando_mensaje_editar') {
        await manejarMensajeTexto(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_cantidad_horas') {
        await manejarCantidadHoras(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_hora_unica') {
        await manejarHoraUnica(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_horas') {
        await manejarHorasDos(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_tres_horas') {
        await manejarTresHoras(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionar_frecuencia') {
        await manejarFrecuencia(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_fecha_inicio') {
        await manejarFechaInicio(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_fecha_fin') {
        await manejarFechaFin(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'esperando_confirmacion_grupos') {
        await manejarConfirmacionGrupos(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'seleccionando_grupos') {
        await manejarSeleccionGrupos(message, userId, estadoUsuario);
        return;
    }
    
    if (estadoUsuario.estado === 'mostrando_vista_previa') {
        if (texto === '1' || texto === 'sí' || texto === 'si') {
            await guardarProgramacion(message, userId, estadoUsuario);
        } else if (texto === '2' || texto === 'no') {
            userStates.delete(userId);
            await message.reply("❌ Programación cancelada.");
        } else {
            await message.reply("Por favor selecciona:\n1 - Sí\n2 - No");
        }
        return;
    }
    
    userStates.delete(userId);
    await enviarMenu(message);
}

async function enviarMenu(message) {
    const saludo = obtenerSaludo();
    
    const menu = 
        `*Hola ${saludo}!* 🌞\n` +
        `Mi nombre es *Jarabito* 🤖\n` +
        `¿En qué te puedo ayudar?\n\n` +
        `1️⃣ - *Acadia* 📊\n` +
        `2️⃣ - *Guardian* 🛡️\n` +
        `3️⃣ - *Checklist de seguridad* ✅\n` +
        `4️⃣ - *Semáforo de territorio* 🚦\n` +
        `5️⃣ - *Reclamos de calidad* 📋\n` +
        `6️⃣ - *Energía* ⚡\n` +
        `7️⃣ - *CIP Jarabe terminado* 🧪\n` +
        `8️⃣ - *CIP Jarabe simple*\n` +
        `9️⃣ - *Programar mensajes* ⏰\n` +
        `🔟 - *SKAP* 📋\n\n` +
        `*Envía el número de la opción (1-10)*`;
    
    await message.reply(menu);
}

async function manejarOpcionMenu(message, opcion) {
    const links = {
        1: "https://ab-inbev.acadia.sysalli.com/documents?filter=lang-eql:es-mx&page=1&pagesize=50",
        6: "https://energia2-7e868.web.app/",
        8: "https://cip-jarabesimple.web.app/"
    };
    
    if (opcion === 1) {
        await message.reply(`🔗 *Acadia:* ${links[opcion]}`);
    } else if (opcion === 2) {
        await manejarGuardian(message, message.from);
    } else if (opcion === 3) {
        await obtenerChecklistSeguridad(message, message.from);
    } else if (opcion === 4) {
        await message.reply("⏳ Consultando semáforo...");
        const resultado = await obtenerSemaforoTerritorio();
        await message.reply(resultado);
    } else if (opcion === 5) {
        await manejarReclamosCalidad(message, message.from);
    } else if (opcion === 6) {
        await message.reply(`🔗 *Energía:* ${links[opcion]}`);
    } else if (opcion === 7) {
        await manejarCIPJarabeTerminado(message, message.from);
    } else if (opcion === 8) {
        await message.reply(`🔗 *CIP Jarabe simple:* ${links[opcion]}`);
    } else if (opcion === 9) {
        await iniciarProgramacion(message);
    } else if (opcion === 10) {
        const userId = message.from;
        userStates.set(userId, { estado: 'seleccionar_tipo_skap', datos: {} });
        
        await message.reply(
            "📋 *SISTEMA SKAP*\n\n" +
            "1️⃣ - *ILC*\n" +
            "2️⃣ - *OUTS*\n\n" +
            "Envía el número de la opción (1-2)"
        );
    }
}

async function verificarMensajesProgramados() {
    const horaActual = moment().tz(TIMEZONE).format('HH:mm');
    const fechaActual = moment().tz(TIMEZONE).format('YYYY-MM-DD');
    
    for (let i = 0; i < scheduledMessages.length; i++) {
        const programacion = scheduledMessages[i];
        
        const fechaActualObj = moment().tz(TIMEZONE).startOf('day');
        const fechaInicio = moment(programacion.fechaInicio).tz(TIMEZONE).startOf('day');
        const fechaFin = programacion.fechaFin ? moment(programacion.fechaFin).tz(TIMEZONE).startOf('day') : null;
        
        if (programacion.frecuencia === 'una_vez' && fechaActualObj > fechaInicio) {
            continue;
        }
        
        if (fechaActualObj < fechaInicio) {
            continue;
        }
        
        if (fechaFin && fechaActualObj > fechaFin) {
            continue;
        }
        
        const horaYaEnviadaHoy = programacion.enviosHoy && 
                                  programacion.enviosHoy.includes(`${fechaActual}-${horaActual}`);
        
        if (horaYaEnviadaHoy) {
            continue;
        }
        
        for (const horaProgramada of programacion.horas) {
            if (horaProgramada === horaActual) {
                await enviarMensajeProgramado(programacion);
                
                if (!programacion.enviosHoy) {
                    scheduledMessages[i].enviosHoy = [];
                }
                scheduledMessages[i].enviosHoy.push(`${fechaActual}-${horaActual}`);
                
                if (scheduledMessages[i].ultimoEnvio) {
                    const ultimoEnvioFecha = moment(scheduledMessages[i].ultimoEnvio).tz(TIMEZONE).format('YYYY-MM-DD');
                    if (ultimoEnvioFecha !== fechaActual) {
                        scheduledMessages[i].enviosHoy = [`${fechaActual}-${horaActual}`];
                    }
                }
                
                scheduledMessages[i].ultimoEnvio = new Date();
                
                try {
                    const archivoProgramaciones = path.join(__dirname, 'programaciones.json');
                    fs.writeFileSync(archivoProgramaciones, JSON.stringify(scheduledMessages, null, 2));
                } catch (error) {}
                
                break;
            }
        }
    }
}

async function enviarMensajeProgramado(programacion) {
    try {
        let chats = [];
        
        if (programacion.grupos === 'todos') {
            const todosChats = await client.getChats();
            chats = todosChats.filter(chat => chat.isGroup);
        } else {
            for (const grupoId of programacion.grupos) {
                try {
                    const chat = await client.getChatById(grupoId);
                    if (chat) chats.push(chat);
                } catch (error) {}
            }
        }
        
        let media = null;
        if (programacion.archivoInfo && fs.existsSync(programacion.archivoInfo.ruta)) {
            media = MessageMedia.fromFilePath(programacion.archivoInfo.ruta);
        } else if (programacion.imagenPath && fs.existsSync(programacion.imagenPath)) {
            media = MessageMedia.fromFilePath(programacion.imagenPath);
        }
        
        for (const chat of chats) {
            try {
                if (media) {
                    if (programacion.mensaje && programacion.mensaje !== "") {
                        await chat.sendMessage(media, { caption: programacion.mensaje });
                    } else {
                        await chat.sendMessage(media);
                    }
                } else if (programacion.mensaje && programacion.mensaje !== "") {
                    await chat.sendMessage(programacion.mensaje);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {}
        }
        
    } catch (error) {}
}

client.on('qr', qr => {
    console.clear();
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                    ESCANEA EL QR                         ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log('║ 📱 Instrucciones:                                        ║');
    console.log('║    1. Abre WhatsApp en tu teléfono                       ║');
    console.log('║    2. Menú → WhatsApp Web                                ║');
    console.log('║    3. Escanea el código QR                               ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    qrcode.generate(qr, { small: true });
    
    console.log(`\n🔗 Enlace QR: https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qr)}`);
});

client.on('authenticated', () => {
    console.log('✅ Autenticación exitosa!');
});

client.on('auth_failure', msg => {
    console.error('❌ Error de autenticación:', msg);
});

client.on('ready', async () => {
    console.clear();
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                 ✅ BOT CONECTADO EXITOSAMENTE            ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ 🤖 Nombre: ${client.info.pushname || 'Jarabito'}                       ║`);
    console.log(`║ 📞 Número: ${client.info.wid.user}                            ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
});

function cargarProgramacionesGuardadas() {
    try {
        const archivoProgramaciones = path.join(__dirname, 'programaciones.json');
        if (fs.existsSync(archivoProgramaciones)) {
            const contenido = fs.readFileSync(archivoProgramaciones, 'utf8');
            const programaciones = JSON.parse(contenido);
            
            scheduledMessages.length = 0;
            scheduledMessages.push(...programaciones);
            console.log(`📂 Cargadas ${programaciones.length} programaciones`);
        }
    } catch (error) {}
}

client.on('group_join', async (notification) => {
    try {
        const chat = await client.getChatById(notification.chatId);
        if (chat.isGroup) {
            await enviarBienvenidaGrupo(chat);
        }
    } catch (error) {}
});

client.on('message', async message => {
    try {
        const texto = message.body.trim();
        const userId = message.from;
        
        if (userStates.has(userId)) {
            await manejarEstadoUsuario(message, userId);
            return;
        }
        
        if (texto.toLowerCase() === '/menu' || texto.toLowerCase() === '/menú') {
            await enviarMenu(message);
            return;
        }
        
        if (/^[1-9]$|^10$/.test(texto)) {
            await manejarOpcionMenu(message, parseInt(texto));
            return;
        }
        
        if (message.from.endsWith('@g.us')) {
            if (!texto.startsWith('/') && !/^[1-9]$|^10$/.test(texto)) {
                return;
            }
        }
        
    } catch (error) {}
});

client.on('disconnected', reason => {
    console.log('❌ Desconectado:', reason);
    console.log('🔄 Reconectando en 5 segundos...');
    setTimeout(() => client.initialize(), 5000);
});

async function iniciarBot() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║                INICIANDO BOT DE WHATSAPP                ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║ 🖥️  Sistema: ${process.platform}                                ║`);
    console.log(`║ 📦 Node.js: ${process.version}                             ║`);
    console.log(`║ 📍 Chrome: ${chromePath}                             ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    
    crearCarpetas();
    cargarProgramacionesGuardadas();
    setInterval(verificarMensajesProgramados, 60000);
    setInterval(limpiarArchivosTemporales, 3600000);
    
    await client.initialize();
}

process.on('SIGINT', async () => {
    console.log('\n👋 Cerrando bot...');
    
    try {
        const archivoProgramaciones = path.join(__dirname, 'programaciones.json');
        fs.writeFileSync(archivoProgramaciones, JSON.stringify(scheduledMessages, null, 2));
    } catch (error) {}
    
    await client.destroy();
    process.exit(0);
});

iniciarBot().catch(error => {
    console.error('❌ ERROR CRÍTICO:', error.message);
});
