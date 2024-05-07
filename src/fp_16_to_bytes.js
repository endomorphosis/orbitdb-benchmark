function float32ToUint32Array(float32) {
    const float32Array = new Float32Array([float32]);
    const uint32Array = new Uint32Array(float32Array.buffer);
    let f = uint32Array[0];

    let sign = (f >> 31) & 0x1;
    let exp = (f >> 23) & 0xff;
    let fraction = f & 0x7fffff;

    if (exp === 255 && fraction !== 0) {
        // NaN
        return (sign << 15) | (0x1f << 10) | 0x200; // Keep the sign bit, set exponent to max, set fraction
    } else if (exp === 255 && fraction === 0 && sign === 1) {
        // -Infinity
        return 0xfc00; // -Infinity has sign bit and max exponent in fp16
    } else if (exp === 255) {
        // Infinity
        return 0x7c00; // Infinity has max exponent in fp16
    }

    exp += -127 + 15; // Rebase the exponent

    if (exp >= 31) {
        // Overflow, return Infinity
        return (sign << 15) | (0x1f << 10);
    } else if (exp <= 0) {
        // Denormalized number or zero
        if (exp < -10) {
            // Underflow, return zero
            return sign << 15;
        }
        // Denormalized number
        fraction |= 0x800000; // Add leading 1
        let t = (14 - exp) > 23 ? 23 : (14 - exp);
        let a = fraction >> t; // Shift based on exponent
        return (sign << 15) | a;
    }

    // Normalized number
    let rounded = (fraction >> 13) & 0x3;
    fraction >>= 13; // Narrow the fraction field
    if (rounded > 1) {
        fraction += 1; // Round up
        if ((fraction & 0x0400) > 0) {
            fraction = 0; // Overflow, increment exponent
            exp += 1;
        }
    }

    if (exp >= 31) {
        // Overflow, return Infinity
        return (sign << 15) | (0x1f << 10);
    }

    return (sign << 15) | (exp << 10) | fraction; // Combine fields into half-precision
}

function floatTo16BitBytes(value) {
    if (value < -1 || value > 1) {
        throw new Error('Value must be between -1 and 1.');
    }

    // Scale float from [-1, 1] to [-32768, 32767]
    const scaled = Math.floor(value * 32767);

    // Convert to 16-bit signed integer
    const buffer = new ArrayBuffer(2);
    const view = new DataView(buffer);
    view.setInt16(0, scaled, true); // true for littleEndian

    // Get bytes
    const byte1 = view.getUint8(0);
    const byte2 = view.getUint8(1);
    return [byte1, byte2];
}

// Example usage
const fp16Number = floatTo16BitBytes(0.5);

//convert to base64
const base64 = Buffer.from(fp16Number).toString('base64');


// convert bytes to base64
console.log(base64); // Output should be base64 encoding of fp16 encoding of π