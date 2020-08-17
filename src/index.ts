import * as fs from 'fs';
import path = require('path');
import {As2Ts} from './gen/As2Ts';
import {TsMaker} from './gen/TsMaker';
import {TsAnalysor} from './gen/TsAnalysor';
import parser = require('@typescript-eslint/typescript-estree');
import { As2TsOption } from './gen';

enum As2TsPhase {
    Analyse, 
    Make
}

let as2ts: As2Ts;
let tsAnalysor: TsAnalysor;
let tsMaker: TsMaker;
let optionExample: As2TsOption = {
    skipRule: {
        "dirs": [/^ui\//, /^automatic/], 
        "files": [/MsgPool\.as/, /FyMsg\.as/, /DecodeUtil\.as/, /EncodeUtil\.as/]
    }, 
    idReplacement: {
        "KW": "KeyWord"
    }, 
    literalReplacement: {
        "\"automatic/constants/KW\"": "\"automatic/constants/KeyWord\""
    }, 
    typeMapper: {
        "int": "number", 
        "Number": "number", 
        "uint": "number", 
        "Boolean": "boolean", 
        "String": "string", 
        "Object": "any"
    }, 
    importRule: {
        "fromModule": [
            {"module": "Laya", "regular": new RegExp("^laya") }
        ]
    }, 
    errorDetail: true, 
    terminateWhenError: true, 
    continueLast: false, 
    tmpRoot: 'tmp/'
};

let inputFolder: string;
let outputFolder: string;
let transOption: As2TsOption;

let lastConfPath: string;
let tmpTsDir: string;
let tmpAstDir: string;
let continueLast: boolean;
let lastCacheFile: string;
let hasMeetLast: boolean;

translateFiles('E:\\qhgame\\trunk\\project\\src\\', 'E:\\qhgame\\tsproj\\src\\', optionExample);

/**不支持内联函数、函数语句、单行声明多个成员变量 */
export function translateFiles(inputPath: string, outputPath: string, option?: As2TsOption) {
    inputFolder = inputPath;
    outputFolder = outputPath;
    transOption = option || {};

    if(!transOption.tmpRoot) {
        transOption.tmpRoot = 'tmp/';
    }
    lastConfPath = transOption.tmpRoot + '/last.txt';
    tmpTsDir = transOption.tmpRoot + '/ts/';
    tmpAstDir = transOption.tmpRoot + '/ast/';
    if (!fs.existsSync(tmpTsDir)) fs.mkdirSync(tmpTsDir, { recursive: true });
    if (!fs.existsSync(tmpAstDir)) fs.mkdirSync(tmpAstDir, { recursive: true });

    continueLast = false;
    if(transOption.continueLast && transOption.tmpRoot && fs.existsSync(lastConfPath)) {
        let lastConf = fs.readFileSync(lastConfPath, 'utf-8');
        let lastConfArr = lastConf.split('|');
        if(lastConfArr.length >= 3 && inputPath == lastConfArr[0] && outputPath == lastConfArr[1]) {
            continueLast = true;
            lastCacheFile = lastConfArr[2];
            hasMeetLast = false;
        }
    }
    if(transOption.continueLast && !continueLast) {
        console.log('[WARN]No last configuration found: %s, the option "continueLast" won\'t work.', lastConfPath);
    }

    if(!as2ts) {
        as2ts = new As2Ts();
        tsAnalysor = new TsAnalysor(option);
        tsMaker = new TsMaker(tsAnalysor, option);
    }

    let inputStat = fs.statSync(inputPath);
    if(inputStat.isFile()) {
        doTranslateFile(inputPath, As2TsPhase.Analyse);
        dumpAnalysor();
        hasMeetLast = false;
        doTranslateFile(inputPath, As2TsPhase.Make);
    } else {
        readDir(inputPath, As2TsPhase.Analyse);
        dumpAnalysor();
        hasMeetLast = false;
        readDir(inputPath, As2TsPhase.Make);
    }
    console.log('translation finished.');
}

function readDir(dirPath: string, phase: As2TsPhase) {
    if(transOption.skipRule && transOption.skipRule.dirs) {
        let relativePath = path.relative(inputFolder, dirPath);
        for(let sd of transOption.skipRule.dirs) {
            if(sd.test(relativePath)) {
                return;
            }
        }
    }
    let files = fs.readdirSync(dirPath);
    for(let i = 0, len = files.length; i < len; i++) {
        let filename = files[i];
        let filePath = path.join(dirPath, filename);
        let fileStat = fs.statSync(filePath);
        if (fileStat.isFile()) {
            let fileExt = path.extname(filename).toLowerCase();
            if ('.as' == fileExt) {
                doTranslateFile(filePath, phase);
            }
        } else {
            readDir(filePath, phase);
        }
    }
}

function doTranslateFile(filePath: string, phase: As2TsPhase) {
    // if(filePath.indexOf('GameConfig.as')<0) return;
    let relativePath = path.relative(inputFolder, filePath);
    if(transOption.skipRule && transOption.skipRule.files) {
        for(let sf of transOption.skipRule.files) {
            if(sf.test(relativePath)) {
                return;
            }
        }
    }
    if(continueLast && lastCacheFile && !hasMeetLast) {
        if(filePath == lastCacheFile) {
            hasMeetLast = true;
        } else {
            return;
        }
    }

    fs.writeFileSync(lastConfPath, inputFolder + '|' + outputFolder + '|' + filePath);

    let tmpAstPath = tmpAstDir + relativePath.replace('.as', '.json');
    if(phase == As2TsPhase.Analyse) {
        console.log('\x1B[1A\x1B[Kparsing: %s', filePath);    
        let tsContent = as2ts.translate(filePath);
        if(transOption.tmpRoot) {
            let tmpTsPath = tmpTsDir + relativePath.replace('.as', '.ts');
            let tmpTsPP = path.parse(tmpTsPath);
            if (!fs.existsSync(tmpTsPP.dir)) fs.mkdirSync(tmpTsPP.dir, { recursive: true });
            fs.writeFileSync(tmpTsPath, tsContent);
        }
    
        // 分析语法树
        const ast = parser.parse(tsContent, {loc: true, range: true});
        if(transOption.tmpRoot) {
            let tmpAstPP = path.parse(tmpAstPath);
            if (!fs.existsSync(tmpAstPP.dir)) fs.mkdirSync(tmpAstPP.dir, { recursive: true });
            fs.writeFileSync(tmpAstPath, JSON.stringify(ast));
        }
        tsAnalysor.collect(ast, relativePath);
    } else {
        let outFilePath = filePath.replace(inputFolder, outputFolder);
        let tsFilePath = outFilePath.replace(/\.as$/, '.ts');
        console.log('\x1B[1A\x1B[Kmaking: %s', tsFilePath);    
        let astContent = fs.readFileSync(tmpAstPath, 'utf-8');
        let tsContent = tsMaker.make(JSON.parse(astContent), relativePath);
        let outFilePP = path.parse(outFilePath);
        if (!fs.existsSync(outFilePP.dir)) fs.mkdirSync(outFilePP.dir, { recursive: true });
        fs.writeFileSync(tsFilePath, tsContent);
    }
}

function dumpAnalysor() {
    let analysorInfoPath = transOption.tmpRoot + '/analysor.txt';
    fs.writeFileSync(analysorInfoPath, tsAnalysor.toString());
}