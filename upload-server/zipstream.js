/* Minimal streaming .zip writer (no dependencies). Files are added one at a time and written straight
 * to the response, so even a 1 GB design never has to sit in memory as a whole.
 * Text files are compressed (deflate); images, video and fonts are stored as they are (already compressed). */
'use strict';
const zlib = require('zlib');

const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf, crc = 0) { crc = ~crc >>> 0; for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8); return ~crc >>> 0; }
const COMPRESS = /\.(html?|css|js|mjs|json|map|txt|md|xml|csv|svg|webmanifest)$/i;

function dosTime(d) {
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

class ZipWriter {
  constructor(out) { this.out = out; this.offset = 0; this.entries = []; this.when = dosTime(new Date()); }
  write(buf) {
    this.offset += buf.length;
    return new Promise((resolve, reject) => {
      if (this.out.destroyed) return reject(new Error('The download was cancelled.'));
      this.out.write(buf) ? resolve() : this.out.once('drain', resolve);
    });
  }
  async add(name, data) {
    const nameBuf = Buffer.from(name, 'utf8');
    const deflate = COMPRESS.test(name) && data.length > 64;
    const body = deflate ? zlib.deflateRawSync(data, { level: 6 }) : data;
    const crc = crc32(data), method = deflate ? 8 : 0;
    if (this.offset + body.length > 0xFFFFFFFF - 1e6) throw new Error('This design is too big to download as one .zip (over 4 GB).');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(this.when.time, 10); local.writeUInt16LE(this.when.date, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26); local.writeUInt16LE(0, 28);
    const at = this.offset;
    await this.write(Buffer.concat([local, nameBuf]));
    await this.write(body);
    this.entries.push({ nameBuf, crc, method, csize: body.length, size: data.length, at });
  }
  async finish() {
    const start = this.offset; const parts = [];
    for (const e of this.entries) {
      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(e.method, 10);
      c.writeUInt16LE(this.when.time, 12); c.writeUInt16LE(this.when.date, 14); c.writeUInt32LE(e.crc, 16); c.writeUInt32LE(e.csize, 20); c.writeUInt32LE(e.size, 24);
      c.writeUInt16LE(e.nameBuf.length, 28); c.writeUInt32LE(0, 38); c.writeUInt32LE(e.at, 42);
      parts.push(c, e.nameBuf);
    }
    const dir = Buffer.concat(parts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(this.entries.length, 8); end.writeUInt16LE(this.entries.length, 10);
    end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(start, 16);
    await this.write(dir); await this.write(end);
  }
}
module.exports = { ZipWriter, crc32 };
