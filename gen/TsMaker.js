"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TsMaker = void 0;
var typescript_estree_1 = require("@typescript-eslint/typescript-estree");
var util = require("util");
var path = require("path");
var FunctionInfo = /** @class */ (function () {
    function FunctionInfo() {
        this.params = [];
    }
    return FunctionInfo;
}());
var ClassInfo = /** @class */ (function () {
    function ClassInfo() {
        this.properties = [];
        this.functionMap = {};
    }
    return ClassInfo;
}());
var TsMaker = /** @class */ (function () {
    function TsMaker(option) {
        // 运算符优先级
        this.pv = 0;
        this.operatorPriorityMap = {};
        this.simpleTypes = ['number', 'string', 'boolean', 'any', 'Array', '[]', 'Object', 'void'];
        this.classMap = {};
        this.option = option || {};
        this.setPriority(['( … )'], this.pv++);
        this.setPriority(['… . …', '… [ … ]', 'new … ( … )', '… ( … )'], this.pv++);
        this.setPriority(['new …'], this.pv++);
        this.setPriority(['… ++', '… --'], this.pv++);
        this.setPriority(['! …', '~ …', '+ …', '- …', '++ …', '-- …', 'typeof …', 'void …', 'delete …', 'await …'], this.pv++);
        this.setPriority(['… ** …'], this.pv++);
        this.setPriority(['… * …', '… / …', '… % …'], this.pv++);
        this.setPriority(['… + …', '… - …'], this.pv++);
        this.setPriority(['… << …', '… >> …', '… >>> …'], this.pv++);
        this.setPriority(['… < …', '… <= …', '… > …', '… >= …', '… in …', '… instanceof …'], this.pv++);
        this.setPriority(['… == …', '… != …', '… === …', '… !== …'], this.pv++);
        this.setPriority(['… & …'], this.pv++);
        this.setPriority(['… ^ …'], this.pv++);
        this.setPriority(['… | …'], this.pv++);
        this.setPriority(['… && …'], this.pv++);
        this.setPriority(['… || …'], this.pv++);
        this.setPriority(['… ? … : …'], this.pv++);
        this.setPriority(['… = …', '… += …', '… -= …', '… *= …', '… /= …', '… %= …', '… <<= …', '… >>= …', '… >>>= …', '… &= …', '… ^= …', '… |= …'], this.pv++);
        this.setPriority(['yield …', 'yield* …'], this.pv++);
        this.setPriority(['...'], this.pv++);
        this.setPriority(['… , …'], this.pv++);
    }
    TsMaker.prototype.setPriority = function (keys, value) {
        for (var i = 0, len = keys.length; i < len; i++) {
            this.operatorPriorityMap[keys[i]] = value;
        }
    };
    TsMaker.prototype.getPriority = function (raw) {
        var idx = this.operatorPriorityMap[raw];
        if (idx < 0) {
            idx = 999;
            console.error('no prioritys: ' + raw);
        }
        return idx;
    };
    TsMaker.prototype.calPriority = function (ast) {
        if ('__calPriority' in ast) {
            return ast.__calPriority;
        }
        switch (ast.type) {
            case typescript_estree_1.AST_NODE_TYPES.UnaryExpression:
                {
                    var ue = ast;
                    ast.__calPriority = this.getPriority(ue.prefix ? ue.operator + ' …' : '… ' + ue.operator);
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.UpdateExpression:
                {
                    var ue = ast;
                    ast.__calPriority = this.getPriority(ue.prefix ? ue.operator + ' …' : '… ' + ue.operator);
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.BinaryExpression:
                {
                    var be = ast;
                    ast.__calPriority = this.getPriority('… ' + be.operator + ' …');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.AssignmentExpression:
                {
                    var ae = ast;
                    ast.__calPriority = this.getPriority('… ' + ae.operator + ' …');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.LogicalExpression:
                {
                    var le = ast;
                    ast.__calPriority = this.getPriority('… ' + le.operator + ' …');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.MemberExpression:
                {
                    var me = ast;
                    ast.__calPriority = this.getPriority(me.computed ? '… [ … ]' : '… . …');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.ConditionalExpression:
                {
                    ast.__calPriority = this.getPriority('… ? … : …');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.CallExpression:
                {
                    ast.__calPriority = this.getPriority('… ( … )');
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.NewExpression:
                {
                    var ne = ast;
                    if (ne.arguments.length > 0) {
                        ast.__calPriority = this.getPriority('new … ( … )');
                    }
                    else {
                        ast.__calPriority = this.getPriority('new …');
                    }
                }
                break;
            case typescript_estree_1.AST_NODE_TYPES.SequenceExpression:
                {
                    ast.__calPriority = this.getPriority('… , …');
                }
                break;
        }
        return ast.__calPriority;
    };
    TsMaker.prototype.make = function (ast, relativePath) {
        this.allTypes = [];
        this.importedMap = {};
        this.relativePath = relativePath;
        var str = this.codeFromAST(ast);
        var relativePP = path.parse(relativePath);
        var modulePath = relativePP.dir.replace('\\', '/') + '/';
        for (var i = 0, len = this.allTypes.length; i < len; i++) {
            var type = this.allTypes[i];
            if (!this.importedMap[type] && !this.isSimpleType(type)) {
                str = 'import {' + type + '} from "' + modulePath + type + '"\n' + str;
            }
        }
        return str;
    };
    // private processAST(ast: any) {
    //     switch (ast.type) {
    //         case AST_NODE_TYPES.ClassDeclaration:
    //             this.processClassDeclaration(ast as ClassDeclaration);
    //             break;
    //         case AST_NODE_TYPES.TSEnumDeclaration:
    //             this.processTSEnumDeclaration(ast as TSEnumDeclaration);
    //             break;
    //         case AST_NODE_TYPES.ExportNamedDeclaration:
    //             this.processExportNamedDeclaration(ast as ExportNamedDeclaration);
    //             break;
    //         case AST_NODE_TYPES.TSModuleBlock:
    //             this.processTSModuleBlock(ast as TSModuleBlock);
    //             break;
    //         case AST_NODE_TYPES.TSModuleDeclaration:
    //             this.processTSModuleDeclaration(ast as TSModuleDeclaration);
    //             break;
    //         default:
    //             break;
    //     }
    // }
    // private processClassDeclaration(ast: ClassDeclaration) {
    // }
    TsMaker.prototype.codeFromAST = function (ast) {
        var str = '';
        switch (ast.type) {
            case typescript_estree_1.AST_NODE_TYPES.ArrayExpression:
                str += this.codeFromArrayExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ArrayPattern:
                str += this.codeFromArrayPattern(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ArrowFunctionExpression:
                str += this.codeFromArrowFunctionExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.AssignmentExpression:
                str += this.codeFromAssignmentExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.AssignmentPattern:
                str += this.codeFromAssignmentPattern(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.AwaitExpression:
                str += this.codeFromAwaitExpression(ast);
                break;
            // case AST_NODE_TYPES.BigIntLiteral:
            //     str += this.codeFromBigIntLiteral(ast);
            //     break;
            case typescript_estree_1.AST_NODE_TYPES.BinaryExpression:
                str += this.codeFromBinaryExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.BlockStatement:
                str += this.codeFromBlockStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.BreakStatement:
                str += this.codeFromBreakStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.CallExpression:
                str += this.codeFromCallExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.CatchClause:
                str += this.codeFromCatchClause(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ClassBody:
                str += this.codeFromClassBody(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ClassDeclaration:
                str += this.codeFromClassDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ClassExpression:
                str += this.codeFromClassExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ClassProperty:
                str += this.codeFromClassProperty(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ConditionalExpression:
                str += this.codeFromConditionalExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ContinueStatement:
                str += this.codeFromContinueStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.DebuggerStatement:
                str += this.codeFromDebuggerStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Decorator:
                str += this.codeFromDecorator(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.DoWhileStatement:
                str += this.codeFromDoWhileStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.EmptyStatement:
                str += this.codeFromEmptyStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ExportAllDeclaration:
                str += this.codeFromExportAllDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ExportDefaultDeclaration:
                str += this.codeFromExportDefaultDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ExportNamedDeclaration:
                str += this.codeFromExportNamedDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ExportSpecifier:
                str += this.codeFromExportSpecifier(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ExpressionStatement:
                str += this.codeFromExpressionStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ForInStatement:
                str += this.codeFromForInStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ForOfStatement:
                str += this.codeFromForOfStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ForStatement:
                str += this.codeFromForStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.FunctionDeclaration:
                str += this.codeFromFunctionDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.FunctionExpression:
                str += this.codeFromFunctionExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Identifier:
                str += this.codeFromIdentifier(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.IfStatement:
                str += this.codeFromIfStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ImportDeclaration:
                str += this.codeFromImportDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ImportDefaultSpecifier:
                str += this.codeFromImportDefaultSpecifier(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ImportNamespaceSpecifier:
                str += this.codeFromImportNamespaceSpecifier(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ImportSpecifier:
                str += this.codeFromImportSpecifier(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.LabeledStatement:
                str += this.codeFromLabeledStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Literal:
                str += this.codeFromLiteral(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.LogicalExpression:
                str += this.codeFromLogicalExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.MemberExpression:
                str += this.codeFromMemberExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.MetaProperty:
                str += this.codeFromMetaProperty(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.MethodDefinition:
                str += this.codeFromMethodDefinition(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.NewExpression:
                str += this.codeFromNewExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ObjectExpression:
                str += this.codeFromObjectExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ObjectPattern:
                str += this.codeFromObjectPattern(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Program:
                str += this.codeFromProgram(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Property:
                str += this.codeFromProperty(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.RestElement:
                str += this.codeFromRestElement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ReturnStatement:
                str += this.codeFromReturnStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.SequenceExpression:
                str += this.codeFromSequenceExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.SpreadElement:
                str += this.codeFromSpreadElement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.Super:
                str += this.codeFromSuper(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.SwitchCase:
                str += this.codeFromSwitchCase(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.SwitchStatement:
                str += this.codeFromSwitchStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TaggedTemplateExpression:
                str += this.codeFromTaggedTemplateExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TemplateElement:
                str += this.codeFromTemplateElement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TemplateLiteral:
                str += this.codeFromTemplateLiteral(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ThisExpression:
                str += this.codeFromThisExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.ThrowStatement:
                str += this.codeFromThrowStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TryStatement:
                str += this.codeFromTryStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSClassImplements:
                str += this.codeFromTSClassImplements(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.UnaryExpression:
                str += this.codeFromUnaryExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.UpdateExpression:
                str += this.codeFromUpdateExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.VariableDeclaration:
                str += this.codeFromVariableDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.VariableDeclarator:
                str += this.codeFromVariableDeclarator(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.WhileStatement:
                str += this.codeFromWhileStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.WithStatement:
                str += this.codeFromWithStatement(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.YieldExpression:
                str += this.codeFromYieldExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSAbstractMethodDefinition:
                str += this.codeFromTSAbstractMethodDefinition(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSAsExpression:
                str += this.codeFromTSAsExpression(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSDeclareFunction:
                str += this.codeFromTSDeclareFunction(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSEnumDeclaration:
                str += this.codeFromTSEnumDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSInterfaceBody:
                str += this.codeFromTSInterfaceBody(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSMethodSignature:
                str += this.codeFromTSMethodSignature(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSModuleBlock:
                str += this.codeFromTSModuleBlock(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSModuleDeclaration:
                str += this.codeFromTSModuleDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSInterfaceDeclaration:
                str += this.codeFromTSInterfaceDeclaration(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSTypeAssertion:
                str += this.codeFromTSTypeAssertion(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSTypeAnnotation:
                str += this.codeFromTSTypeAnnotation(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSTypeParameterInstantiation:
                str += this.codeFromTSTypeParameterInstantiation(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSTypeReference:
                str += this.codeFromTSTypeReference(ast);
                break;
            case typescript_estree_1.AST_NODE_TYPES.TSVoidKeyword:
                str += this.codeFromTSVoidKeyword(ast);
                break;
            case 'TSJSDocAllType':
                str += 'any';
                break;
            default:
                console.log(util.inspect(ast, true, 3));
                throw new Error('unrecornized type: ' + ast.type);
                break;
        }
        return str;
    };
    TsMaker.prototype.codeFromArrayExpression = function (ast) {
        var str = '';
        for (var i = 0, len = ast.elements.length; i < len; i++) {
            if (str) {
                str += ', ';
            }
            str += this.codeFromAST(ast.elements[i]);
        }
        return '[' + str + ']';
    };
    TsMaker.prototype.codeFromArrayPattern = function (ast) {
        this.assert(false, ast, 'Not support ArrayPattern yet!');
        return '';
    };
    TsMaker.prototype.codeFromArrowFunctionExpression = function (ast) {
        var str = '(';
        if (ast.params) {
            for (var i = 0, len = ast.params.length; i < len; i++) {
                if (i > 0) {
                    str += ', ';
                }
                var oneParam = ast.params[i];
                oneParam.__parent = ast;
                str += this.codeFromAST(oneParam);
            }
        }
        str += ')\n';
        if (ast.body) {
            var bodyStr = this.codeFromAST(ast.body);
            str += this.indent(bodyStr) + '\n';
        }
        this.assert(!ast.generator, ast, 'Not support generator yet!');
        this.assert(!ast.async, ast, 'Not support async yet!');
        this.assert(!ast.expression, ast, 'Not support expression yet!');
        str += 'end\n';
        return str;
    };
    TsMaker.prototype.codeFromAssignmentExpression = function (ast) {
        return this.codeFromBinaryExpression(ast);
    };
    TsMaker.prototype.codeFromAssignmentPattern = function (ast) {
        var str = this.codeFromAST(ast.left);
        str += ' = ' + this.codeFromAST(ast.right);
        return str;
    };
    TsMaker.prototype.codeFromAwaitExpression = function (ast) {
        this.assert(false, ast, 'Not support AwaitExpression yet!');
        return '';
    };
    TsMaker.prototype.codeFromBinaryExpression = function (ast) {
        var optStr = ast.operator;
        this.assert('>>>=' != optStr, ast, 'Not support >>>= yet!');
        ast.left.__parent = ast;
        ast.right.__parent = ast;
        var left = this.codeFromAST(ast.left);
        var right = this.codeFromAST(ast.right);
        // if (optStr == 'in') {
        //     return right + '[' + left + ']';
        // }
        return left + ' ' + optStr + ' ' + right;
    };
    TsMaker.prototype.codeFromBlockStatement = function (ast) {
        var str = '';
        for (var i = 0, len = ast.body.length; i < len; i++) {
            var bodyEle = ast.body[i];
            var bstr = this.codeFromAST(bodyEle);
            if (bstr) {
                if (i > 0) {
                    str += '\n';
                }
                str += bstr + ';';
            }
        }
        return str;
    };
    TsMaker.prototype.codeFromBreakStatement = function (ast) {
        return 'break;';
    };
    TsMaker.prototype.codeFromCallExpression = function (ast) {
        ast.callee.__parent = ast;
        var calleeStr = this.codeFromAST(ast.callee);
        var str = '';
        var allAgmStr = '';
        for (var i = 0, len = ast.arguments.length; i < len; i++) {
            var arg = ast.arguments[i];
            var argStr = this.codeFromAST(arg);
            // if (arg.type == AST_NODE_TYPES.AssignmentExpression) {
            //     str += argStr + '\n';
            //     argStr = this.codeFromAST((arg as AssignmentExpression).left);
            // } else if (arg.type == AST_NODE_TYPES.UpdateExpression) {
            //     str += argStr + '\n';
            //     argStr = this.codeFromAST((arg as UpdateExpression).argument);
            // }
            if (allAgmStr) {
                allAgmStr += ', ';
            }
            allAgmStr += argStr;
        }
        if (calleeStr == '__JS__') {
            str = allAgmStr.substr(1, allAgmStr.length - 2);
        }
        else {
            str = calleeStr + '(' + allAgmStr + ')';
        }
        return str;
    };
    TsMaker.prototype.codeFromCatchClause = function (ast) {
        var str = 'catch(';
        str += this.codeFromAST(ast.param);
        str += ') {\n';
        str += this.indent(this.codeFromBlockStatement(ast.body));
        str += '\n}';
        return str;
    };
    TsMaker.prototype.codeFromClassBody = function (ast) {
        var str = '';
        for (var i = 0, len = ast.body.length; i < len; i++) {
            var cbodyStr = this.codeFromAST(ast.body[i]);
            if (cbodyStr) {
                if (i > 0) {
                    str += '\n';
                }
                str += cbodyStr;
            }
        }
        return str;
    };
    TsMaker.prototype.codeFromClassDeclaration = function (ast) {
        if (ast.typeParameters) {
            // typeParameters?: TSTypeParameterDeclaration;
        }
        if (ast.superTypeParameters) {
            // TSTypeParameterInstantiation;
        }
        if (!ast.id) {
            this.assert(false, ast, 'Class name is necessary!');
        }
        var className = this.codeFromAST(ast.id);
        this.importedMap[className] = true;
        this.crtClass = new ClassInfo();
        this.crtClass.name = className;
        var str = '';
        if (ast.__exported) {
            str += 'export ';
        }
        str += 'class ' + className + ' ';
        if (ast.superClass) {
            ast.superClass.__isType = true;
            str += 'extends ' + this.codeFromAST(ast.superClass) + ' ';
        }
        if (ast.implements) {
            str += 'implements ';
            for (var i = 0, len = ast.implements.length; i < len; i++) {
                if (i > 0) {
                    str += ', ';
                }
                ast.implements[i].__isType = true;
                str += this.codeFromAST(ast.implements[i]);
            }
            str += ' ';
        }
        // if(ast.abstract) {
        //   // boolean;
        // }
        if (ast.declare) {
            // boolean
            this.assert(false, ast);
        }
        if (ast.decorators) {
            // Decorator[];
            this.assert(false, ast);
        }
        str += '{\n';
        str += this.indent(this.codeFromClassBody(ast.body));
        str += '\n}';
        this.crtClass = null;
        return str;
    };
    TsMaker.prototype.codeFromClassExpression = function (ast) {
        // this.pintHit(ast);
        return this.codeFromClassDeclaration(ast);
    };
    TsMaker.prototype.codeFromClassProperty = function (ast) {
        this.assert(!ast.decorators, ast, 'not support decorators yet!');
        this.assert(!ast.optional, ast, 'not support optional yet!');
        this.assert(!ast.computed, ast, 'not support computed yet!');
        this.assert(!ast.definite, ast, 'not support definite yet!');
        this.assert(!ast.declare, ast, 'not support declare yet!');
        var str = '';
        if (ast.accessibility) {
            str += ast.accessibility + ' ';
        }
        if (ast.static) {
            str += 'static ';
        }
        if (ast.readonly) {
            str += 'readonly ';
        }
        var propertyName = this.codeFromAST(ast.key);
        this.crtClass.properties.push(propertyName);
        str += propertyName;
        if (ast.typeAnnotation) {
            str += ': ' + this.codeFromAST(ast.typeAnnotation);
        }
        if (ast.value) {
            str += ' = ' + this.codeFromAST(ast.value);
        }
        str += ';';
        return str;
    };
    TsMaker.prototype.codeFromConditionalExpression = function (ast) {
        var testStr = this.codeFromAST(ast.test);
        if (this.calPriority(ast.test) >= this.calPriority(ast)) {
            testStr = '(' + testStr + ')';
        }
        var consequantStr = this.codeFromAST(ast.consequent);
        if (this.calPriority(ast.consequent) >= this.calPriority(ast)) {
            consequantStr = '(' + consequantStr + ')';
        }
        var alternateStr = this.codeFromAST(ast.alternate);
        if (this.calPriority(ast.alternate) >= this.calPriority(ast)) {
            alternateStr = '(' + alternateStr + ')';
        }
        var str = testStr + ' ? ' + consequantStr + ' : ' + alternateStr;
        return str;
    };
    TsMaker.prototype.codeFromContinueStatement = function (ast) {
        return 'continue;';
    };
    TsMaker.prototype.codeFromDebuggerStatement = function (ast) {
        this.assert(false, ast, 'Not support DebuggerStatement yet!');
        return '';
    };
    TsMaker.prototype.codeFromDecorator = function (ast) {
        this.assert(false, ast, 'Not support Decorator yet!');
        return '';
    };
    TsMaker.prototype.codeFromDoWhileStatement = function (ast) {
        this.assert(false, ast, 'Not support DoWhileStatement yet!');
        return '';
    };
    TsMaker.prototype.codeFromEmptyStatement = function (ast) {
        return '';
    };
    TsMaker.prototype.codeFromExportAllDeclaration = function (ast) {
        this.assert(false, ast, 'Not support ExportAllDeclaration yet!');
        return '';
    };
    TsMaker.prototype.codeFromExportDefaultDeclaration = function (ast) {
        return '';
    };
    TsMaker.prototype.codeFromExportNamedDeclaration = function (ast) {
        ast.declaration.__exported = true;
        if (ast.__module) {
            ast.declaration.__module = ast.__module;
        }
        return this.codeFromAST(ast.declaration);
    };
    TsMaker.prototype.codeFromExportSpecifier = function (ast) {
        this.assert(false, ast, 'Not support ExportSpecifier yet!');
        return '';
    };
    TsMaker.prototype.codeFromExpressionStatement = function (ast) {
        return this.codeFromAST(ast.expression);
    };
    TsMaker.prototype.codeFromForInStatement = function (ast) {
        ast.left.__parent = ast;
        var str = 'for(' + this.codeFromAST(ast.left) + ' in ' + this.codeFromAST(ast.right) + ') {\n';
        str += this.indent(this.codeFromAST(ast.body)) + '\n';
        str += '}';
        return str;
    };
    TsMaker.prototype.codeFromForOfStatement = function (ast) {
        ast.left.__parent = ast;
        var str = 'for(' + this.codeFromAST(ast.left) + ' of ' + this.codeFromAST(ast.right) + ') {\n';
        str += this.indent(this.codeFromAST(ast.body)) + '\n';
        str += '}';
        return str;
    };
    TsMaker.prototype.codeFromForStatement = function (ast) {
        var str = 'for(';
        if (ast.init) {
            str += this.codeFromAST(ast.init);
        }
        if (str.charAt(str.length - 1) != ';') {
            str += '; ';
        }
        if (ast.test) {
            str += this.codeFromAST(ast.test);
        }
        str += '; ';
        if (ast.update) {
            str += this.codeFromAST(ast.update);
        }
        str += ') {\n';
        var repeatBodyStr = this.codeFromAST(ast.body);
        str += this.indent(repeatBodyStr) + '\n';
        str += '}';
        return str;
    };
    TsMaker.prototype.codeFromFunctionDeclaration = function (ast) {
        return this.codeFromFunctionExpression(ast);
    };
    TsMaker.prototype.codeFromFunctionExpression = function (ast) {
        return this.codeFromFunctionExpressionInternal(null, false, null, null, ast);
    };
    TsMaker.prototype.codeFromFunctionExpressionInternal = function (funcName, isStatic, kind, accessibility, ast) {
        var str = '';
        if (!funcName && ast.id) {
            funcName = this.codeFromAST(ast.id);
        }
        if (!funcName) {
            funcName = 'function';
        }
        if (accessibility) {
            str += accessibility + ' ';
        }
        if (isStatic) {
            str += 'static ';
        }
        if (kind == 'get' || kind == 'set') {
            str += kind + ' ';
        }
        this.crtFunc = new FunctionInfo();
        str += funcName + '(';
        this.crtFunc.name = funcName;
        this.crtClass.functionMap[funcName] = this.crtFunc;
        if (ast.params) {
            for (var i = 0, len = ast.params.length; i < len; i++) {
                if (i > 0) {
                    str += ', ';
                }
                var oneParam = ast.params[i];
                oneParam.__parent = ast;
                oneParam.__isFuncParam = true;
                str += this.codeFromAST(oneParam);
            }
        }
        str += ')';
        if (ast.returnType) {
            str += ': ' + this.codeFromAST(ast.returnType);
        }
        str += ' {\n';
        if (ast.body) {
            // 构造函数加上super
            this.startAddThis = true;
            var bodyStr = this.codeFromAST(ast.body);
            if ('constructor' == funcName && bodyStr.indexOf('super(') < 0) {
                if (bodyStr) {
                    bodyStr = 'super();\n' + bodyStr;
                }
                else {
                    bodyStr = 'super();';
                }
            }
            this.startAddThis = false;
            str += this.indent(bodyStr);
        }
        str += '\n}';
        this.assert(!ast.generator, ast, 'Not support generator yet!');
        this.assert(!ast.async, ast, 'Not support async yet!');
        this.assert(!ast.expression, ast, 'Not support expression yet!');
        this.assert(!ast.declare, ast, 'Not support declare yet!');
        this.crtFunc = null;
        return str;
    };
    TsMaker.prototype.codeFromIdentifier = function (ast) {
        var str = ast.name;
        if ('constructor' != str && this.option.idReplacement && this.option.idReplacement[str]) {
            str = this.option.idReplacement[str];
        }
        if (ast.__isFuncParam && this.crtFunc) {
            this.crtFunc.params.push(str);
        }
        if (this.startAddThis && (!ast.__parent || ast.__parent.type != typescript_estree_1.AST_NODE_TYPES.MemberExpression) && null != this.crtClass && null != this.crtFunc) {
            if (this.crtFunc.params.indexOf(str) < 0 && (this.crtClass.functionMap[str] || this.crtClass.properties.indexOf(str) >= 0)) {
                str = 'this.' + str;
            }
        }
        if (ast.typeAnnotation) {
            str += ': ' + this.codeFromAST(ast.typeAnnotation);
        }
        else if (ast.__isType) {
            var mapped = this.option.typeMapper[str];
            if (mapped)
                str = mapped;
            if (this.allTypes.indexOf(str) < 0) {
                this.allTypes.push(str);
            }
        }
        return str;
    };
    TsMaker.prototype.codeFromIfStatement = function (ast) {
        var testStr = this.codeFromAST(ast.test);
        var str = 'if(' + testStr + ' ) {\n';
        str += this.indent(this.codeFromAST(ast.consequent));
        str += '\n} ';
        if (ast.alternate && (ast.alternate.type != typescript_estree_1.AST_NODE_TYPES.BlockStatement || ast.alternate.body.length > 0)) {
            str += 'else ';
            var altStr = this.codeFromAST(ast.alternate);
            if (ast.alternate.type != typescript_estree_1.AST_NODE_TYPES.IfStatement) {
                str += '{\n';
                str += this.indent(altStr);
                str += '\n}';
            }
            else {
                str += altStr;
            }
        }
        return str;
    };
    TsMaker.prototype.codeFromImportDeclaration = function (ast) {
        var str = 'import ';
        var specifierStr = '';
        for (var i = 0, len = ast.specifiers.length; i < len; i++) {
            if (i > 0) {
                specifierStr += ', ';
            }
            specifierStr += this.codeFromAST(ast.specifiers[i]);
        }
        var sourceStr;
        if (this.option.importRule && this.option.importRule.fromModule) {
            for (var _i = 0, _a = this.option.importRule.fromModule; _i < _a.length; _i++) {
                var fm = _a[_i];
                var sourceValue = ast.source.value;
                if (fm.regular.test(sourceValue)) {
                    sourceStr = ' = ' + fm.module + '.' + sourceValue.substr(sourceValue.lastIndexOf('/') + 1);
                    break;
                }
            }
        }
        if (!sourceStr) {
            specifierStr = '{' + specifierStr + '}';
            sourceStr = ' from ' + this.codeFromAST(ast.source);
        }
        str += specifierStr + sourceStr;
        return str;
    };
    TsMaker.prototype.codeFromImportDefaultSpecifier = function (ast) {
        this.assert(false, ast, 'Not support ImportDefaultSpecifier yet!');
        return '';
    };
    TsMaker.prototype.codeFromImportNamespaceSpecifier = function (ast) {
        this.assert(false, ast, 'Not support ImportNamespaceSpecifier yet!');
        return '';
    };
    TsMaker.prototype.codeFromImportSpecifier = function (ast) {
        var str = this.codeFromAST(ast.imported);
        this.importedMap[str] = true;
        return str;
    };
    TsMaker.prototype.codeFromLabeledStatement = function (ast) {
        this.assert(false, ast, 'Not support LabeledStatement yet!');
        return '';
    };
    TsMaker.prototype.codeFromLiteral = function (ast) {
        // if (ast.regex) {
        //     return ast.raw;
        // }
        var str = ast.raw;
        if (this.option.literalReplacement && this.option.literalReplacement[str]) {
            str = this.option.literalReplacement[str];
        }
        return str;
    };
    TsMaker.prototype.codeFromLogicalExpression = function (ast) {
        var left = this.codeFromAST(ast.left);
        if (this.calPriority(ast.left) >= this.calPriority(ast)) {
            left = '(' + left + ')';
        }
        var right = this.codeFromAST(ast.right);
        if (this.calPriority(ast.right) >= this.calPriority(ast)) {
            right = '(' + right + ')';
        }
        var optStr = ast.operator;
        var str = left + ' ' + optStr + ' ' + right;
        return str;
    };
    TsMaker.prototype.codeFromMemberExpression = function (ast) {
        ast.property.__parent = ast;
        // if(ast.object.type == AST_NODE_TYPES.Identifier) {
        //     (ast.object as any).__addThis = true;
        // }
        var objStr = this.codeFromAST(ast.object);
        var str = objStr;
        if (this.calPriority(ast.object) > this.calPriority(ast)) {
            str = '(' + str + ')';
        }
        ast.property.__parent = ast;
        var propertyStr = this.codeFromAST(ast.property);
        if (ast.computed) {
            str += '[' + propertyStr + ']';
        }
        else {
            str += '.' + propertyStr;
        }
        return str;
    };
    TsMaker.prototype.codeFromMetaProperty = function (ast) {
        this.assert(false, ast, 'Not support MetaProperty yet!');
        return '';
    };
    TsMaker.prototype.codeFromMethodDefinition = function (ast) {
        var funcName = null;
        if (ast.key) {
            funcName = this.codeFromAST(ast.key);
        }
        if (ast.value.type == "TSEmptyBodyFunctionExpression") {
            this.assert(false, ast, 'Not support TSEmptyBodyFunctionExpression yet!');
        }
        return this.codeFromFunctionExpressionInternal(funcName, ast.static, ast.kind, ast.accessibility, ast.value);
    };
    TsMaker.prototype.codeFromNewExpression = function (ast) {
        var callee = this.codeFromAST(ast.callee);
        // if ('Date' == callee) {
        //     this.addImport('date');
        // }
        if (this.calPriority(ast.callee) > this.calPriority(ast)) {
            callee = '(' + callee + ')';
        }
        if ('Array' == callee /* && ast.arguments.length == 0*/) {
            return '[]';
        }
        var argStr = '';
        for (var i = 0, len = ast.arguments.length; i < len; i++) {
            if (i > 0) {
                argStr += ', ';
            }
            argStr += this.codeFromAST(ast.arguments[i]);
        }
        if ('RegExp' == callee) {
            return argStr;
        }
        var str = 'new ' + callee + '(' + argStr + ')';
        return str;
    };
    TsMaker.prototype.codeFromObjectExpression = function (ast) {
        var str = '{';
        for (var i = 0, len = ast.properties.length; i < len; i++) {
            if (i > 0) {
                str += ', ';
            }
            str += this.codeFromAST(ast.properties[i]);
        }
        return str + '}';
    };
    TsMaker.prototype.codeFromObjectPattern = function (ast) {
        this.assert(false, ast, 'Not support ObjectPattern yet!');
        return '';
    };
    TsMaker.prototype.codeFromProgram = function (ast) {
        var str = '';
        for (var i = 0, len = ast.body.length; i < len; i++) {
            var stm = ast.body[i];
            var bodyStr = this.codeFromAST(stm);
            if (bodyStr) {
                if (i > 0) {
                    str += '\n';
                }
                str += bodyStr;
            }
        }
        return str;
    };
    TsMaker.prototype.codeFromProperty = function (ast) {
        ast.key.__parent = ast;
        return this.codeFromAST(ast.key) + ': ' + this.codeFromAST(ast.value);
    };
    TsMaker.prototype.codeFromRestElement = function (ast) {
        return '...';
    };
    TsMaker.prototype.codeFromReturnStatement = function (ast) {
        var str = 'return';
        if (ast.argument) {
            str += ' ' + this.codeFromAST(ast.argument);
        }
        return str;
    };
    TsMaker.prototype.codeFromSequenceExpression = function (ast) {
        var str = '';
        for (var i = 0, len = ast.expressions.length; i < len; i++) {
            if (i > 0) {
                str += '; ';
            }
            str += this.codeFromAST(ast.expressions[i]);
        }
        return str;
    };
    TsMaker.prototype.codeFromSpreadElement = function (ast) {
        return '...';
    };
    TsMaker.prototype.codeFromSuper = function (ast) {
        return 'super';
    };
    TsMaker.prototype.codeFromSwitchCase = function (ast) {
        var str = '';
        if (ast.test) {
            str += 'case ' + this.codeFromAST(ast.test) + ':\n';
        }
        else {
            str += 'default:\n';
        }
        var csqStr = '';
        for (var i = 0, len = ast.consequent.length; i < len; i++) {
            if (ast.consequent[i].type != typescript_estree_1.AST_NODE_TYPES.BreakStatement) {
                if (i > 0) {
                    csqStr += '\n';
                }
                csqStr += this.codeFromAST(ast.consequent[i]);
            }
        }
        if (csqStr) {
            str += '{\n' + this.indent(csqStr) + '\n}\n';
        }
        str += 'break;';
        return str;
    };
    TsMaker.prototype.codeFromSwitchStatement = function (ast) {
        var str = 'switch(' + this.codeFromAST(ast.discriminant) + ') {\n';
        var caseStr = '';
        for (var i = 0, len = ast.cases.length; i < len; i++) {
            if (i > 0) {
                caseStr += '\n';
            }
            caseStr += this.codeFromSwitchCase(ast.cases[i]);
        }
        str += this.indent(caseStr);
        str += '\n}';
        return str;
    };
    TsMaker.prototype.codeFromTaggedTemplateExpression = function (ast) {
        this.assert(false, ast, 'Not support TaggedTemplateExpression yet!');
        return '';
    };
    TsMaker.prototype.codeFromTemplateElement = function (ast) {
        this.assert(false, ast, 'Not support TemplateElement yet!');
        return '';
    };
    TsMaker.prototype.codeFromTemplateLiteral = function (ast) {
        this.assert(false, ast, 'Not support TemplateLiteral yet!');
        return '';
    };
    TsMaker.prototype.codeFromThisExpression = function (ast) {
        return 'this';
    };
    TsMaker.prototype.codeFromThrowStatement = function (ast) {
        return 'throw ' + this.codeFromAST(ast.argument);
    };
    TsMaker.prototype.codeFromTryStatement = function (ast) {
        var str = 'try{\n';
        str += this.indent(this.codeFromAST(ast.block));
        str += '\n} ';
        if (ast.handler) {
            str += this.codeFromAST(ast.handler);
        }
        if (ast.finalizer) {
            str += ' finally {\n';
            str += this.indent(this.codeFromAST(ast.finalizer));
            str += '\n}';
        }
        str += '\n';
        return str;
    };
    TsMaker.prototype.codeFromTSClassImplements = function (ast) {
        var str = '';
        str += this.codeFromAST(ast.expression);
        if (ast.typeParameters) {
            str += '<' + this.codeFromAST(ast.typeParameters) + '>';
        }
        return str;
    };
    TsMaker.prototype.codeFromUnaryExpression = function (ast) {
        var str;
        var agm = this.codeFromAST(ast.argument);
        if (this.calPriority(ast.argument) >= this.calPriority(ast)) {
            agm = '(' + agm + ')';
        }
        if (ast.prefix) {
            str = ast.operator + agm;
        }
        else {
            str = agm + ast.operator;
        }
        return str;
    };
    TsMaker.prototype.codeFromUpdateExpression = function (ast) {
        var str = this.codeFromAST(ast.argument);
        if (this.calPriority(ast.argument) >= this.calPriority(ast)) {
            str = '(' + str + ')';
        }
        if (ast.prefix) {
            str = ast.operator + str;
        }
        else {
            str = str + ast.operator;
        }
        return str;
    };
    TsMaker.prototype.codeFromVariableDeclaration = function (ast) {
        var str = 'let ';
        for (var i = 0, len = ast.declarations.length; i < len; i++) {
            var d = ast.declarations[i];
            if (i > 0) {
                str += ', ';
            }
            str += this.codeFromVariableDeclarator(d);
        }
        return str;
    };
    TsMaker.prototype.codeFromVariableDeclarator = function (ast) {
        var str = this.codeFromAST(ast.id);
        if (ast.init) {
            str += ' = ' + this.codeFromAST(ast.init);
        }
        return str;
    };
    TsMaker.prototype.codeFromWhileStatement = function (ast) {
        var str = 'while(' + this.codeFromAST(ast.test) + ') {\n';
        var bodyCode = this.indent(this.codeFromAST(ast.body));
        str += bodyCode + '\n}';
        return str;
    };
    TsMaker.prototype.codeFromWithStatement = function (ast) {
        this.assert(false, ast, 'Not support WithStatement yet');
        return '';
    };
    TsMaker.prototype.codeFromYieldExpression = function (ast) {
        this.assert(false, ast, 'Not support YieldExpression yet');
        return '';
    };
    TsMaker.prototype.codeFromTSAbstractMethodDefinition = function (ast) {
        return this.codeFromMethodDefinition(ast);
    };
    TsMaker.prototype.codeFromTSAsExpression = function (ast) {
        return this.codeFromAST(ast.expression);
    };
    TsMaker.prototype.codeFromTSDeclareFunction = function (ast) {
        this.assert(false, ast, 'Not support TSDeclareFunction yet');
        return '';
    };
    TsMaker.prototype.codeFromTSEnumDeclaration = function (ast) {
        this.assert(false, ast, 'Not support TSEnumDeclaration yet');
        return '';
        // let str = '';
        // if (!(ast as any).__exported) {
        //     str += 'local ';
        // }
        // let enumName = this.codeFromAST(ast.id);
        // str += enumName + ' = {\n';
        // let membersStr = '';
        // let nextValue = 0;
        // for (let i = 0, len = ast.members.length; i < len; i++) {
        //     if (i > 0) {
        //         membersStr += ',\n';
        //     }
        //     let m = ast.members[i];
        //     membersStr += this.codeFromAST(m.id) + ' = ';
        //     if (m.initializer) {
        //         membersStr += this.codeFromAST(m.initializer)
        //         nextValue = ((m.initializer as Literal).value as number) + 1;
        //     } else {
        //         membersStr += nextValue;
        //         nextValue++;
        //     }
        // }
        // str += this.indent(membersStr) + '\n';
        // str += '}';
        // this.assert(!ast.const, ast);
        // this.assert(!ast.declare, ast);
        // this.assert(!ast.modifiers, ast);
        // this.assert(!ast.decorators, ast);
        // return '';
    };
    TsMaker.prototype.codeFromTSInterfaceBody = function (ast) {
        var str = '';
        for (var i = 0, len = ast.body.length; i < len; i++) {
            if (i > 0) {
                str += '\n';
            }
            str += this.codeFromAST(ast.body[i]);
        }
        return str;
    };
    TsMaker.prototype.codeFromTSMethodSignature = function (ast) {
        var str = '';
        if (ast.accessibility) {
            str += ast.accessibility + ' ';
        }
        if (ast.static) {
            str += 'static ';
        }
        str += this.codeFromAST(ast.key) + '(';
        if (ast.params) {
            for (var i = 0, len = ast.params.length; i < len; i++) {
                if (i > 0) {
                    str += ', ';
                }
                var oneParam = ast.params[i];
                oneParam.__parent = ast;
                oneParam.__isFuncParam = true;
                str += this.codeFromAST(oneParam);
            }
        }
        str += ')';
        if (ast.returnType) {
            str += ': ' + this.codeFromAST(ast.returnType);
        }
        str += ';';
        return str;
    };
    TsMaker.prototype.codeFromTSModuleBlock = function (ast) {
        var str = '';
        for (var i = 0, len = ast.body.length; i < len; i++) {
            if (i > 0) {
                str += '\n';
            }
            str += this.codeFromAST(ast.body[i]);
        }
        return str;
    };
    TsMaker.prototype.codeFromTSModuleDeclaration = function (ast) {
        if (ast.body) {
            return this.codeFromAST(ast.body);
        }
        return '';
    };
    TsMaker.prototype.codeFromTSInterfaceDeclaration = function (ast) {
        this.assert(!ast.implements, ast, 'not support implements yet!');
        var str = 'export interface ';
        str += this.codeFromAST(ast.id) + ' ';
        if (ast.extends) {
            str += 'extends ';
            for (var i = 0, len = ast.extends.length; i < len; i++) {
                if (i > 0) {
                    str += ', ';
                }
                str += this.codeFromAST(ast.extends[i]);
            }
            str += ' ';
        }
        str += '{\n';
        str += this.indent(this.codeFromAST(ast.body));
        str += '\n}';
        return str;
    };
    TsMaker.prototype.codeFromTSTypeAssertion = function (ast) {
        this.assert(false, ast, 'Not support TSTypeAssertion yet');
        return '';
    };
    TsMaker.prototype.codeFromTSTypeAnnotation = function (ast) {
        var str = this.codeFromAST(ast.typeAnnotation);
        if (str == 'Array')
            str = 'any[]';
        return str;
    };
    TsMaker.prototype.codeFromTSTypeParameterInstantiation = function (ast) {
        var str = '';
        for (var i = 0, len = ast.params.length; i < len; i++) {
            if (i > 0) {
                str += ', ';
            }
            ast.params[i].__isType = true;
            var pstr = this.codeFromAST(ast.params[i]);
            str += pstr;
        }
        return str;
    };
    TsMaker.prototype.codeFromTSTypeReference = function (ast) {
        ast.typeName.__isType = true;
        var str = this.codeFromAST(ast.typeName);
        if (ast.typeParameters) {
            str += '<' + this.codeFromAST(ast.typeParameters) + '>';
        }
        return str;
    };
    TsMaker.prototype.codeFromTSVoidKeyword = function (ast) {
        return 'void';
    };
    TsMaker.prototype.indent = function (str, fromLine) {
        if (fromLine === void 0) { fromLine = 0; }
        var indentStr = '    ';
        // for(let i = 0; i < blockDeep; i++) {
        //   indentStr += '  ';
        // }
        var endWithNewLine = str.substr(str.length - 1) == '\n';
        var lines = str.split(/\n/);
        var newStr = '';
        for (var i = 0, len = lines.length; i < len; i++) {
            if (i > 0) {
                newStr += '\n';
            }
            if (i >= fromLine) {
                newStr += indentStr;
            }
            newStr += lines[i];
        }
        if (endWithNewLine) {
            newStr += '\n';
        }
        return newStr;
    };
    TsMaker.prototype.isSimpleType = function (type) {
        if (this.simpleTypes.indexOf(type) >= 0) {
            return true;
        }
        return false;
    };
    TsMaker.prototype.assert = function (cond, ast, message) {
        if (message === void 0) { message = null; }
        if (!cond) {
            if (this.option.errorDetail) {
                console.log(util.inspect(ast, true, 6));
            }
            console.log('\x1B[36m%s\x1B[0m(tmp/tmp.ts:\x1B[33m%d:%d\x1B[0m) - \x1B[31merror\x1B[0m: %s', this.relativePath, ast.loc.start.line, ast.loc.start.column, message ? message : 'Error');
            if (this.option.terminateWhenError) {
                throw new Error('[As2TS]Something wrong encountered.');
            }
        }
    };
    return TsMaker;
}());
exports.TsMaker = TsMaker;
