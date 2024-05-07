
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

const fp16Array = new Uint16Array(768);
for (let i = 0; i < fp16Array.length; i++) {
    fp16Array[i] = Math.floor(Math.random() * 65535);
}

// Encode the buffer as a base64 or hexadecimal string for use as an ID in a database
const encodedString = Buffer.from(fp16Array).toString('base64'); // or use 'hex' for hexadecimal encoding

console.log(encodedString.length);