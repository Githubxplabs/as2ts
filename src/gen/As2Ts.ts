import * as fs from "fs";

export class As2Ts {
    translate(inAsFile: string): string {
        let asContent = fs.readFileSync(inAsFile, 'utf-8');
        let classMatchRst = asContent.match(/class\s+(\w+)/);
        if(classMatchRst) {
            let className = classMatchRst[1];
            let ctorRe = new RegExp('(?<=function )' + className + '(?=\\()');
            asContent = asContent.replace(ctorRe, 'constructor');
        }
        // 去掉final关键字
        asContent = asContent.replace(/\bfinal\b\s+/g, '');
        asContent = asContent.replace(/public\s+(?=(class|interface))/g, 'export ');
        // // 去掉package
        // let newAsContent = asContent.replace(/(?<!\w)package\s*[^\{]+\s*\{\s*/, '');
        // if(newAsContent != asContent) {
        //     asContent = newAsContent;
        //     asContent = asContent.replace(/\s*\}\s*$/, '');
        // }
        // package改成module
        asContent = asContent.replace(/\bpackage\b(?=[\s\{])/, 'module');
        // 修改import
        let iptRe = new RegExp(/\s*import\s+([\w\.]+)\s?;*/);
        let asLines = asContent.split(/[\r\n]+/);
        for(let i = 0, len = asLines.length; i < len; i++) {
            let oneLine = asLines[i];
            let iptMatchRst = oneLine.match(iptRe);
            if(iptMatchRst) {
                let iptArr = iptMatchRst[1].split('.');
                let iptName = iptArr[iptArr.length - 1];
                oneLine = 'import {' + iptName + '} from "' + iptArr.join('/') + '";';
                asLines[i] = oneLine;
            }
        }
        asContent = asLines.join('\n');
        // 修改var
        asContent = asContent.replace(/(?<=public)\s+var/g, '');
        asContent = asContent.replace(/(?<=protected)\s+var/g, '');
        asContent = asContent.replace(/(?<=private)\s+var/g, '');
        asContent = asContent.replace(/(?<=static)\s+var/g, '');

        // 去掉override关键字
        asContent = asContent.replace(/(?<=public)\s+override/g, '');
        asContent = asContent.replace(/(?<=protected)\s+override/g, '');
        asContent = asContent.replace(/(?<=private)\s+override/g, '');
        asContent = asContent.replace(/override\s+(?=public)/g, '');
        asContent = asContent.replace(/override\s+(?=protected)/g, '');
        asContent = asContent.replace(/override\s+(?=private)/g, '');

        // 去掉function关键字
        asContent = asContent.replace(/(?<=public)\s+function/g, '');
        asContent = asContent.replace(/(?<=protected)\s+function/g, '');
        asContent = asContent.replace(/(?<=private)\s+function/g, '');
        asContent = asContent.replace(/(?<=static)\s+function/g, '');
        asContent = asContent.replace(/(?<=\s)function(?=\s+\w+)/g, '');

        // is改instanceof
        asContent = asContent.replace(/if\s?\((.+)\s+is\s+(\S+)\)/g, 'if($1 instanceof $2)');
        asContent = asContent.replace(/=\s*(.+)\s+is\s+/g, '= $1 instanceof $2');

        // Vector.<xxx>改Array<xxx>
        asContent = asContent.replace(/Vector\.(?=<)/g, 'Array');
	
        // for each 换成 for of
        asContent = asContent.replace(/for each\s?\(\s?(?:var|let)\s+(\w+)(?:\s*:\s*[\w|\.|<|>]+)?\s+in\s+/g, 'for (let $1 of ');
        asContent = asContent.replace(/for each\s?\(\s?(\w+)\s+in\s+/g, 'for ($1 of ');

        // Vector.<xx> 改 xx[]
        asContent = asContent.replace(/(?!<\w)Vector\./g, 'Array');
        asContent = asContent.replace(/new Array<([\w|\.]+)>;/g, 'new Array<$1>();');
        asContent = asContent.replace(/new <[\w|\.]+>(?=\[)/g, '')

        return asContent;
    }

}