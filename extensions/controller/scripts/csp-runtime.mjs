import {createHash} from "node:crypto";
// MIG 1.1.0 ships Emscripten 4.0.15 glue with dynamic invokers. Replace only
// those two factories with static equivalents; the WASM bytes are unchanged.
// Based on the DYNAMIC_EXECUTION=0 paths in Emscripten's MIT-licensed
// src/lib/libembind.js and src/lib/libemval.js, tag 4.0.15.
export function cspRuntime(source){
    if(createHash("sha256").update(source).digest("hex")!=="1e63879a10cebb40c4885d8d77ac4a89cca1b98544e7ff286d2f82addbb2b491")throw new Error("Runtime changed: review static invokers before updating the pinned package");
    const replace=(start,end,value)=>{const a=source.indexOf(start),b=source.indexOf(end,a);if(a<0||b<0)throw new Error("Runtime marker missing");source=source.slice(0,a)+value+source.slice(b);};
    replace("function createJsInvoker(","function getRequiredArgCount(","\n");
    replace("function craftInvokerFunction(","var __embind_register_class_constructor",`function craftInvokerFunction(name,types,classType,invoke,target,isAsync){
        if(isAsync)throw new Error('Async bindings are not supported');
        const count=types.length-2,method=types[1]!==null&&classType!==null,stack=usesDestructorStack(types);
        return createNamedFunction(name,function(...args){
            checkArgCount(args.length,getRequiredArgCount(types),count,name,throwBindingError);
            const destructors=[],wired=[],params=[target];
            let self;
            if(method){self=types[1].toWireType(destructors,this);params.push(self);}
            for(let i=0;i<count;i++){wired[i]=types[i+2].toWireType(destructors,args[i]);params.push(wired[i]);}
            const result=invoke(...params);
            if(stack)runDestructors(destructors);
            else for(let i=method?1:2;i<types.length;i++)if(types[i].destructorFunction!==null)types[i].destructorFunction(i===1?self:wired[i-2]);
            if(!types[0].isVoid)return types[0].fromWireType(result);
        });
    }\n  `);
    replace("var captures = {'toValue': Emval.toValue};","var functionName = `methodCaller",`var invokerFunction=(handle,methodName,destructorsRef,pointer)=>{
        const values=argFromPtr.map((read,i)=>read(pointer+i*GenericWireTypeSize));
        let result;
        if(kind===0)result=Emval.toValue(handle).apply(null,values);
        else if(kind===2)result=Reflect.construct(Emval.toValue(handle),values);
        else if(kind===3)result=values[0];
        else if(kind===1)result=Emval.toValue(handle)[getStringOrSymbol(methodName)](...values);
        else throw new Error('Unknown invoker kind');
        if(!retType.isVoid)return emval_returnValue(toReturnWire,destructorsRef,result);
    };\n      `);
    if(/new Function\b|\beval\s*\(/.test(source))throw new Error("Dynamic code remains in extension runtime");
    return source;
}
