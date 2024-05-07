import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';
import  { Float16Array, getFloat16, setFloat16 } from '@petamoriken/float16';

const parent_dir = path.dirname("..");
const resolve_path = path.resolve(parent_dir)
const collection_path = path.join(resolve_path, 'collection.json');

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

export function generate_random_vector_key_value_pairs(dimensions, num_vectors){
    let vectors = generate_random_vectors_fp16(dimensions, num_vectors);
    let ipfs_cid_length = 52; 
    let vector_key_value_pairs = [];
    for (let i = 0; i < num_vectors; i++){
        let vector = vectors[i];
        let random_cid = Math.random().toString(36).substring(2, ipfs_cid_length);
        let key = vector; 
        let value = random_cid;
        vector_key_value_pairs.push({key: key, value: value});
    }
    return vector_key_value_pairs;
}

export function generate_random_vector_shards(shard_num, dimensions, num_vectors){
    let vector_shards = [];
    for (let i = 0; i < shard_num; i++){
        let shard = generate_random_vector_key_value_pairs(dimensions, num_vectors);
        vector_shards.push(shard);
    }
    return vector_shards;
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

function float16VectorToBase64(vector) {
    let byte_array = [];
    for (let i = 0; i < vector.length; i++){
        let this_bytes = floatTo16BitBytes(vector[i]);
        byte_array.push(this_bytes[0]);
        byte_array.push(this_bytes[1]);
    }
    //convert byte_array to base64
    let base64 = Buffer.from(byte_array).toString('base64');
    return base64;
}

export default async function main(collection_path){
    let chunkSize = 8;
    let dimensions = 768;
    let num_vectors = 4096;
    let vectors_chunks = generate_random_vector_shards(chunkSize, dimensions, num_vectors);
    let config = fs.readFileSync('config.json', 'utf8');
    let config_json = JSON.parse(config);
    let ws_list = [];
    let first_send = Date.now();
    let first_recv;
    let final_recv;
    let delta_time;
    let recieved_count = 0;
    for (let i = 1; i < chunkSize +1; i++){
        let chunk = vectors_chunks[i];  
        let port = config_json[i].port;
        let ipAddress = config_json[i].ipAddress;
        let swarmName = config_json[i].swarmName;
        let index = config_json[i].index;
        let dbAddress = config_json[i].orbitdbAddress;
        let id = index;
        ws_list[i] = new WebSocket('ws://127.0.0.1:'+port);
        ws_list[i].on('open', (this_socket) => {
            for (let j = 0; chunk != undefined && j < Object.keys(chunk).length; j++){
                let id = Object.keys(chunk)[j];
                let item = chunk[id];
                let cid = item.value;
                let key = float16VectorToBase64(item.key);
                // convert fp_16 array to array of base64 strings
                ws_list[i].send(
                    JSON.stringify({
                       'insert':{ _id: key, content: cid }
                    })
                )
            }
        });
        ws_list[i].on('message', (message) => {
            //console.log('Received message:', message.toString());
            recieved_count++;
            //console.log("Recieved count: ", recieved_count);
            if (recieved_count == (chunkSize -1) * num_vectors - 1){
                console.log("All messages recieved");
                final_recv = Date.now();
                delta_time = final_recv - first_send;
                // in seconds
                delta_time = delta_time / 1000;
                console.log("Time to final message recieved: ")
                console.log(delta_time);
                process.exit();                
            }
            if (recieved_count == 1){
                console.log("first message recieved");
                first_recv = Date.now();
                delta_time = first_recv - first_send;
                // in seconds
                delta_time = delta_time / 1000;
                console.log("Time to first message recieved: ")
                console.log(delta_time);
            }
        });
    }
    console.log("All messages sent");
    console.log("Time to send all messages: ");
    let finish_send = Date.now();
    delta_time = finish_send - first_send;
    // in seconds
    delta_time = delta_time / 1000;
    console.log(delta_time);
}

main(collection_path);