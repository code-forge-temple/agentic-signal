/************************************************************************
 *    Copyright (C) 2026 Code Forge Temple                              *
 *    This file is part of agentic-signal project                       *
 *    See the LICENSE file in the project root for license details.     *
 ************************************************************************/

// The first 32 bits of the fractional parts of the cube roots of the first 64 primes (FIPS 180-4).
const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (word: number, bits: number) => (word >>> bits) | (word << (32 - bits));

/**
 * SHA-256 in plain code. Browsers only offer `crypto.subtle` on secure pages (https, or localhost), so an app
 * opened from another computer over plain http (http://<jetson-ip>:8080) hashes with this instead.
 */
export function sha256 (message: Uint8Array): Uint8Array {
    // The message, a 1 bit, zeros, and its length in bits as 64 bits big-endian, filling whole 64-byte blocks.
    const padded = new Uint8Array(Math.ceil((message.length + 9) / 64) * 64);
    const view = new DataView(padded.buffer);

    padded.set(message);
    padded[message.length] = 0x80;
    view.setUint32(padded.length - 8, Math.floor(message.length / 0x20000000));
    view.setUint32(padded.length - 4, (message.length * 8) >>> 0);

    const hash = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    // A Uint32Array keeps every sum to 32 bits, as the algorithm needs.
    const schedule = new Uint32Array(64);

    for (let offset = 0; offset < padded.length; offset += 64) {
        for (let i = 0; i < 16; i++) schedule[i] = view.getUint32(offset + i * 4);

        for (let i = 16; i < 64; i++) {
            const w15 = schedule[i - 15];
            const w2 = schedule[i - 2];

            schedule[i] = schedule[i - 16] + (rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3))
                + schedule[i - 7] + (rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10));
        }

        let [a, b, c, d, e, f, g, h] = hash;

        for (let i = 0; i < 64; i++) {
            const t1 = (h + (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + schedule[i]) >>> 0;
            const t2 = ((rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;

            [h, g, f, e, d, c, b, a] = [g, f, e, (d + t1) >>> 0, c, b, a, (t1 + t2) >>> 0];
        }

        [a, b, c, d, e, f, g, h].forEach((word, i) => { hash[i] += word; });
    }

    const digest = new Uint8Array(32);
    const digestView = new DataView(digest.buffer);

    hash.forEach((word, i) => digestView.setUint32(i * 4, word));

    return digest;
}
