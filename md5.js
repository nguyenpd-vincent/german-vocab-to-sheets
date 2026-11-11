// MD5 (RFC 1321) cho chuỗi UTF-8 → 32 ký tự hex.
// Faztaa đặt tên file phát âm theo MD5 của từ: https://data.faztaa.com/audios/1103/<md5(từ)>.mp3
// Trình duyệt không có sẵn MD5 (crypto.subtle không hỗ trợ), nên viết ngắn ở đây. Không dùng cho mục đích bảo mật.

function md5(text) {
  const bytes = new TextEncoder().encode(String(text));

  // Thêm bit 1, các bit 0 và độ dài (bit, little-endian 64 bit) cho đủ bội số của 64 byte.
  const totalLen = (((bytes.length + 8) >>> 6) + 1) * 64;
  const buf = new Uint8Array(totalLen);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  const bitLen = bytes.length * 8;
  const view = new DataView(buf.buffer);
  view.setUint32(totalLen - 8, bitLen >>> 0, true);
  view.setUint32(totalLen - 4, Math.floor(bitLen / 0x100000000), true);

  // Hằng số K[i] = floor(|sin(i + 1)| · 2^32) và số bit xoay mỗi vòng.
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const rotl = (x, c) => (x << c) | (x >>> (32 - c));

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < totalLen; off += 64) {
    const M = Array.from({ length: 16 }, (_, j) => view.getUint32(off + j * 4, true));
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      const shift = S[(i >>> 4) * 4 + (i % 4)];
      const tmp = D;
      D = C; C = B;
      B = (B + rotl((A + F + K[i] + M[g]) | 0, shift)) | 0;
      A = tmp;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }

  // Kết quả: 4 từ 32 bit, mỗi từ in theo thứ tự byte little-endian.
  const hex = n => Array.from({ length: 4 }, (_, i) => ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')).join('');
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

if (typeof module !== 'undefined') module.exports = { md5 };
