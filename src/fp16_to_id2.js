
export function generate_random_vectors_fp16(dimensions, num_vectors){

    let vectors = [];
    for (let i = 0; i < num_vectors; i++){
        let vector = [];
        for (let j = 0; j < dimensions; j++){
            vector.push(Math.random());
        }
        vectors.push(vector);
    }
    return vectors;
    
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

let this_vectors = generate_random_vectors_fp16(768, 1);
console.log(this_vectors[0].length)
let byte_array = [];
for (let i = 0; i < this_vectors[0].length; i++){
    let this_bytes = floatTo16BitBytes(this_vectors[0][i]);
    byte_array.push(this_bytes[0]);
    byte_array.push(this_bytes[1]);
}
//convert byte_array to base64
let base64 = Buffer.from(byte_array).toString('base64');
console.log(base64)
console.log(base64.length)