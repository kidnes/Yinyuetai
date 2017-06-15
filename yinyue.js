#!/usr/bin/env node

/**
 * @file 下载视频文件
 *
 * @author kidnes
 */

let fs = require('fs');
let http = require('http');
let spawn = require('child_process').spawn;


// ================
// 可配置参数开始
// ================


let downType = 1; // 1为下载vid列表，2为下载分析网页
// let downType = 1;
let mainPage = 'http://v.yinyuetai.com/playlist/2121007';
let vidList = [2335203];

let defi = 3; // 默认清晰度，1：流畅，2：高清，3：超清
let savePath = './mv/';
// ================
// 可配置参数结束
// ================

let mvList = {};
let downList = [];
let geturl = 'http://www.yinyuetai.com/api/info/get-video-urls?json=true&videoId=';


let defiMap = {1: 'hcVideoUrl', 2: 'hdVideoUrl', 3: 'heVideoUrl'};


let downTotal = 100;
let count = 0;
let downingCount = 0;
let maxDowning = 3;

function init() {
    if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath);
    }
    showlogo();

    initArgu();

    if (downType === 1) {
        console.log('下载vid列表：\n');
        for (let i = 0; i < vidList.length; i++) {
            mvList[vidList[i]] = {
                url: 'http://v.yinyuetai.com/video/' + vidList[i],
                vid: vidList[i]
            };
        }
        getMVInfo();
    }
    else if (downType === 2) {
        console.log('分析页面：' + mainPage);
        requestPage(mainPage, analisy);
    }
}

function initArgu() {
    let argv = process.argv.splice(2);
    if (!argv || argv.length <= 0) {
        return;
    }

    if (/\.yinyuetai\.com/i.test(argv[0])) {
        mainPage = argv[0];
        downType = 2;
    }
    else if (/\d+/.test(argv[0])) {
        downType = 1;
        for (let i = 0; i < argv.length; i++) {
            if (/\d+/.test(argv[i])) {
                vidList.push(argv[i]);
            }
            else {
                break;
            }
        }
    }

    let cmd = argv.join(' ');

    if (/--\bmax\b/i.test(cmd) || /-\bm\b/i.test(cmd)) {  // 解析-t 或 --trunk参数
        let r1 = /--\bmax\b\s+(\d+)/i.exec(cmd);
        let r2 = /-\bm\b\s+(\d+)/i.exec(cmd);
        maxDowning = (r1 && r1[1]) || (r2 && r2[1]) || maxDowning;
    }

    if (/--\bdefi\b/i.test(cmd) || /-\bd\b/i.test(cmd)) {  // 解析-t 或 --trunk参数
        let r1 = /--\bdefi\b\s+(\d+)/i.exec(cmd);
        let r2 = /-\bd\b\s+(\d+)/i.exec(cmd);
        defi = (r1 && r1[1]) || (r2 && r2[1]) || defi;
    }
}

function analisy(html) {
    mvList = {};
    downList = [];
    count = 0;

    let reg = /\b(\d{5,7})\b/img;
    // let reg = /v.yinyuetai.com\/video\/(\d+)/img;
    let result;
    while ((result = reg.exec(html)) != null) {
        mvList[result[1]] = {
            url: 'http://v.yinyuetai.com/video/' + result[1],
            vid: result[1]
        };
    }

    getMVInfo();
}

function parseTitle(data, res) {
    let originalTitle = data.split(/<\/title>/)[0].split(/<title>/)[1];
    let title = originalTitle.replace(/[\r\t\n]+/mg, '').replace('【MV】', '')
        .replace('-高清MV在线播放-音悦台-口袋·FAN-看好音乐', '')
        .replace('-高清MV在线播放-音悦Tai-口袋·FAN-看好音乐', '')
        .split('-').reverse().join(' -- ');

    let vid = res.req.path.match(/\d+/)[0];
    mvList[vid].title = title;

    if (mvList[vid].downURL) {
        pushMV(mvList[vid]);
    }
}

function parseDownUrl(data, res) {
    let vid = res.req.path.match(/\d+/)[0];
    let json;
    try {
        json = JSON.parse(data);
    }
    catch (e) {
        console.log('获取失败：' + vid + '\n');
        console.log(data);
        return;
    }
    mvList[vid].downURL = json[defiMap[defi]];

    if (mvList[vid].title) {
        pushMV(mvList[vid]);
    }
}

function getMVInfo() {
    console.log(mvList);
    // return;

    let total = 0;
    // let titleReg = /<title>(.+[\n\r]*.+)<\/title>/m;
    // let vidReg = /player.yinyuetai.com\/video\/swf\/(\d+)/m;

    
    for (let item of Object.keys(mvList)) {
        total++;
        requestPage(mvList[item].url, parseTitle);

        requestPage(geturl + item, parseDownUrl);
    }
}

function pushMV(item) {
    if (++count >= downTotal) {
        return;
    }

    // let cmd = 'wget "' + item.downURL + '" -c -O "' + savePath + item.title + '.mp4"';
    let cmd = ['wget', item.downURL, '-c', '-O', savePath + item.title + '.mp4"'];
    downList.push({cmd: cmd, title: item.title, url: item.downURL});
    if (downingCount < maxDowning) {
        downMV();
    }
}

function downMV() {
    if (downingCount >= maxDowning || downList.length <= 0) {
        return;
    }

    let obj = downList.shift();
    downingCount++;

    console.log('正在下载：' + obj.title);
    // console.log('命令：' + obj.cmd.join(' '));
    let cmd = obj.cmd;
    const wget = spawn(cmd[0], cmd.slice(1));

    wget.stdout.on('data', data => {
        console.log(`stdout: ${data}`);
    });

    wget.stderr.on('data', data => {
        // console.log(`stderr: ${data}`);
    });

    wget.on('close', code => {
        if (code) {
            console.log(`下载文件失败：${code}`);
        }
        else {
            downingCount--;
            downMV();
        }
    });
}

function requestPage(url, callback) {
    http.get(url, function (res) {
        res.setEncoding('utf8');
        let data = '';

        res.on('data', function (chunk) {
            data += chunk.toString();
        });
        res.on('end', function () {
            if (typeof callback === 'function') {
                callback(data, res);
            }
        });
    }).on('error', function (e) {
        console.log('Got error: ' + e.message);
    });
}

function showlogo() {
    let logo = '用法：yinyue [url]'
        +'     yinyue [视频id]';

    logo += '示例：yinyue http://so.yinyuetai.com/mv?page=2&keyword=%E5%B0%91%E5%A5%B3%E6%97%B6%E4%BB%A3\n'
        + '      yinyue 166973 89354';

    logo += '\n参数：\n'
        + '      -m [--max]         同时下载的最大线程数，默认为3个\n'
        + '      -d [--defi]        清晰度，1：流畅，2：高清，3：超清，默认为3\n';

    console.log(logo);
}

init();

// exports.init = init;
