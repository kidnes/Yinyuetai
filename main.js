var http = require('http'),
    exec = require('child_process').exec;

//================
//可配置参数开始
//================
var downType = 2;   //1为下载vid列表，2为下载分析网页
// var downType = 1;
var mainPage = "http://v.yinyuetai.com/playlist/2121007";
var vidList = [2335203,];

var defi = 3; //默认清晰度，1：流畅，2：高清，3：超清
var savePath = './mv/';
//================
//可配置参数结束
//================

var mvList = {},
    downList = [],
    geturl = "http://www.yinyuetai.com/api/info/get-video-urls?json=true&videoId=";


var defiMap = {1:'hcVideoUrl', 2:'hdVideoUrl', 3:'heVideoUrl'};


var down_total = 100,
    count = 0,
    downingCount = 0,
    maxDowning = 3;

function init() {
    showlogo();

    initArgu();

    if (downType === 1) {
        console.log("下载vid列表：\n");
        for (var i = 0; i < vidList.length; i++) {
            mvList[vidList[i]] = {
                'url': 'http://v.yinyuetai.com/video/' + vidList[i],
                'vid': vidList[i]
            };
        }
        getMVInfo();
    } else if (downType === 2) {
        console.log("分析页面："+mainPage);
        requestPage(mainPage, analisy);
    }
}

function initArgu() {
    var argv = process.argv.splice(2);
    if (!argv || argv.length <= 0) return;

    if (/\.yinyuetai\.com/i.test(argv[0])) {
        mainPage = argv[0];
        downType = 2;
    } else if (/\d+/.test(argv[0])) {
        downType = 1;
        for (var i = 0; i < argv.length; i++) {
            if (/\d+/.test(argv[i])) vidList.push(argv[i]);
            else break;
        }
    }
    

    var cmd = argv.join(' ');

    if (/--\bmax\b/i.test(cmd) || /-\bm\b/i.test(cmd)) {  //解析-t 或 --trunk参数
        var r1 = /--\bmax\b\s+(\d+)/i.exec(cmd),
            r2 = /-\bm\b\s+(\d+)/i.exec(cmd);
        maxDowning = (r1&&r1[1]) || (r2&&r2[1]) || maxDowning;
    }

    if (/--\bdefi\b/i.test(cmd) || /-\bd\b/i.test(cmd)) {  //解析-t 或 --trunk参数
        var r1 = /--\bdefi\b\s+(\d+)/i.exec(cmd),
            r2 = /-\bd\b\s+(\d+)/i.exec(cmd);
        defi = (r1&&r1[1]) || (r2&&r2[1]) || defi;
    }
}

function analisy(html) {
    mvList = {};
    downList = [];
    count = 0;

    var reg = /\b(\d{5,7})\b/img;
    // var reg = /v.yinyuetai.com\/video\/(\d+)/img;
    var result;
    while ((result = reg.exec(html)) != null) {
        mvList[result[1]] = {
            'url': 'http://v.yinyuetai.com/video/' + result[1],
            'vid': result[1]
        };
    }

    getMVInfo();
}

function getMVInfo() {
    console.log(mvList);
    // return;

    var total = urlCount = titleCount = 0;

    var title_reg = /<title>(.+[\n\r]*.+)<\/title>/m,
        vid_reg = /player.yinyuetai.com\/video\/swf\/(\d+)/m;
    for (var item in mvList) {
        total++;
        requestPage(mvList[item].url, function(data, res) {
            var title_m = data.split(/<\/title>/)[0].split(/<title>/)[1];
            var title = title_m.replace(/[\r\t\n]+/mg, '').replace("【MV】", '')
                .replace("-高清MV在线播放-音悦台-口袋·FAN-看好音乐", '')
                .replace("-高清MV在线播放-音悦Tai-口袋·FAN-看好音乐", '')
                .split('-').reverse().join(' -- '),
                vid = vid = res.req.path.match(/\d+/)[0];
            mvList[vid]['title'] = title;

            if (mvList[vid]['downURL']) pushMV(mvList[vid]);
        });

        requestPage(geturl + item, function(data, res) {
            var vid = res.req.path.match(/\d+/)[0];
            try {
                var json = JSON.parse(data);
            } catch(e) {
                console.log('获取失败：'+vid+'\n');
                console.log(data);
                return;
            }
            mvList[vid]['downURL'] = json[defiMap[defi]];

            if (mvList[vid]['title']) pushMV(mvList[vid]);
        });
    }
}

function pushMV(item) {
    if (++count >= down_total) return;
    var cmd = 'wget "' + item['downURL'] + '" -c -O "' + savePath + item['title'] + '.mp4"';
    downList.push({cmd: cmd, title: item['title'], url: item['downURL']});
    if (downingCount < maxDowning) downMV()
}

function downMV() {
    if (downingCount >= maxDowning || downList.length <= 0) return;

    var obj = downList.shift();
    downingCount++;

    console.log('正在下载：'+obj.title);
    exec(obj.cmd, function(error, stdout, stderr) {
        if (error !== null) {
            console.log('下载文件失败：' + error);
        }
        console.log(stdout);
        downingCount--;
        downMV();
    });
}

function requestPage(url, callback) {
    http.get(url, function(res) {
        res.setEncoding('utf8');
        var data = '';

        res.on('data', function(chunk) {
            data += chunk.toString();
        });
        res.on('end', function() {
            if (typeof callback == 'function') callback(data, res);
        });
    }).on('error', function(e) {
        console.log("Got error: " + e.message);
    });
}

function showlogo() {
    var logo =  '示例：yinyue http://so.yinyuetai.com/mv?page=2&keyword=%E5%B0%91%E5%A5%B3%E6%97%B6%E4%BB%A3\n' +
                '       yinyue 166973 89354'

    logo += '参数：\n' +
            '        -m [--max]         同时下载的最大线程数，默认为3个\n' +
            '        -d [--defi]        清晰度，1：流畅，2：高清，3：超清，默认为3\n';


    console.log(logo);
}

init();

// exports.init = init;