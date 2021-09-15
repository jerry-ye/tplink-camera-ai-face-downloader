const Net = require('net');
const { Buffer } = require('buffer');
const fs = require('fs');
const axios = require('axios');
const request = require('request');

var argv = require('minimist')(process.argv.slice(2));

if (argv.help) {
    return console.log(
        `Usage:
    node index.js --option=<argument>

    --start_time Start date time
    --end_time Start date time
    --minutes or fetch from minutes to now
    --host TP-Link Camera IP
    --http_port TP-Link Camera IP HTTP PORT default is 80/8080
    --rtsp_port TP-Link Camera IP RTSP PORT default is 554
    --upload_url Upload downloaded pictures to this server`
    );
}

const HOST = argv.host ? argv.host : '192.168.8.106';
const HTTP_PORT = argv.http_port ? argv.http_port : '8080';
const RTSP_PORT = argv.rtsp_port ? argv.rtsp_port : '554';
const WEB_URL = `http://${HOST}:${HTTP_PORT}`
const UPLOAD_URL = argv.upload_url;
const date_period = {
    start_time: null,
    end_time: null,
    start_date: null,
    end_date: null,
};
if (argv.start_time && argv.end_time) {
    date_period.start_date = new Date(argv.start_time);
    date_period.end_date = new Date(argv.end_time);
    date_period.start_time = date_period.start_date.getTime() / 1000;
    date_period.end_time = date_period.end_date.getTime() / 1000;
} else {
    const interval_mins = argv.minutes && argv.minutes > 1 ? argv.minutes : 5;
    date_period.start_date = new Date();
    date_period.start_date.setMinutes(date_period.start_date.getMinutes() - interval_mins);

    date_period.end_date = new Date();
    date_period.start_time = parseInt(date_period.start_date.getTime() / 1000);
    date_period.end_time = parseInt(date_period.end_date.getTime() / 1000);
}

if (!fs.existsSync('files')) {
    fs.mkdirSync('files');
}

if (argv.debug) {
    console.log(argv)
    process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
    console.log(date_period, WEB_URL, RTSP_PORT, UPLOAD_URL);
}

