import { WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

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


export default async function main(collection_path){
    let chunkSize = 8;
    let dimensions = 768;
    let num_vectors = 4096;
    let vectors_chunks = generate_random_vector_shards(chunkSize, dimensions, num_vectors);
    let config = fs.readFileSync('config.json', 'utf8');
    let config_json = JSON.parse(config);
    let ws_list = [];
    for (let i = 0; i < chunkSize; i++){
        let chunk = vectors_chunks[i];
        let port = config_json[i].port;
        let ipAddress = config_json[i].ipAddress;
        let swarmName = config_json[i].swarmName;
        let index = config_json[i].index;
        let dbAddress = config_json[i].orbitdbAddress;
        let id = index;
        ws_list[i] = new WebSocket('ws://localhost:'+port);
        ws_list[i].on('open', () => {
            for (let i = 0; i < Object.keys(chunk).length; i++){
                let id = Object.keys(chunk)[i];
                let cid = chunk[id];
                ws.send(
                    JSON.stringify({
                       'insert':{ _id: id, content: cid }
                    })
                )
            }
        });
        ws.on('message', (message) => {
            console.log('Received message:', message.toString());
        });
    }
}

main(collection_path);