const getPics = async (start_time, end_time) => {
    const loginRes = await axios.post(WEB_URL, { "method": "do", "login": { "username": "admin", "password": "tyWcQbhc9TefbwK", "encrypt_type": "1" } });
    const body = {
        "media": {
            "get_media_list":
            {
                "channel": [0],
                "user_id": 11,
                "start_time": start_time + "",
                "end_time": end_time + "",
                "event_type": [51],
                "media_type": [2],
                "start_index": 0,
                "max_num": 5000
            }
        }, "method": "do"
    };
    try {
        console.log(`${WEB_URL}/stok=${loginRes.data.stok}/ds`, JSON.stringify(body));
        const res = await axios.post(`${WEB_URL}/stok=${loginRes.data.stok}/ds`,
            body,
            {
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
        console.log('total_num', res.data.media.total_num);
        const files = [];
        res.data.media.file_id.forEach((file_id, index) => {
            files.push({
                file_id: file_id,
                start_time: res.data.media.start_time[index],
                end_time: res.data.media.end_time[index],
                event_type: res.data.media.event_type[index],
                media_type: res.data.media.media_type[index],
                channel: res.data.media.channel[index],
            });
        });
        return files;
    } catch (e) {
        console.log(e);
    }
    //console.log(files);

}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const uploadToServer = (buffer, filename) => {
    if (!UPLOAD_URL) {//check if has upload url, if not skip for upload
        return;
    }
    var options = {
        'method': 'POST',
        'url': UPLOAD_URL,
        'headers': {},
        formData: {
            'image': {
                'value': buffer,
                'options': {
                    'filename': filename,
                    'contentType': null
                }
            }
        }
    };
    request(options, function (error, response) {
        console.log(filename, ' uploaded');
    });
    return;
}

const startDownload = async () => {
    const files = await getPics(date_period.start_time, date_period.end_time);
    //return console.log(files.length); 
    if (files.length > 0) {
        const received_data = [];
        const options = {
            host: HOST,
            port: RTSP_PORT
        };
        let current_args = null;
        //Create socket
        const socket = Net.connect(options);
        socket.setNoDelay(true);
        socket.on("error", (e) => {
            console.log("error", e);
        });
        socket.on("connect", () => {
            console.log('connected');
        });
        socket.on("data", async (buffer) => {
            console.log('receive', buffer);
            received_data.push(buffer);
            //check the finished
            if (buffer.toString().indexOf('finished') > -1) {
                console.log('finished');
                parseBufferToFile(received_data, current_args.start_time + '_' + current_args.file_id + '.jpg');
                received_data.splice(0, received_data.length);
                if (files.length > 0) {
                    // await sleep(2000);
                    downloadFile(files.pop());
                } else {
                    socket.destroy();
                    console.log('socket.destroy');
                }
                //socket.destroy();
            }
        });
        function parseBufferToFile(buffers, file) {
            var bin = Buffer.concat(buffers).toString('hex');
            const first_magic_index = bin.indexOf('ffd8ff') - 32;
            const begin_number = bin.substr(first_magic_index, 32);
            console.log('begin_number', begin_number);
            let jpg = bin.slice(first_magic_index);
            const new_jpg_arr = [];
            while (jpg.substr(0, 2) == '24') { // magic number
                $hexlength = jpg.substr(4, 4); //rtsp interleaved frame, data length part
                $bin_length = parseInt($hexlength, 16) * 2 + 8;//rtsp interleaved frame, 24 00 05 9c is not count in the data lenght
                new_jpg_arr.push(jpg.substr(32, $bin_length - 32));
                jpg = jpg.substr($bin_length);
            }
            uploadToServer(Buffer.from(new_jpg_arr.join(''), 'hex'), file);
            fs.writeFileSync(`files/${file}`, Buffer.from(new_jpg_arr.join(''), 'hex'));
        }
        seq = 1;
        function downloadFile(args) {
            current_args = args;
            const file = current_args.start_time + '_' + current_args.file_id + '.jpg';
            if (fs.existsSync(`files/${file}`)) {
                if (files.length > 0) {
                    downloadFile(files.pop());
                } else {
                    socket.destroy();
                    console.log('socket.destroy');
                }
                return;
            }
            const body = JSON.stringify(
                {
                    "type": "request", "seq": "1", "params":
                    {
                        "method": "get", "download":
                        {
                            "client_id": 51,
                            "channels": [args.channel],
                            "start_time": args.start_time,
                            "end_time": args.end_time,
                            "file_id": args.file_id,
                            "event_type": [args.event_type + ""],
                            "media_type": args.media_type
                        }
                    }
                });
            const request_arr = [
                `MULTITRANS rtsp://${HOST}:${RTSP_PORT}/multitrans RTSP/1.0`,
                `Host: ${HOST}`,
                'CSeq: ' + seq,
                'Content-Type: application/json',
                'User-Agent: nodejs',
                'Content-Length: ' + body.length,
                '',
                body
            ]
            const str = request_arr.join("\r\n");
            socket.write(str, (res) => {
                // console.log(str);
            });
            seq++;
        }
        downloadFile(files.pop());
    }
}
startDownload();

/**
MULTITRANS rtsp://192.168.8.106:554/multitrans RTSP/1.0
Host: 192.168.8.106
CSeq: 1
User-Agent: medooze-rtsp-client
Content-Type: application/json
Content-Length: 211
{"type":"request","seq":"1","params":{"method":"get","download":{"client_id":28,"channels":[0],"start_time":"1629186998","end_time":"1629186998","file_id":"0001000020235700","event_type":["51"],"media_type":2}}}

**/
